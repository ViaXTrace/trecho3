import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, scriptFilesTable } from "@workspace/db";
import {
  ListFilesResponse,
  GetStatsResponse,
  TranslateAllFilesResponse,
  GetFileParams,
  GetFileResponse,
  TranslateFileParams,
  TranslateFileResponse,
} from "@workspace/api-zod";
import { enqueueFile } from "../lib/queue";

const router: IRouter = Router();

router.get("/files", async (_req, res) => {
  const rows = await db.select().from(scriptFilesTable).orderBy(scriptFilesTable.filename);
  res.json(ListFilesResponse.parse(rows));
});

router.get("/files/stats", async (_req, res) => {
  const rows = await db.select().from(scriptFilesTable);
  const stats = {
    totalFiles: rows.length,
    doneFiles: rows.filter((r) => r.status === "done").length,
    errorFiles: rows.filter((r) => r.status === "error").length,
    translatingFiles: rows.filter((r) => r.status === "translating" || r.status === "queued").length,
    totalLines: rows.reduce((sum, r) => sum + r.totalLines, 0),
    translatedLines: rows.reduce((sum, r) => sum + r.translatedLines, 0),
  };
  res.json(GetStatsResponse.parse(stats));
});

router.post("/files/translate-all", async (_req, res) => {
  const rows = await db
    .select()
    .from(scriptFilesTable)
    .where(inArray(scriptFilesTable.status, ["pending", "error"]));

  if (rows.length > 0) {
    await db
      .update(scriptFilesTable)
      .set({ status: "queued", errorMessage: null })
      .where(inArray(scriptFilesTable.filename, rows.map((r) => r.filename)));
  }
  for (const row of rows) enqueueFile(row.filename);

  res.json(TranslateAllFilesResponse.parse({ queued: rows.length }));
});

router.get("/files/:filename", async (req, res) => {
  const { filename } = GetFileParams.parse(req.params);
  const [row] = await db.select().from(scriptFilesTable).where(eq(scriptFilesTable.filename, filename));
  if (!row) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.json(GetFileResponse.parse(row));
});

router.post("/files/:filename/translate", async (req, res) => {
  const { filename } = TranslateFileParams.parse(req.params);
  const [row] = await db.select().from(scriptFilesTable).where(eq(scriptFilesTable.filename, filename));
  if (!row) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  if (row.status === "translating" || row.status === "queued") {
    res.json(TranslateFileResponse.parse(row));
    return;
  }

  const [updated] = await db
    .update(scriptFilesTable)
    .set({ status: "queued", errorMessage: null })
    .where(eq(scriptFilesTable.filename, filename))
    .returning();
  enqueueFile(filename);

  res.json(TranslateFileResponse.parse(updated!));
});

export default router;
