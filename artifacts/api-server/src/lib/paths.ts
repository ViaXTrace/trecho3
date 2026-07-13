import path from "node:path";

// The dev/start scripts always run with this package's directory as the
// working directory (pnpm --filter convention), so we can walk up to the
// monorepo root reliably regardless of how the process was bundled.
export const REPO_ROOT = path.resolve(process.cwd(), "../..");
export const TRANSLATION_WORKSPACE_DIR = path.join(
  REPO_ROOT,
  "translation-workspace",
);
export const SOURCE_DIR = path.join(TRANSLATION_WORKSPACE_DIR, "source");
export const OUTPUT_DIR = path.join(TRANSLATION_WORKSPACE_DIR, "output");
export const TOOLS_DIR = path.join(TRANSLATION_WORKSPACE_DIR, "tools");
