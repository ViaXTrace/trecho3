import { logger } from "./logger";

type ProcessFn = (filename: string) => Promise<void>;

let getConcurrency: () => Promise<number> = async () => 2;
let processFile: ProcessFn = async () => {
  throw new Error("Queue not configured");
};

const pending: string[] = [];
const running = new Set<string>();

export function configureQueue(opts: {
  getConcurrency: () => Promise<number>;
  process: ProcessFn;
}): void {
  getConcurrency = opts.getConcurrency;
  processFile = opts.process;
}

export function enqueueFile(filename: string): void {
  if (running.has(filename) || pending.includes(filename)) return;
  pending.push(filename);
  void pump();
}

export function isBusy(filename: string): boolean {
  return running.has(filename) || pending.includes(filename);
}

async function pump(): Promise<void> {
  let concurrency = 2;
  try {
    concurrency = await getConcurrency();
  } catch (err) {
    logger.error({ err }, "Failed to read concurrency setting; defaulting to 2");
  }

  while (pending.length > 0 && running.size < Math.max(1, concurrency)) {
    const filename = pending.shift();
    if (!filename) break;
    running.add(filename);
    processFile(filename)
      .catch((err) => {
        logger.error({ err, filename }, "Unhandled error while processing file");
      })
      .finally(() => {
        running.delete(filename);
        void pump();
      });
  }
}
