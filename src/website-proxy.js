// Shared by the hosted landing page and its deployment adapter. All actual
// broker state lives in the Fly service; sender and receiver are separate HTTP
// services. No local success fallback is permitted.
const defaults = {
  broker: "https://pigeon-broker-demo.fly.dev",
  sender: "https://vercel-sender.vercel.app",
  receiver: "https://vercel-receiver-beta.vercel.app"
};
const json = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function proxyDemo(request, urls = defaults) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  try {
    if (path === "/health" || path === "/api/demo/status") {
      if (request.method !== "GET") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } }, 405);
      const services = Object.fromEntries(await Promise.all(Object.entries(urls).map(async ([name, base]) => {
        try { const result = await fetch(base + (name === "broker" ? "/health" : "/api/health"), { signal: AbortSignal.timeout(8000), cache: "no-store" }); return [name, { ok: result.ok, status: result.status }]; }
        catch { return [name, { ok: false, status: 0 }]; }
      })));
      const ok = Object.values(services).every((service) => service.ok);
      return json({ ok, services }, ok ? 200 : 503);
    }
    let body;
    if (request.method === "POST") {
      const content = await request.text();
      if (new TextEncoder().encode(content).length > 8192) return json({ error: { code: "PAYLOAD_TOO_LARGE", message: "The demo accepts small sample messages only." } }, 413);
      try { body = content ? JSON.parse(content) : {}; } catch { return json({ error: { code: "BAD_REQUEST", message: "Invalid JSON." } }, 400); }
    }
    if (path.startsWith("/v1/")) {
      if (!["GET", "POST"].includes(request.method)) return json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or POST." } }, 405);
      const headers = { "content-type": "application/json" };
      for (const name of ["authorization", "x-pigeon-region", "x-pigeon-contract"]) { const value = request.headers.get(name); if (value) headers[name] = value; }
      return relay(await fetch(urls.broker + path + url.search, { method: request.method, headers, body: request.method === "POST" ? JSON.stringify(body ?? {}) : undefined, signal: AbortSignal.timeout(12000), cache: "no-store" }));
    }
    if (path === "/demo/sessions" && request.method === "POST") {
      return relay(await fetch(urls.broker + path, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(12000) }));
    }
    const match = /^\/demo\/sessions\/([a-f0-9-]{36})(\/.*)?$/.exec(path);
    if (!match) return json({ error: { code: "NOT_FOUND", message: "Demo route not found." } }, 404);
    if (!match[2] && request.method === "DELETE") return relay(await fetch(urls.broker + path, { method: "DELETE", signal: AbortSignal.timeout(12000) }));
    const brokerPath = match[2];
    const token = request.headers.get("authorization");
    const receiver = brokerPath?.endsWith("/receive") || brokerPath?.endsWith("/ack") || ["/v1/audit", "/v1/quarantine"].includes(brokerPath) || token === "Bearer gateway-token";
    const service = receiver ? urls.receiver : urls.sender;
    return relay(await fetch(service + "/api/forward", {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ sessionId: match[1], path: brokerPath, method: request.method, body,
        contractId: request.headers.get("x-pigeon-contract"), principal: token === "Bearer catalog-token" ? "catalog" : "checkout" })
    }));
  } catch {
    return json({ error: { code: "DEMO_UNAVAILABLE", message: "The live services could not complete this request. Please try again." } }, 502);
  }
}

async function relay(response) {
  try { return json(await response.json(), response.status); }
  catch { return json({ error: { code: "INVALID_SERVICE_RESPONSE", message: "A demo service returned an unreadable response." } }, 502); }
}
