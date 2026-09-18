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


const brokerUrl = process.env.PIGEON_URL || "https://broker.pigeonmq.cc";

async function brokerJson(path: string, init: RequestInit) {
  const response = await fetch(`${brokerUrl}${path}`, { ...init, cache: "no-store" });
  const raw = await response.text();
  let payload: any = null;
  try { payload = JSON.parse(raw); } catch { payload = null; }
  if (!payload) throw new Error(`Broker returned ${response.status} non-JSON response.`);
  return { response, payload };
}

async function runEncryptedMessage(runId: string, mode: string, encryptedMessage: string) {
  const producerToken = process.env.PIGEON_DEMO_TOKEN || "demo-producer-token";
  const consumerToken = process.env.PIGEON_DEMO_RECEIVER_TOKEN || "demo-consumer-token";
  const subject = "demo.message";
  const region = "uk";

  const producerContractResponse = await brokerJson("/v1/contracts", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${producerToken}`, "x-pigeon-region": region },
    body: JSON.stringify({ subjects: [subject] })
  });
  if (!producerContractResponse.response.ok) {
    throw new Error(`Producer contract failed: ${producerContractResponse.response.status} ${JSON.stringify(producerContractResponse.payload)}`);
  }
  const producerContract = producerContractResponse.payload.contract;

  const envelope = {
    subject,
    type: "demo.message.created",
    source: "pigeon-browser-demo",
    intent: "send_demo_message",
    idempotencyKey: `${runId}:message:${mode}`,
    classification: "internal",
    region,
    data: {
      demoRunId: runId,
      message: encryptedMessage,
      ...(mode === "violation" ? { restricted: { secret: "demo-value" } } : {})
    }
  };

  const published = await brokerJson("/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${producerToken}`,
      "x-pigeon-contract": producerContract.id,
      "x-pigeon-region": region
    },
    body: JSON.stringify(envelope)
  });

  const accepted = published.response.ok;
  const errorCode = published.payload?.error?.code || null;
  const decision = accepted ? "allow" : mode === "violation" ? "quarantine" : "deny";
  const failGate = gateFromError(errorCode);

  const consumerContractResponse = await brokerJson("/v1/contracts", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${consumerToken}`, "x-pigeon-region": region },
    body: JSON.stringify({ subjects: [subject] })
  });
  if (!consumerContractResponse.response.ok) {
    throw new Error(`Receiver contract failed: ${consumerContractResponse.response.status} ${JSON.stringify(consumerContractResponse.payload)}`);
  }
  const consumerContract = consumerContractResponse.payload.contract;

  let delivered: any[] = [];
  const attempts = mode === "allow" ? 5 : 1;
  for (let attempt = 0; attempt < attempts && delivered.length === 0; attempt += 1) {
    const received = await brokerJson(`/v1/subjects/${encodeURIComponent(subject)}/receive`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${consumerToken}`,
        "x-pigeon-contract": consumerContract.id,
        "x-pigeon-region": region
      },
      body: JSON.stringify({ max: 50 })
    });
    if (!received.response.ok) throw new Error(`Receive failed: ${received.response.status} ${JSON.stringify(received.payload)}`);
    delivered = (received.payload.messages || []).filter((message: any) => message?.data?.demoRunId === runId);
    if (delivered.length === 0 && attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const gates = ["identity", "intent", "schema", "region", "data", "idempotency"].map((name) => ({
    name,
    pass: accepted || name !== failGate,
    reason: name === failGate ? errorCode : undefined
  }));

  return {
    sender: {
      service: "sender",
      scenario: "message",
      mode,
      runId,
      subject,
      contract: { id: producerContract.id, expiresAt: producerContract.expiresAt },
      message: { id: published.payload?.message?.id || null, subject, idempotencyKey: envelope.idempotencyKey },
      decision,
      errorCode,
      gates,
      brokerStatus: published.response.status
    },
    receiver: {
      service: "receiver",
      scenario: "message",
      mode,
      runId,
      subject,
      contract: { id: consumerContract.id, expiresAt: consumerContract.expiresAt },
      receivedCount: delivered.length,
      delivered,
      proof: mode === "violation"
        ? delivered.length === 0 ? "receiver_did_not_receive_violating_message" : "unexpected_delivery"
        : delivered.length > 0 ? "receiver_received_allowed_message" : "message_not_observed"
    },
    decision,
    gates
  };
}


