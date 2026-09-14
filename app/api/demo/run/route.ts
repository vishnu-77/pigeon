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
    if (!response.ok) throw new Error(payload?.error || `Demo backend returned ${response.status}.`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let input: { scenario?: string; mode?: string; message?: string } = {};
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

  const runId = `demo_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const startedAt = Date.now();

  try {
    const sender = await postJson(backendUrl("sender", scenario), { scenario, mode, runId, message });
    if (sender?.scenario !== scenario || sender?.runId !== runId) {
      return NextResponse.json(
        { live: false, code: "BACKEND_SCENARIO_NOT_DEPLOYED", error: "The sender is not running the current demo backend.", scenario, mode, runId },
        { status: 503 }
      );
    }

    const receiver = await postJson(backendUrl("receiver", scenario), { scenario, mode, runId, subject: sender.subject });
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
      audit: receiver.audit ?? [],
      quarantine: receiver.quarantine ?? [],
      transport: {
        sender: backendUrl("sender", scenario).startsWith("https://") ? "https" : "http",
        receiver: backendUrl("receiver", scenario).startsWith("https://") ? "https" : "http"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { live: false, scenario, mode, runId, error: error instanceof Error ? error.message : "Live demo failed." },
      { status: 502 }
    );
  }
}
