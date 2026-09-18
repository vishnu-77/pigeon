const PRINCIPAL_TOKENS = { checkout: "checkout-token", catalog: "catalog-token", "demo-producer": "demo-producer-token" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
  const { sessionId, path, method, body, contractId, principal = "checkout" } = req.body ?? {};
  const allowed = (method === "POST" && ["/v1/contracts", "/v1/messages"].includes(path)) ||
    (method === "GET" && path === "/v1/subjects/payments.authorize");
  if (!/^[a-f0-9-]{36}$/.test(sessionId ?? "") || !allowed || !PRINCIPAL_TOKENS[principal] || JSON.stringify(req.body).length > 8192) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid sender operation." } });
  }
  try {
    const headers = { "content-type": "application/json", "x-pigeon-region": "uk", authorization: `Bearer ${PRINCIPAL_TOKENS[principal]}` };
    if (contractId) headers["x-pigeon-contract"] = contractId;
    const response = await fetch(`${process.env.PIGEON_URL || "https://pigeon-broker-demo.fly.dev"}/demo/sessions/${sessionId}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000), cache: "no-store"
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(response.status).json(await response.json());
  } catch { return res.status(502).json({ error: { code: "BROKER_UNAVAILABLE", message: "The sender could not reach the broker." } }); }
}
