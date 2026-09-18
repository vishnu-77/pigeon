const RECEIVE_TOKENS = { "payments.authorize": "gateway-token", "demo.message": "demo-consumer-token" };
const RECEIVE_PATH = /^\/v1\/subjects\/([^/]+)\/(?:receive|messages\/[a-z0-9_-]+\/ack)$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
  const { sessionId, path, method, body, contractId } = req.body ?? {};
  const receiveSubject = RECEIVE_PATH.exec(path)?.[1];
  const allowed = (method === "POST" && (path === "/v1/contracts" || (receiveSubject && RECEIVE_TOKENS[receiveSubject]))) ||
    (method === "GET" && ["/v1/audit", "/v1/quarantine"].includes(path));
  if (!/^[a-f0-9-]{36}$/.test(sessionId ?? "") || !allowed || JSON.stringify(req.body).length > 8192) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid receiver operation." } });
  }
  try {
    const headers = { "content-type": "application/json", "x-pigeon-region": "uk", authorization: `Bearer ${receiveSubject ? RECEIVE_TOKENS[receiveSubject] : "gateway-token"}` };
    if (contractId) headers["x-pigeon-contract"] = contractId;
    const response = await fetch(`${process.env.PIGEON_URL || "https://pigeon-broker-demo.fly.dev"}/demo/sessions/${sessionId}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000), cache: "no-store"
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(response.status).json(await response.json());
  } catch { return res.status(502).json({ error: { code: "BROKER_UNAVAILABLE", message: "The receiver could not reach the broker." } }); }
}
