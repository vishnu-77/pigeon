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

const MODES = new Set(["allow", "violation"]);

function backendUrl(name: "sender" | "receiver") {
  if (name === "sender") {
    return process.env.DEMO_SENDER_URL || "https://sender.pigeonmq.cc/api/run";
  }
  return process.env.DEMO_RECEIVER_URL || "https://receiver.pigeonmq.cc/api/run";
}

async function postJson(url: string, body: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-pigeon-demo": "landing" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({ error: "Backend returned a non-JSON response." }));
    if (!response.ok) {
      throw new Error(payload?.error || `Demo backend returned ${response.status}.`);
    }
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

  const scenario = input.scenario || "agent-tool-call";
  const mode = input.mode || "violation";
  if (!SCENARIOS.has(scenario) || !MODES.has(mode)) {
    return NextResponse.json({ error: "Unsupported demo scenario or mode." }, { status: 400 });
  }

  const runId = `demo_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const startedAt = Date.now();

  try {
    const sender = await postJson(backendUrl("sender"), { scenario, mode, runId });

    // Prevent the old payments-only Vercel app from being presented as a different live scenario.
    if (sender?.scenario !== scenario || sender?.runId !== runId) {
      return NextResponse.json(
        {
          live: false,
          code: "BACKEND_SCENARIO_NOT_DEPLOYED",
          error: "The live sender has not yet been upgraded to the scenario-driven demo backend.",
          scenario,
          mode,
          runId
        },
        { status: 503 }
      );
    }

    const receiver = await postJson(backendUrl("receiver"), { scenario, mode, runId, subject: sender.subject });
    const elapsedMs = Date.now() - startedAt;

    return NextResponse.json({
      live: true,
      runId,
      scenario,
      mode,
      elapsedMs,
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
    const message = error instanceof Error ? error.message : "Live demo failed.";
    return NextResponse.json(
      { live: false, scenario, mode, runId, error: message },
      { status: 502 }
    );
  }
}
