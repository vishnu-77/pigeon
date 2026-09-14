import { setTimeout as delay } from "node:timers/promises";
import { PigeonClient } from "../sdk/typescript/pigeon-client.mjs";

export const SUBJECT = "payments.authorize";
export const timeoutMs = Number(process.env.DEMO_TIMEOUT_MS ?? 30_000);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
  throw new Error("DEMO_TIMEOUT_MS must be a positive integer.");
}

export function createClient(defaultToken) {
  return new PigeonClient({
    url: process.env.PIGEON_URL ?? "http://localhost:8787",
    token: process.env.PIGEON_TOKEN ?? defaultToken,
    fetchImpl: (url, options) => fetch(url, {
      ...options, signal: AbortSignal.timeout(Math.min(timeoutMs, 5000))
    })
  });
}

export async function until(check, description) {
  const deadline = Date.now() + timeoutMs;
  do {
    const result = await check();
    if (result) return result;
    await delay(Math.min(100, Math.max(0, deadline - Date.now())));
  } while (Date.now() < deadline);
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}.`);
}

export async function connect(client) {
  await until(async () => {
    try {
      return (await client.fetch(`${client.url}/health`)).ok;
    } catch { return false; }
  }, `broker health at ${client.url}`);
  return client.connect([SUBJECT]);
}