type DirectScenario = {
  subject: string;
  producerToken: string;
  consumerToken: string;
  intent: string;
  type: string;
  classification: string;
  region: string;
  allowedData: (runId: string) => Record<string, unknown>;
  violatingData: (runId: string) => Record<string, unknown>;
};

function directScenarioConfig(scenario: string): DirectScenario | null {
  if (scenario === "payments") {
    return {
      subject: "payments.authorize",
      producerToken: process.env.PIGEON_PAYMENT_TOKEN || "checkout-token",
      consumerToken: process.env.PIGEON_PAYMENT_RECEIVER_TOKEN || "gateway-token",
      intent: "authorize_payment",
      type: "payment.authorization.requested",
      classification: "pci",
      region: "uk",
      allowedData: (runId) => ({
        demoRunId: runId,
        merchantId: "merchant_demo",
        orderId: `order_${runId}`,
        amount: 73.25,
        currency: "GBP",
        paymentToken: "tok_demo_visa"
      }),
      violatingData: (runId) => ({
        demoRunId: runId,
        merchantId: "merchant_demo",
        orderId: `order_${runId}`,
        amount: 73.25,
        currency: "GBP",
        paymentToken: "tok_demo_visa",
        card: { pan: "4111111111111111" }
      })
    };
  }

  if (scenario === "notifications") {
    return {
      subject: "notifications.send",
      producerToken: process.env.PIGEON_NOTIFICATION_TOKEN || "orders-token",
      consumerToken: process.env.PIGEON_NOTIFICATION_RECEIVER_TOKEN || "notifier-token",
      intent: "send_notification",
      type: "notification.send.requested",
      classification: "pii",
      region: "uk",
      allowedData: (runId) => ({
        demoRunId: runId,
        recipientId: `customer_${runId}`,
        channel: "email",
        templateId: "order-confirmed",
        locale: "en-GB",
        params: { orderRef: runId }
      }),
      violatingData: (runId) => ({
        demoRunId: runId,
        recipientId: `customer_${runId}`,
        channel: "email",
        templateId: "order-confirmed",
        locale: "en-GB",
        params: { orderRef: runId },
        recipient: { ssn: "123-45-6789" }
      })
    };
  }

  return null;
}

