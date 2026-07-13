import fs from "node:fs";
import { TOOLS_DIR } from "./paths";

export interface ProviderCredentials {
  baseUrl: string;
  apiKey: string;
}

export interface ProviderConfig extends ProviderCredentials {
  model: string;
}

function joinUrl(baseUrl: string, endpoint: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(endpoint, base).toString();
}

export async function listModels(creds: ProviderCredentials): Promise<string[]> {
  const url = joinUrl(creds.baseUrl, "models");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${creds.apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Model list request failed: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`,
    );
  }
  const json = (await res.json()) as { data?: unknown };
  if (!Array.isArray(json.data)) {
    throw new Error("Unexpected response shape from the provider's /models endpoint");
  }
  const ids = json.data
    .map((entry) => (entry as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string");
  if (ids.length === 0) {
    throw new Error("The provider returned no usable models");
  }
  return ids;
}

let cachedGlossary: string | null = null;
function loadGlossary(): string {
  if (cachedGlossary === null) {
    cachedGlossary = fs.readFileSync(`${TOOLS_DIR}/GLOSSARY.md`, "utf-8");
  }
  return cachedGlossary;
}

function buildSystemPrompt(): string {
  return `You are a professional Brazilian Portuguese (PT-BR) translator working on the visual novel "Subarashiki Hibi".
You receive a JSON array of dialogue lines: [{"id": number, "en": string}, ...].
Respond with ONLY a JSON array of the same length and order: [{"id": number, "pt": string}, ...]. No prose, no markdown fences.

Follow this glossary and style guide strictly (it is written in Portuguese; it governs the "pt" field you produce):
---
${loadGlossary()}
---

Critical formatting rules:
- The "pt" field must contain NO accented characters and NO cedilla (the game's text encoding cannot represent them). Write "nao" not "n\u00e3o", "voce" not "voc\u00ea", etc.
- If an "en" value is a technical identifier (a file name, voice/sound/music ID, or sprite/scene code — no spaces, code-like), copy it into "pt" unchanged.
- If an "en" value is explicit sexual content, copy it into "pt" unchanged (do not translate it).
- Otherwise, translate naturally into colloquial PT-BR fitting teenage characters, preserving punctuation and any "\\n" line-break sequences exactly.
- Never merge, split, omit, or reorder entries — return exactly one output object per input id.`;
}

function extractJsonArray(content: string): unknown {
  let text = content.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) text = fenced[1].trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  return JSON.parse(text);
}

export async function translateBatch(
  cfg: ProviderConfig,
  items: { id: number; text: string }[],
): Promise<Map<number, string>> {
  const url = joinUrl(cfg.baseUrl, "chat/completions");
  const userPayload = JSON.stringify(items.map((item) => ({ id: item.id, en: item.text })));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.3,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: `Translate this JSON array of dialogue lines. Respond with ONLY a JSON array:\n${userPayload}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Translation request failed: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`,
    );
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Unexpected response shape from the provider's chat completions endpoint");
  }

  let parsed: unknown;
  try {
    parsed = extractJsonArray(content);
  } catch {
    throw new Error("Could not parse the provider's response as JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Provider response was not a JSON array");
  }

  const map = new Map<number, string>();
  for (const entry of parsed) {
    const id = (entry as { id?: unknown })?.id;
    const pt = (entry as { pt?: unknown })?.pt;
    if (typeof id === "number" && typeof pt === "string") {
      map.set(id, pt);
    }
  }
  return map;
}
