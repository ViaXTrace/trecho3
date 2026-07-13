# Translator Studio

Mission control for a fan-translation team machine-translating the visual novel "Subarashiki Hibi" from English to Brazilian Portuguese, tracking all 113 script files through translation and repacking to the game's original binary format.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/translator-studio run dev` — run the web frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (`artifacts/api-server`)
- Frontend: React + Vite (`artifacts/translator-studio`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild (API server), Vite (frontend)

## Where things live

- `translation-workspace/source/` — the 113 original BGI binary script files plus their `.txt` dumps (English source + Portuguese target lines), and `translation-workspace/tools/` — the original Python `bgi_dump.py`/`bgi_insert.py`/`bgi_common.py` tooling and `GLOSSARY.md` style guide. This directory is the source of truth for script content; it is not part of any pnpm package.
- `artifacts/api-server/src/lib/` — translation pipeline: `paths.ts` (path resolution into `translation-workspace/`), `bgiDump.ts` (dump file parsing/rewriting), `translationProvider.ts` (OpenAI-compatible `/models` + `/chat/completions` calls), `pipeline.ts` (per-file translate orchestration, shells out to `bgi_insert.py` to repack the binary), `queue.ts` (concurrency-limited job queue), `settingsStore.ts`, `seed.ts` (scans `translation-workspace/source/` on startup to seed/refresh the `script_files` table).
- `artifacts/api-server/src/routes/settings.ts` and `files.ts` — REST endpoints.
- `lib/db/src/schema/scriptFiles.ts` and `settings.ts` — DB schema (Drizzle).
- `lib/api-spec/openapi.yaml` — API contract; re-run codegen after editing.

## Architecture decisions

- BYOK design: users supply their own OpenAI-compatible `baseUrl` + `apiKey` in Settings; the key is stored server-side but never returned by the API (only `hasApiKey: boolean`).
- Binary repacking reuses the project's existing Python `bgi_insert.py` tool via `execFile` rather than reimplementing BGI binary format writing in Node — the dump/insert format is intricate and already battle-tested.
- Translation source-of-truth per file is the `.txt` dump (not the raw binary): only the sequential `T` (dialogue) entries are re-translated; `N` (names) and `Z` (other) entries are left as dumped since they're already valid.
- Per-line translation skip logic: identifiers that look code-like (no spaces, contain a digit/underscore) are skipped without an AI call; everything else is sent to the model with the project glossary in the system prompt, which is also instructed to copy explicit-content lines through unchanged — skip vs. translated is determined by whether the model's output differs from the English input.
- A single in-process FIFO queue (`queue.ts`) throttles concurrent file translations to the user-configured `concurrency`; both "Translate" and "Translate All" enqueue through it.

## Product

- **Registry dashboard** (`/`): all 113 files with live status (pending/queued/translating/done/error), per-file progress (translated/skipped/total lines), a "Translate" action per file, and "Translate All Pending". Polls every few seconds so in-progress files update live.
- **Config page** (`/settings`): provider base URL + API key (write-only), auto-detected model picker, concurrency and batch size controls.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The dump file convention (`<en{marker}{id}>text` / `<pt{marker}{id}>text`) must stay byte-for-byte compatible with `bgi_insert.py`'s parser — only rewrite the `<pt...>` line's trailing text, never the tag prefix.
- PT-BR output must have **no accented characters or cedilla** — the game's encoding (`cp932`) can't represent them. This is enforced via the system prompt sent to the AI provider, not by code-level stripping.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
