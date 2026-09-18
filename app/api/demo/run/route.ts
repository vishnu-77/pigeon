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
const LIVE_SCENARIOS = new Set(["message", "payments"]);
const MODES = new Set(["allow", "violation"]);
const ENCRYPTED_MESSAGE_PREFIX = "pigeon:aes-gcm:v1:";
const ENCRYPTED_MESSAGE_MAX_LENGTH = 280;

function brokerUrl() {
  return process.env.DEMO_BROKER_URL || "https://pigeon-broker-demo.fly.dev";
}

function backendUrl(name: "sender" | "receiver") {
  if (name === "sender") return process.env.DEMO_SENDER_URL || "https://sender.pigeonmq.cc/api/forward";
  return process.env.DEMO_RECEIVER_URL || "https://receiver.pigeonmq.cc/api/forward";
}

type ForwardResult = { ok: boolean; status: number; body: any };

async function fetchJson(url: string, init: RequestInit): Promise<ForwardResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
    const raw = await response.text();
    let body: any = null;
    if (raw) {
      try { body = JSON.parse(raw); } catch { body = null; }
    }
    if (body === null) {
      throw new Error(`Demo backend returned a non-JSON response (${response.status}).`);
    }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function createSession() {
  const result = await fetchJson(`${brokerUrl()}/demo/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  });
  if (!result.ok || !result.body?.session?.id) {
    throw new Error(result.body?.error?.message || `Could not start a demo session (${result.status}).`);
  }
  return result.body.session.id as string;
}

async function forward(name: "sender" | "receiver", payload: Record<string, unknown>) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-pigeon-demo": "landing" };
  if (process.env.PIGEON_DEMO_SHARED_KEY) headers["x-pigeon-demo-key"] = process.env.PIGEON_DEMO_SHARED_KEY;
  return fetchJson(backendUrl(name), { method: "POST", headers, body: JSON.stringify(payload) });
}

async function runPaymentsScenario(sessionId: string, runId: string, mode: string) {
  const senderContract = await forward("sender", {
    sessionId,
    path: "/v1/contracts",
    method: "POST",
    principal: "checkout",
    body: { subjects: ["payments.authorize"], ttlMs: 120_000 }
  });
  if (!senderContract.ok) {
    throw new Error(senderContract.body?.error?.message || `Sender could not negotiate a contract (${senderContract.status}).`);
  }

  const publish = await forward("sender", {
    sessionId,
    path: "/v1/messages",
    method: "POST",
    principal: "checkout",
    contractId: senderContract.body.contract.id,
    body: {
      subject: "payments.authorize",
      type: "payments.authorize.request",
      source: "checkout-service",
      intent: "authorize_payment",
      idempotencyKey: `${runId}:authorize`,
      classification: "pci",
      region: "uk",
      data: {
        merchantId: "merchant_demo",
        orderId: runId,
        amount: 42.5,
        currency: "GBP",
        paymentToken: "tok_visa_demo",
        ...(mode === "violation" ? { card: { pan: "4111111111111111" } } : {})
      }
    }
  });

  if (!publish.ok) {
    return { decision: "QUARANTINE", error: publish.body?.error?.message, code: publish.body?.error?.code, receivedCount: 0 };
  }

  const receiverContract = await forward("receiver", {
    sessionId,
    path: "/v1/contracts",
    method: "POST",
    body: { subjects: ["payments.authorize"], ttlMs: 120_000 }
  });
  if (!receiverContract.ok) {
    throw new Error(receiverContract.body?.error?.message || `Receiver could not negotiate a contract (${receiverContract.status}).`);
  }

  const received = await forward("receiver", {
    sessionId,
    path: "/v1/subjects/payments.authorize/receive",
    method: "POST",
    contractId: receiverContract.body.contract.id,
    body: { max: 1 }
  });
  if (!received.ok) {
    throw new Error(received.body?.error?.message || `Receiver could not fetch the message (${received.status}).`);
  }

  return { decision: "ALLOW", receivedCount: received.body?.messages?.length ?? 0 };
}

async function runMessageScenario(sessionId: string, runId: string, mode: string, encryptedMessage: string) {
  const senderContract = await forward("sender", {
    sessionId,
    path: "/v1/contracts",
    method: "POST",
    principal: "demo-producer",
    body: { subjects: ["demo.message"], ttlMs: 120_000 }
  });
  if (!senderContract.ok) {
    throw new Error(senderContract.body?.error?.message || `Sender could not negotiate a contract (${senderContract.status}).`);
  }

  const publish = await forward("sender", {
    sessionId,
    path: "/v1/messages",
    method: "POST",
    principal: "demo-producer",
    contractId: senderContract.body.contract.id,
    body: {
      subject: "demo.message",
      type: "demo.message.created",
      source: "demo-client",
      intent: "send_demo_message",
      idempotencyKey: `${runId}:message`,
      classification: "internal",
      region: "uk",
      data: {
        demoRunId: runId,
        message: encryptedMessage,
        ...(mode === "violation" ? { restricted: { secret: "demo-value" } } : {})
      }
    }
  });

  if (!publish.ok) {
    return { decision: "QUARANTINE", error: publish.body?.error?.message, code: publish.body?.error?.code, receivedCount: 0 };
  }

  const receiverContract = await forward("receiver", {
    sessionId,
    path: "/v1/contracts",
    method: "POST",
    body: { subjects: ["demo.message"], ttlMs: 120_000 }
  });
  if (!receiverContract.ok) {
    throw new Error(receiverContract.body?.error?.message || `Receiver could not negotiate a contract (${receiverContract.status}).`);
  }

  const received = await forward("receiver", {
    sessionId,
    path: "/v1/subjects/demo.message/receive",
    method: "POST",
    contractId: receiverContract.body.contract.id,
    body: { max: 1 }
  });
  if (!received.ok) {
    throw new Error(received.body?.error?.message || `Receiver could not fetch the message (${received.status}).`);
  }

  return {
    decision: "ALLOW",
    receivedCount: received.body?.messages?.length ?? 0,
    delivered: received.body?.messages?.[0]?.data?.message as string | undefined
  };
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
  if (scenario === "message" && (typeof input.encryptedMessage !== "string" || !input.encryptedMessage.startsWith(ENCRYPTED_MESSAGE_PREFIX) || input.encryptedMessage.length > ENCRYPTED_MESSAGE_MAX_LENGTH)) {
    return NextResponse.json({ error: "Invalid encrypted message payload.", code: "INVALID_ENCRYPTED_MESSAGE" }, { status: 400 });
  }

  const runId = `demo_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const startedAt = Date.now();

  try {
    const sessionId = await createSession();
    const outcome = scenario === "message"
      ? await runMessageScenario(sessionId, runId, mode, input.encryptedMessage as string)
      : await runPaymentsScenario(sessionId, runId, mode);
    return NextResponse.json({
      live: true,
      runId,
      scenario,
      mode,
      elapsedMs: Date.now() - startedAt,
      decision: outcome.decision,
      error: outcome.error,
      code: outcome.code,
      receiver: {
        receivedCount: outcome.receivedCount,
        delivered: "delivered" in outcome && outcome.delivered ? [{ data: { message: outcome.delivered } }] : []
      }
    });
  } catch (error) {
    return NextResponse.json(
      { live: false, scenario, mode, runId, error: error instanceof Error ? error.message : "Live demo failed." },
      { status: 502 }
    );
  }
}
