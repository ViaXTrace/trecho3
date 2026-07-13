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
    const { lines, enEntries, setPt } = parseDump(content);

    let translatedLines = 0;
    let skippedLines = 0;
    const pending: { id: number; text: string }[] = [];

    for (const entry of enEntries) {
      if (isLikelyTechnicalId(entry.text)) {
        setPt(entry.id, entry.text);
        skippedLines += 1;
      } else {
        pending.push(entry);
      }
    }
    await saveProgress(filename, translatedLines, skippedLines);

    for (const batch of chunk(pending, settings.batchSize)) {
      const translations = await translateBatch(
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
      await saveProgress(filename, translatedLines, skippedLines);
    }

    await fs.writeFile(dumpPath, lines.join("\n"), "utf-8");

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await execFileAsync("python3", ["bgi_insert.py", OUTPUT_DIR, sourcePath], {
      cwd: TOOLS_DIR,
    });

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
