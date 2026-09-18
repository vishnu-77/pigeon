import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const services = {
  sender: process.env.DEMO_SENDER_HEALTH_URL || "https://sender.pigeonmq.cc/api/health",
  broker: process.env.DEMO_BROKER_HEALTH_URL || `${(process.env.DEMO_BROKER_URL || "https://pigeon-broker-demo.fly.dev").replace(/\/$/, "")}/health`,
  receiver: process.env.DEMO_RECEIVER_HEALTH_URL || "https://receiver.pigeonmq.cc/api/health"
};

async function check(url: string) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    return { ok: response.ok, status: response.status, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, status: 0, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const [sender, broker, receiver] = await Promise.all([
    check(services.sender),
    check(services.broker),
    check(services.receiver)
  ]);

  return NextResponse.json(
    {
      ok: sender.ok && broker.ok && receiver.ok,
      services: { sender, broker, receiver },
      checkedAt: new Date().toISOString()
    },
    { headers: { "cache-control": "no-store" } }
  );
}
