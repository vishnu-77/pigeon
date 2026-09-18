import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCENARIOS = new Set([
  "message",
  "payments",
  "notifications",
  "agent-tool-call",
  "customer-data",
  "cross-region",
  "deployment-event"
]);
const LIVE_SCENARIOS = new Set(["message", "payments", "notifications"]);
const MODES = new Set(["allow", "violation"]);
const isProduction = process.env.VERCEL_ENV === "production";

function backendUrl(name: "sender" | "receiver", scenario: string) {
  const envName = name === "sender" ? "DEMO_SENDER_URL" : "DEMO_RECEIVER_URL";
  const configured = process.env[envName];
  const base = configured || (name === "sender" ? "https://sender.pigeonmq.cc/api/run" : "https://receiver.pigeonmq.cc/api/run");
  return scenario === "message" ? base.replace(/\/api\/run$/, "/api/message") : base;
}

async function postJson(url: string, body: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-pigeon-demo": isProduction ? "production" : "development"
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
    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    let payload: any = null;
    if (contentType.includes("application/json")) {
      try { payload = JSON.parse(raw); } catch { payload = null; }
    }
    if (!payload) {
      const preview = raw.trim().slice(0, 160);
      throw new Error(`Demo backend returned ${response.status} ${contentType || "unknown content type"}${preview ? `: ${preview}` : ""}`);
    }
    if (!response.ok) throw new Error(payload?.error || `Demo backend returned ${response.status}.`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let input: { scenario?: string; mode?: string; encryptedMessage?: string } = {};
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const scenario = input.scenario || "payments";
  const mode = input.mode || "violation";
  if (!SCENARIOS.has(scenario) || !MODES.has(mode)) {
    return NextResponse.json({ error: "Unsupported demo scenario or mode." }, { status: 400 });
  }
  if (!LIVE_SCENARIOS.has(scenario)) {
    return NextResponse.json(
      { live: false, code: "SCENARIO_NOT_LIVE", error: `Scenario '${scenario}' is not broker-backed yet.` },
      { status: 501 }
    );
  }

  const senderUrl = backendUrl("sender", scenario);
  const receiverUrl = backendUrl("receiver", scenario);

  if (scenario === "message") {
    const encryptedMessage = typeof input.encryptedMessage === "string" ? input.encryptedMessage : "";
    if (!encryptedMessage.startsWith("pigeon:aes-gcm:v1:") || encryptedMessage.length > 280) {
      return NextResponse.json({ live: false, code: "INVALID_ENCRYPTED_MESSAGE", error: "Encrypted demo message is missing or invalid." }, { status: 400 });
    }
  }

  const runId = `demo_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const startedAt = Date.now();

  try {
    const sender = await postJson(
      senderUrl,
      scenario === "message"
        ? { mode, runId, message: input.encryptedMessage }
        : { scenario, mode, runId }
    );
    if (sender?.scenario !== scenario || sender?.runId !== runId) {
      return NextResponse.json(
        { live: false, code: "BACKEND_SCENARIO_NOT_DEPLOYED", error: "The live sender is not running the current scenario backend.", scenario, mode, runId },
        { status: 503 }
      );
    }

    const receiver = await postJson(
      receiverUrl,
      scenario === "message"
        ? { mode, runId }
        : { scenario, mode, runId, subject: sender.subject }
    );
    return NextResponse.json({
      live: true,
      environment: isProduction ? "production" : "development",
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
      audit: receiver.audit ?? [],
      quarantine: receiver.quarantine ?? []
    });
  } catch (error) {
    return NextResponse.json(
      { live: false, environment: isProduction ? "production" : "development", scenario, mode, runId, error: error instanceof Error ? error.message : "Live demo failed." },
      { status: 502 }
    );
  }
}
