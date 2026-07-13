import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scriptFilesTable = pgTable("script_files", {
  filename: text("filename").primaryKey(),
  status: text("status", {
    enum: ["pending", "queued", "translating", "done", "error"],
  })
    .notNull()
    .default("pending"),
  totalLines: integer("total_lines").notNull().default(0),
  translatedLines: integer("translated_lines").notNull().default(0),
  skippedLines: integer("skipped_lines").notNull().default(0),
  errorMessage: text("error_message"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertScriptFileSchema = createInsertSchema(scriptFilesTable);
export type InsertScriptFile = z.infer<typeof insertScriptFileSchema>;
export type ScriptFileRow = typeof scriptFilesTable.$inferSelect;
