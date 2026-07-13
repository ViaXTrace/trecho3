import { db, settingsTable, type SettingsRow } from "@workspace/db";
import { eq } from "drizzle-orm";

const SETTINGS_ID = 1;

/** Fetches the singleton settings row, creating it with defaults on first access. */
export async function getSettingsRow(): Promise<SettingsRow> {
  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, SETTINGS_ID));
  if (existing) return existing;

  const [created] = await db
    .insert(settingsTable)
    .values({ id: SETTINGS_ID })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost an insert race; re-read.
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, SETTINGS_ID));
  if (!row) throw new Error("Failed to initialize settings row");
  return row;
}

export interface PublicSettings {
  baseUrl: string;
  hasApiKey: boolean;
  model: string | null;
  models: string[];
  concurrency: number;
  batchSize: number;
  lastDetectedAt: Date | null;
  lastDetectError: string | null;
}

/** Never expose the raw apiKey — only whether one is configured. */
export function toPublicSettings(row: SettingsRow): PublicSettings {
  return {
    baseUrl: row.baseUrl,
    hasApiKey: Boolean(row.apiKey),
    model: row.model,
    models: row.models,
    concurrency: row.concurrency,
    batchSize: row.batchSize,
    lastDetectedAt: row.lastDetectedAt,
    lastDetectError: row.lastDetectError,
  };
}
