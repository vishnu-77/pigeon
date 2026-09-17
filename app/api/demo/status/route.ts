import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isProduction = process.env.VERCEL_ENV === "production";

function resolveUrl(envName: string, productionFallback: string) {
  const configured = process.env[envName];
  if (configured) return configured;
  return isProduction ? productionFallback : null;
}

const services = {
  sender: resolveUrl("DEMO_SENDER_HEALTH_URL", "https://sender.pigeonmq.cc/api/health"),
  broker: resolveUrl("DEMO_BROKER_HEALTH_URL", "https://broker.pigeonmq.cc/health"),
  receiver: resolveUrl("DEMO_RECEIVER_HEALTH_URL", "https://receiver.pigeonmq.cc/api/health")
};

async function check(url: string | null) {
  if (!url) return { ok: false, configured: false, status: 0, latencyMs: 0 };

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    return { ok: response.ok, configured: true, status: response.status, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, configured: true, status: 0, latencyMs: Date.now() - started };
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
      environment: isProduction ? "production" : "development",
      services: { sender, broker, receiver },
      checkedAt: new Date().toISOString()
    },
    { headers: { "cache-control": "no-store" } }
  );
}
