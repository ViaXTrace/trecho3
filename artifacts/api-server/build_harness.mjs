import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

globalThis.require = createRequire(import.meta.url);
const artifactDir = "/home/runner/workspace/artifacts/api-server";

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/testHarness.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: "/tmp/harness-dist",
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  external: ["pg-native"],
  sourcemap: "linked",
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
  },
});
