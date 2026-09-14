import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCENARIOS = new Set([
  "payments",
  "notifications",
  "agent-tool-call",
  "customer-data",
  "cross-region",
  "deployment-event"
]);
const LIVE_SCENARIOS = new Set(["payments", "notifications"]);
const MODES = new Set(["allow", "violation"]);

function backendUrl(name: "sender" | "receiver") {
  if (name === "sender") return process.env.DEMO_SENDER_URL || "https://sender.pigeonmq.cc/api/run";
  return process.env.DEMO_RECEIVER_URL || "https://receiver.pigeonmq.cc/api/run";
}

async function postJson(url: string, body: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-pigeon-demo": "landing"
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
  let input: { scenario?: string; mode?: string } = {};
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

  const runId = `demo_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const startedAt = Date.now();

  try {
    const sender = await postJson(backendUrl("sender"), { scenario, mode, runId });
    if (sender?.scenario !== scenario || sender?.runId !== runId) {
      return NextResponse.json(
        { live: false, code: "BACKEND_SCENARIO_NOT_DEPLOYED", error: "The live sender is not running the current scenario backend.", scenario, mode, runId },
        { status: 503 }
      );
    }

    const receiver = await postJson(backendUrl("receiver"), { scenario, mode, runId, subject: sender.subject });
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
      quarantine: receiver.quarantine ?? []
    });
  } catch (error) {
    return NextResponse.json(
      { live: false, scenario, mode, runId, error: error instanceof Error ? error.message : "Live demo failed." },
      { status: 502 }
    );
  }
}
