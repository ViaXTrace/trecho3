import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  baseUrl: text("base_url").notNull().default(""),
  apiKey: text("api_key"),
  model: text("model"),
  models: text("models").array().notNull().default([]),
  concurrency: integer("concurrency").notNull().default(2),
  batchSize: integer("batch_size").notNull().default(20),
  lastDetectedAt: timestamp("last_detected_at", { withTimezone: true }),
  lastDetectError: text("last_detect_error"),
});

export const insertSettingsSchema = createInsertSchema(settingsTable);
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type SettingsRow = typeof settingsTable.$inferSelect;
