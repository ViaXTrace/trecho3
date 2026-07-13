import fs from "node:fs/promises";
import path from "node:path";
import { db, scriptFilesTable } from "@workspace/db";
import { logger } from "./logger";
import { SOURCE_DIR } from "./paths";
import { listScriptFilenames, countTotalLines } from "./bgiDump";

/** Scans translation-workspace/source for script files and seeds/refreshes the DB rows. */
export async function seedScriptFiles(): Promise<void> {
  let filenames: string[];
  try {
    filenames = await listScriptFilenames(SOURCE_DIR);
  } catch (err) {
    logger.error(
      { err, SOURCE_DIR },
      "Could not read translation-workspace source directory; skipping file seed",
    );
    return;
  }

  for (const filename of filenames) {
    const dumpPath = path.join(SOURCE_DIR, `${filename}.txt`);
    const content = await fs.readFile(dumpPath, "utf-8");
    const totalLines = countTotalLines(content);

    await db
      .insert(scriptFilesTable)
      .values({ filename, totalLines, status: "pending" })
      .onConflictDoUpdate({
        target: scriptFilesTable.filename,
        set: { totalLines },
      });
  }

  logger.info({ count: filenames.length }, "Seeded script files from translation-workspace/source");
}
