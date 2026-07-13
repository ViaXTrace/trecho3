import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db, scriptFilesTable } from "@workspace/db";
import { logger } from "./logger";
import { SOURCE_DIR, OUTPUT_DIR, TOOLS_DIR } from "./paths";
import { parseDump, isLikelyTechnicalId } from "./bgiDump";
import { translateBatch } from "./translationProvider";
import { getSettingsRow } from "./settingsStore";

const execFileAsync = promisify(execFile);

function chunk<T>(items: T[], size: number): T[][] {
  const safeSize = Math.max(1, size);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) out.push(items.slice(i, i + safeSize));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Rate limits (429) and transient server errors (5xx) are worth retrying; anything else (auth, bad request) is not. */
function isRetryableProviderError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b429\b/.test(message) || /\b5\d{2}\b/.test(message);
}

const MAX_BATCH_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 3_000;

/** Retries a translation batch with exponential backoff on rate limits/transient errors. */
async function translateBatchWithRetry(
  cfg: Parameters<typeof translateBatch>[0],
  batch: Parameters<typeof translateBatch>[1],
): Promise<Map<number, string>> {
  let attempt = 0;
  for (;;) {
    try {
      return await translateBatch(cfg, batch);
    } catch (err) {
      attempt += 1;
      if (attempt > MAX_BATCH_RETRIES || !isRetryableProviderError(err)) throw err;
      const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(
        { attempt, delay, message },
        "Translation batch hit a retryable error, backing off before retrying",
      );
      await sleep(delay);
    }
  }
}

async function saveProgress(
  filename: string,
  translatedLines: number,
  skippedLines: number,
): Promise<void> {
  await db
    .update(scriptFilesTable)
    .set({ translatedLines, skippedLines })
    .where(eq(scriptFilesTable.filename, filename));
}

/**
 * Translates one script file end to end: reads its .txt dump, machine
 * translates the dialogue lines via the configured provider (skipping
 * technical identifiers and anything the model flags as explicit content
 * per the glossary), writes the updated dump, then shells out to the
 * existing Python `bgi_insert.py` tool to repack the binary.
 */
export async function processFile(filename: string): Promise<void> {
  const sourcePath = path.join(SOURCE_DIR, filename);
  const dumpPath = `${sourcePath}.txt`;

  await db
    .update(scriptFilesTable)
    .set({ status: "translating", errorMessage: null, translatedLines: 0, skippedLines: 0 })
    .where(eq(scriptFilesTable.filename, filename));

  try {
    const settings = await getSettingsRow();
    if (!settings.apiKey) throw new Error("No API key configured. Add one in Settings.");
    if (!settings.baseUrl) throw new Error("No base URL configured. Add one in Settings.");
    if (!settings.model) throw new Error("No model selected. Detect and pick a model in Settings.");

    const content = await fs.readFile(dumpPath, "utf-8");
    const { lines, enEntries, ptEntries, setPt } = parseDump(content);

    // Persist the dump to disk incrementally as we go, and treat any line
    // whose `pt` text already differs from `en` (from a prior partial run,
    // or a pre-existing human translation) as already done. This makes
    // retries resume from where a previous attempt left off instead of
    // re-translating the whole file -- critical after a mid-file failure
    // (rate limit, provider error, or a repack error after translation
    // already succeeded).
    let translatedLines = 0;
    let skippedLines = 0;
    const pending: { id: number; text: string }[] = [];

    for (const entry of enEntries) {
      if (isLikelyTechnicalId(entry.text)) {
        setPt(entry.id, entry.text);
        skippedLines += 1;
      } else if (ptEntries.get(entry.id) !== entry.text) {
        // Already translated in a previous run/attempt -- keep it as-is.
        translatedLines += 1;
      } else {
        pending.push(entry);
      }
    }
    await saveProgress(filename, translatedLines, skippedLines);

    for (const batch of chunk(pending, settings.batchSize)) {
      const translations = await translateBatchWithRetry(
        { baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model },
        batch,
      );
      for (const item of batch) {
        const pt = translations.get(item.id);
        if (pt === undefined) {
          throw new Error(`Translation provider did not return a result for line ${item.id}`);
        }
        setPt(item.id, pt);
        if (pt === item.text) skippedLines += 1;
        else translatedLines += 1;
      }
      // Write progress to disk after every batch, not just at the end, so a
      // later failure (or a retry) never loses already-translated lines.
      await fs.writeFile(dumpPath, lines.join("\n"), "utf-8");
      await saveProgress(filename, translatedLines, skippedLines);
    }

    await fs.writeFile(dumpPath, lines.join("\n"), "utf-8");

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    try {
      await execFileAsync("python3", ["bgi_insert.py", OUTPUT_DIR, sourcePath], {
        cwd: TOOLS_DIR,
      });
    } catch (err) {
      // execFile errors carry stdout/stderr separately from `message`; surface
      // stderr so repack failures are actually diagnosable instead of showing
      // a bare "Command failed" message.
      const stderr = (err as { stderr?: string })?.stderr?.trim();
      const stdout = (err as { stdout?: string })?.stdout?.trim();
      const detail = stderr || stdout;
      const baseMessage = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Repack step (bgi_insert.py) failed: ${baseMessage}${detail ? ` — ${detail.slice(0, 500)}` : ""}`,
      );
    }

    await db
      .update(scriptFilesTable)
      .set({ status: "done", translatedLines, skippedLines, errorMessage: null })
      .where(eq(scriptFilesTable.filename, filename));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, filename }, "Failed to translate script file");
    await db
      .update(scriptFilesTable)
      .set({ status: "error", errorMessage: message })
      .where(eq(scriptFilesTable.filename, filename));
  }
}