async function runDirectScenario(scenario: string, runId: string, mode: string) {
  const config = directScenarioConfig(scenario);
  if (!config) throw new Error(`No direct demo configuration for ${scenario}.`);

  const producerContractResponse = await brokerJson("/v1/contracts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.producerToken}`,
      "x-pigeon-region": config.region
    },
    body: JSON.stringify({ subjects: [config.subject] })
  });
  if (!producerContractResponse.response.ok) {
    throw new Error(`Producer contract failed: ${producerContractResponse.response.status} ${JSON.stringify(producerContractResponse.payload)}`);
  }
  const producerContract = producerContractResponse.payload.contract;

  const data = mode === "allow" ? config.allowedData(runId) : config.violatingData(runId);
  const envelope = {
    subject: config.subject,
    type: config.type,
    source: "pigeon-public-demo",
    intent: config.intent,
    idempotencyKey: `${runId}:${scenario}:${mode}`,
    classification: config.classification,
    region: config.region,
    data
  };

  const published = await brokerJson("/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.producerToken}`,
      "x-pigeon-contract": producerContract.id,
      "x-pigeon-region": config.region
    },
    body: JSON.stringify(envelope)
  });

  const accepted = published.response.ok;
  const errorCode = published.payload?.error?.code || null;
  const decision = accepted ? "allow" : mode === "violation" ? "quarantine" : "deny";
  const failGate = gateFromError(errorCode);
  const gates = ["identity", "intent", "schema", "region", "data", "idempotency"].map((name) => ({
    name,
    pass: accepted || name !== failGate,
    reason: name === failGate ? errorCode : undefined
  }));

  const consumerContractResponse = await brokerJson("/v1/contracts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.consumerToken}`,
      "x-pigeon-region": config.region
    },
    body: JSON.stringify({ subjects: [config.subject] })
  });
  if (!consumerContractResponse.response.ok) {
    throw new Error(`Receiver contract failed: ${consumerContractResponse.response.status} ${JSON.stringify(consumerContractResponse.payload)}`);
  }
  const consumerContract = consumerContractResponse.payload.contract;

  let delivered: any[] = [];
  const attempts = mode === "allow" ? 5 : 1;
  for (let attempt = 0; attempt < attempts && delivered.length === 0; attempt += 1) {
    const received = await brokerJson(`/v1/subjects/${encodeURIComponent(config.subject)}/receive`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.consumerToken}`,
        "x-pigeon-contract": consumerContract.id,
        "x-pigeon-region": config.region
      },
      body: JSON.stringify({ max: 50 })
    });
    if (!received.response.ok) throw new Error(`Receive failed: ${received.response.status} ${JSON.stringify(received.payload)}`);
    delivered = (received.payload.messages || []).filter((message: any) => message?.data?.demoRunId === runId);
    if (delivered.length === 0 && attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return {
    sender: {
      service: "sender",
      scenario,
      mode,
      runId,
      subject: config.subject,
      contract: { id: producerContract.id, expiresAt: producerContract.expiresAt },
      message: {
        id: published.payload?.message?.id || null,
        subject: config.subject,
        idempotencyKey: envelope.idempotencyKey
      },
      decision,
      errorCode,
      gates,
      brokerStatus: published.response.status
    },
    receiver: {
      service: "receiver",
      scenario,
      mode,
      runId,
      subject: config.subject,
      contract: { id: consumerContract.id, expiresAt: consumerContract.expiresAt },
      receivedCount: delivered.length,
      delivered,
      proof: mode === "violation"
        ? delivered.length === 0 ? "receiver_did_not_receive_violating_message" : "unexpected_delivery"
        : delivered.length > 0 ? "receiver_received_allowed_message" : "message_not_observed"
    },
    decision,
    gates
  };
}

function gateFromError(code: string | null) {
  if (!code) return "data";
  if (code.includes("INTENT")) return "intent";
  if (code.includes("SCHEMA")) return "schema";
  if (code.includes("REGION")) return "region";
  if (code.includes("DUPLICATE") || code.includes("IDEMPOT")) return "idempotency";
  if (code.includes("CONTRACT") || code.includes("AUTH")) return "identity";
  return "data";
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
    if (scenario === "message") {
      const encrypted = await runEncryptedMessage(runId, mode, input.encryptedMessage!);
      return NextResponse.json({
        live: true,
        environment: isProduction ? "production" : "development",
        runId,
        scenario,
        mode,
        elapsedMs: Date.now() - startedAt,
        sender: encrypted.sender,
        receiver: encrypted.receiver,
        decision: encrypted.decision,
        contract: encrypted.sender.contract,
        gates: encrypted.gates,
        message: encrypted.sender.message,
        audit: [],
        quarantine: []
      });
    }

    if (scenario === "payments" || scenario === "notifications") {
      const direct = await runDirectScenario(scenario, runId, mode);
      return NextResponse.json({
        live: true,
        environment: isProduction ? "production" : "development",
        runId,
        scenario,
        mode,
        elapsedMs: Date.now() - startedAt,
        sender: direct.sender,
        receiver: direct.receiver,
        decision: direct.decision,
        contract: direct.sender.contract,
        gates: direct.gates,
        message: direct.sender.message,
        audit: [],
        quarantine: []
      });
    }

    const sender = await postJson(senderUrl, { scenario, mode, runId });
    if (sender?.scenario !== scenario || sender?.runId !== runId) {
      return NextResponse.json(
        { live: false, code: "BACKEND_SCENARIO_NOT_DEPLOYED", error: "The live sender is not running the current scenario backend.", scenario, mode, runId },
        { status: 503 }
      );
    }

    const receiver = await postJson(receiverUrl, { scenario, mode, runId, subject: sender.subject });
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
