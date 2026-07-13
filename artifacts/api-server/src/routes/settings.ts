import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import {
  GetSettingsResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
  DetectModelsResponse,
} from "@workspace/api-zod";
import { getSettingsRow, toPublicSettings } from "../lib/settingsStore";
import { listModels } from "../lib/translationProvider";

const router: IRouter = Router();

router.get("/settings", async (_req, res) => {
  const row = await getSettingsRow();
  res.json(GetSettingsResponse.parse(toPublicSettings(row)));
});

router.put("/settings", async (req, res) => {
  const body = UpdateSettingsBody.parse(req.body);
  const current = await getSettingsRow();

  const updates: Partial<typeof settingsTable.$inferInsert> = {};
  if (body.baseUrl !== undefined) updates.baseUrl = body.baseUrl;
  if (body.apiKey !== undefined) updates.apiKey = body.apiKey;
  if (body.model !== undefined) updates.model = body.model;
  if (body.concurrency !== undefined) updates.concurrency = body.concurrency;
  if (body.batchSize !== undefined) updates.batchSize = body.batchSize;

  const [updated] = Object.keys(updates).length
    ? await db
        .update(settingsTable)
        .set(updates)
        .where(eq(settingsTable.id, current.id))
        .returning()
    : [current];
  let finalRow = updated ?? current;

  const effectiveBaseUrl = updates.baseUrl ?? current.baseUrl;
  const effectiveApiKey = updates.apiKey ?? current.apiKey;

  if (effectiveBaseUrl && effectiveApiKey) {
    try {
      const models = await listModels({ baseUrl: effectiveBaseUrl, apiKey: effectiveApiKey });
      const [afterDetect] = await db
        .update(settingsTable)
        .set({
          models,
          model: finalRow.model && models.includes(finalRow.model) ? finalRow.model : (models[0] ?? null),
          lastDetectedAt: new Date(),
          lastDetectError: null,
        })
        .where(eq(settingsTable.id, current.id))
        .returning();
      if (afterDetect) finalRow = afterDetect;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const [afterFail] = await db
        .update(settingsTable)
        .set({ lastDetectError: message })
        .where(eq(settingsTable.id, current.id))
        .returning();
      if (afterFail) finalRow = afterFail;
    }
  }

  res.json(UpdateSettingsResponse.parse(toPublicSettings(finalRow)));
});

router.post("/settings/detect-models", async (_req, res) => {
  const current = await getSettingsRow();
  if (!current.baseUrl || !current.apiKey) {
    res.status(400).json({ error: "Configure a base URL and API key before detecting models." });
    return;
  }

  try {
    const models = await listModels({ baseUrl: current.baseUrl, apiKey: current.apiKey });
    const [updated] = await db
      .update(settingsTable)
      .set({
        models,
        model: current.model && models.includes(current.model) ? current.model : (models[0] ?? null),
        lastDetectedAt: new Date(),
        lastDetectError: null,
      })
      .where(eq(settingsTable.id, current.id))
      .returning();
    res.json(DetectModelsResponse.parse(toPublicSettings(updated!)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(settingsTable)
      .set({ lastDetectError: message })
      .where(eq(settingsTable.id, current.id));
    res.status(400).json({ error: message });
  }
});

export default router;
