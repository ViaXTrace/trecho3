// Temporary local test harness -- not part of the app. Deleted after manual verification.
import { processFile } from "./lib/pipeline";

let callCount = 0;
const rateLimitFirstN = Number(process.env.TEST_RATE_LIMIT_FIRST_N || "0");
const failAfter = Number(process.env.TEST_FAIL_AFTER || "999999");
const failStatus = Number(process.env.TEST_FAIL_STATUS || "500");

const realFetch = globalThis.fetch;

globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.includes("/models")) {
    return new Response(JSON.stringify({ data: [{ id: "mock-model" }] }), { status: 200 });
  }
  if (url.includes("/chat/completions")) {
    callCount += 1;
    console.log(`[harness] chat call #${callCount}`);
    if (callCount <= rateLimitFirstN) {
      return new Response(JSON.stringify({ message: "Rate limit exceeded" }), { status: 429 });
    }
    if (callCount > failAfter) {
      return new Response(JSON.stringify({ error: "simulated failure" }), { status: failStatus });
    }
    const body = JSON.parse(init.body);
    const userMsg = body.messages.find((m: any) => m.role === "user").content;
    const items = JSON.parse(userMsg.slice(userMsg.indexOf("[")));
    const out = items.map((it: any) => ({ id: it.id, pt: `PT[${it.id}] ${it.en}` }));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(out) } }] }), {
      status: 200,
    });
  }
  return realFetch(input, init);
}) as typeof fetch;

const filename = process.argv[2];
if (!filename) {
  console.error("usage: testHarness <filename>");
  process.exit(1);
}

await processFile(filename);
console.log("[harness] processFile resolved");
process.exit(0);
