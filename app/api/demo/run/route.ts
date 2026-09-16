import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EncryptedMessage = {
  algorithm?: string;
  iv?: string;
  ciphertext?: string;
  plaintextBytes?: number;
};

const SCENARIOS = new Set([
  "message",
  "payments",
  "notifications",
  "agent-tool-call",
  "customer-data",
  "cross-region",
  "deployment-event",
  "a2a"
]);
const LIVE_SCENARIOS = new Set(["message", "payments", "notifications"]);
const MODES = new Set(["allow", "violation"]);

function backendUrl(name: "sender" | "receiver", scenario: string) {
  if (scenario === "message") {
    if (name === "sender") return process.env.DEMO_SENDER_MESSAGE_URL || "https://sender.pigeonmq.cc/api/message";
    return process.env.DEMO_RECEIVER_MESSAGE_URL || "https://receiver.pigeonmq.cc/api/message";
  }
  if (name === "sender") return process.env.DEMO_SENDER_URL || "https://sender.pigeonmq.cc/api/run";
  return process.env.DEMO_RECEIVER_URL || "https://receiver.pigeonmq.cc/api/run";
}

function validEncryptedMessage(value: EncryptedMessage | undefined) {
  return Boolean(
    value &&
    value.algorithm === "AES-256-GCM" &&
    typeof value.iv === "string" && /^[A-Za-z0-9_-]{16,32}$/.test(value.iv) &&
    typeof value.ciphertext === "string" && /^[A-Za-z0-9_-]{16,2048}$/.test(value.ciphertext) &&
    Number.isSafeInteger(value.plaintextBytes) && Number(value.plaintextBytes) >= 0 && Number(value.plaintextBytes) <= 2048
  );
}

async function postJson(url: string, body: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-pigeon-demo": "website"
    };
    if (process.env.PIGEON_DEMO_SHARED_KEY) {
      headers["x-pigeon-demo-key"] = process.env.PIGEON_DEMO_SHARED_KEY;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({ error: "Backend returned a non-JSON response." }));
    if (!response.ok) {
      const message = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
      throw new Error(message || `Demo backend returned ${response.status}.`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let input: { scenario?: string; mode?: string; message?: string; encrypted?: EncryptedMessage } = {};
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const scenario = input.scenario || "message";
  const mode = input.mode || "allow";
  const message = typeof input.message === "string" ? input.message.slice(0, 280) : "Hello from Pigeon";

  if (!SCENARIOS.has(scenario) || !MODES.has(mode)) {
    return NextResponse.json({ error: "Unsupported demo scenario or mode." }, { status: 400 });
  }
  if (!LIVE_SCENARIOS.has(scenario)) {
    return NextResponse.json(
      { live: false, code: "SCENARIO_NOT_LIVE", error: `Scenario '${scenario}' is an example application, not a live broker subject.` },
      { status: 501 }
    );
  }
  if (scenario === "message" && !validEncryptedMessage(input.encrypted)) {
    return NextResponse.json({ error: "The free-text demo requires a valid AES-256-GCM encrypted payload." }, { status: 400 });
  }

  const runId = `demo_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const startedAt = Date.now();

  try {
    const senderInput = scenario === "message"
      ? { scenario, mode, runId, encrypted: input.encrypted }
      : { scenario, mode, runId, message };
    const sender = await postJson(backendUrl("sender", scenario), senderInput);
    if (sender?.scenario !== scenario || sender?.runId !== runId) {
      return NextResponse.json(
        { live: false, code: "BACKEND_SCENARIO_NOT_DEPLOYED", error: "The sender is not running the current demo backend.", scenario, mode, runId },
        { status: 503 }
      );
    }

    const receiverInput = scenario === "message"
      ? { scenario, mode, runId, subject: sender.subject, sessionId: sender.sessionId }
      : { scenario, mode, runId, subject: sender.subject };
    const receiver = await postJson(backendUrl("receiver", scenario), receiverInput);
    return NextResponse.json({
      live: true,
      runId,
      scenario,
      mode,
      elapsedMs: Date.now() - startedAt,
      sender,
      receiver,
      decision: sender.decision,
      contract: sender.contract,
      gates: sender.gates,
      message: sender.message,
      encryption: scenario === "message" ? sender.encryption : undefined,
      audit: receiver.audit ?? [],
      quarantine: receiver.quarantine ?? []
    });
  } catch (error) {
    return NextResponse.json(
      { live: false, scenario, mode, runId, error: error instanceof Error ? error.message : "Live demo failed." },
      { status: 502 }
    );
  }
}
