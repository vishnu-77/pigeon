export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
  try {
    const result = await fetch(`${process.env.PIGEON_URL || "https://pigeon-broker-demo.fly.dev"}/health`, { signal: AbortSignal.timeout(7000), cache: "no-store" });
    res.setHeader("Cache-Control", "no-store");
    return res.status(result.ok ? 200 : 503).json({ ok: result.ok, service: "pigeon-sender", broker: result.status });
  } catch { return res.status(503).json({ ok: false, service: "pigeon-sender", error: "Broker unavailable" }); }
}
