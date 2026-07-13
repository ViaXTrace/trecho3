---
name: BGI script translation pipeline
description: How the Subarashiki Hibi PT-BR translation dump/insert format and skip logic work, and why the binary repack shells out to Python.
---

The BGI visual-novel binary format is dumped/inserted via existing Python tools (`translation-workspace/tools/bgi_dump.py`, `bgi_insert.py`, `bgi_common.py`) rather than reimplemented in Node.

**Why:** the binary layout (header/code/text section splitting, address rewriting) is intricate and already correct in the Python tools; reimplementing it risks subtle corruption. `.txt` dumps already exist for every source binary, so translation only needs to read/rewrite those dumps and shell out (`execFile("python3", ["bgi_insert.py", outDir, scriptPath])`) to repack.

**How to apply:** Dump lines follow `<{en|pt}{marker}{4-digit-id}>{text}` where marker is `N` (names), `T` (sequential dialogue), or `Z` (other). Only rewrite a `<pt...>` line's trailing text — never touch the tag prefix — or `bgi_insert.py`'s parser breaks. `N`/`Z` entries are left as-is (already valid); only `T` entries get re-translated.

Skip-vs-translate decision for each `T` line: code-like identifiers (no spaces, digit/underscore present) are skipped without an AI call; everything else goes to the model with the project's `GLOSSARY.md` embedded in the system prompt, which also instructs it to copy explicit-content lines through unchanged. Skipped vs. translated is determined after the fact by whether the model's output equals the English input — there's no separate explicit-content classifier.

The game's text encoding (`cp932`) cannot represent accented Latin characters, so PT-BR output must have zero accents/cedilla — enforced via the system prompt, not code-level stripping.
