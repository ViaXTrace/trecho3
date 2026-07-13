import fs from "node:fs/promises";
import path from "node:path";

export interface EnEntry {
  id: number;
  text: string;
}

export interface ParsedDump {
  lines: string[];
  enEntries: EnEntry[];
  /** Current `pt` text for each `T` id, as already present on disk. */
  ptEntries: Map<number, string>;
  setPt: (id: number, text: string) => void;
}

// Matches dump lines like `<enT0001>Some text` or `<ptN0002>Yuki`.
const LINE_RE = /^<(en|pt)([A-Z])(\d+)>(.*)$/;

/** Mirrors bgi_common.escape(): the dump format keeps entries on one line. */
export function escapeText(text: string): string {
  return text.replace(/\r?\n/g, "\\n");
}

/**
 * Parses a BGI dump (.txt) file, extracting the sequential "T" (dialogue)
 * entries and exposing a setter that rewrites the matching `<pt...>` line
 * in place, preserving every other line (comments, N/Z sections, spacing).
 */
export function parseDump(content: string): ParsedDump {
  const lines = content.split("\n");
  const enEntries: EnEntry[] = [];
  const ptEntries = new Map<number, string>();
  const ptLineIndexById = new Map<number, number>();
  const ptPrefixById = new Map<number, string>();

  lines.forEach((line, idx) => {
    const match = LINE_RE.exec(line);
    if (!match) return;
    const [, lang, marker, idStr, text] = match;
    if (marker !== "T") return;
    const id = Number(idStr);
    if (lang === "en") {
      enEntries.push({ id, text });
    } else {
      ptEntries.set(id, text);
      ptLineIndexById.set(id, idx);
      ptPrefixById.set(id, `<pt${marker}${idStr}>`);
    }
  });

  const setPt = (id: number, text: string) => {
    const idx = ptLineIndexById.get(id);
    const prefix = ptPrefixById.get(id);
    if (idx === undefined || prefix === undefined) return;
    lines[idx] = `${prefix}${escapeText(text)}`;
    ptEntries.set(id, text);
  };

  return { lines, enEntries, ptEntries, setPt };
}

export function countTotalLines(content: string): number {
  return parseDump(content).enEntries.length;
}

// Technical identifiers (voice/sound/music IDs, sprite codes, filenames) are
// code-like: no whitespace, and contain a digit or underscore. These are
// never translated per the project glossary.
const TECHNICAL_ID_RE = /^[A-Za-z0-9_.-]+$/;
export function isLikelyTechnicalId(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  return TECHNICAL_ID_RE.test(trimmed) && /[0-9_]/.test(trimmed);
}

/** Lists extensionless script files in `sourceDir` that have a matching .txt dump. */
export async function listScriptFilenames(sourceDir: string): Promise<string[]> {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (path.extname(entry.name) !== "") continue;
    const dumpPath = path.join(sourceDir, `${entry.name}.txt`);
    try {
      await fs.access(dumpPath);
      names.push(entry.name);
    } catch {
      // No matching dump for this binary; skip it.
    }
  }
  return names.sort();
}
