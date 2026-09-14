import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createPigeonServer } from "../src/server.js";

// A private broker prevents another consumer from advancing the demo's cursor.
// Clients run as separate processes and communicate only through HTTP.
const server = createPigeonServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const url = `http://127.0.0.1:${server.address().port}`;
const runId = randomUUID();
const children = [];
console.log(`[demo] broker listening on ${url}`);

function run(role, token) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(`./container-${role}.js`, import.meta.url))], {
      stdio: "inherit", windowsHide: true,
      env: { ...process.env, PIGEON_URL: url, PIGEON_TOKEN: token, DEMO_RUN_ID: runId, SENDER_HOLD_OPEN: "false" }
    });
    children.push(child);
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`${role} failed (${signal ?? code})`)));
  });
}

function stop() {
  for (const child of children) if (child.exitCode === null) child.kill();
  server.closeAllConnections();
  server.close();
}
process.once("SIGINT", () => { stop(); process.exitCode = 130; });
process.once("SIGTERM", () => { stop(); process.exitCode = 143; });

try {
  await Promise.all([run("receiver", "gateway-token"), run("sender", "checkout-token")]);
  console.log("[demo] passed: publish -> deduplicate -> quarantine -> receive -> acknowledge");
} catch (error) {
  console.error(`[demo] ${error.message}`);
  process.exitCode = 1;
} finally {
  stop();
}
