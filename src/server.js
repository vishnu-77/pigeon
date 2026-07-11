import http from "node:http";
import { PigeonBroker } from "./broker.js";
import { createPaymentBroker } from "./subjects.js";
import { isPigeonError } from "./errors.js";

const broker = createPaymentBroker(PigeonBroker);
const port = Number(process.env.PORT ?? 8787);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      return send(response, 200, { ok: true, service: "pigeon" });
    }

    if (request.method === "POST" && url.pathname === "/v1/messages") {
      const body = await readJson(request);
      const result = broker.publish(body, contextFromHeaders(request));
      return send(response, result.status === "duplicate" ? 200 : 202, result);
    }

    if (request.method === "POST" && url.pathname.match(/^\/v1\/subjects\/[^/]+\/receive$/)) {
      const subject = decodeURIComponent(url.pathname.split("/")[3]);
      const body = await readJson(request);
      const messages = broker.receive(subject, contextFromHeaders(request), { max: body.max ?? 1 });
      return send(response, 200, { messages });
    }

    if (request.method === "GET" && url.pathname === "/v1/audit") {
      return send(response, 200, { records: broker.listAudit() });
    }

    if (request.method === "GET" && url.pathname === "/v1/quarantine") {
      return send(response, 200, { records: broker.listQuarantine() });
    }

    send(response, 404, { error: { code: "NOT_FOUND", message: "Route not found." } });
  } catch (error) {
    const status = isPigeonError(error) ? statusFor(error.code) : 500;
    send(response, status, {
      error: {
        code: isPigeonError(error) ? error.code : "INTERNAL_ERROR",
        message: error.message,
        details: error.details ?? {}
      }
    });
  }
});

server.listen(port, () => {
  console.log(`Pigeon broker listening on http://localhost:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

function contextFromHeaders(request) {
  return {
    principal: {
      id: request.headers["x-pigeon-principal"] ?? "anonymous",
      attributes: {}
    },
    region: request.headers["x-pigeon-region"] ?? "uk"
  };
}

function statusFor(code) {
  return {
    POLICY_DENIED: 403,
    REPLAY_DENIED: 403,
    REGION_DENIED: 403,
    INTENT_DENIED: 403,
    SENSITIVE_FIELD_DENIED: 422,
    IDEMPOTENCY_REQUIRED: 422,
    SCHEMA_INVALID: 422,
    SCHEMA_NOT_FOUND: 500,
    SUBJECT_NOT_FOUND: 404,
    MESSAGE_NOT_FOUND: 404
  }[code] ?? 500;
}

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body, null, 2));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
