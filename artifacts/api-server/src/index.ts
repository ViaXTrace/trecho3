import app from "./app";
import { logger } from "./lib/logger";
import { seedScriptFiles } from "./lib/seed";
import { configureQueue } from "./lib/queue";
import { processFile } from "./lib/pipeline";
import { getSettingsRow } from "./lib/settingsStore";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

configureQueue({
  getConcurrency: async () => (await getSettingsRow()).concurrency,
  process: processFile,
});

async function main() {
  await seedScriptFiles();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
