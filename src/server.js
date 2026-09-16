import http from "node:http";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { PigeonBroker } from "./broker.js";
import { AuditLog } from "./audit.js";
import { FileStore } from "./file-store.js";
import { createDemoBroker, registerDemoSubjects, registerPublicDemoSubject } from "./subjects.js";
import { isPigeonError, PigeonError } from "./errors.js";
import { DemoSessions } from "./demo-sessions.js";

const MAX_BODY_BYTES = 1_048_576;

// Routes an isolated visitor demo session may call, in addition to the
// live subject receive/ack paths matched below.
const DEMO_ROUTES = new Set(["/v1/contracts", "/v1/messages", "/v1/subjects", "/v1/audit", "/v1/quarantine"]);
const DEMO_SUBJECT_ROUTE = /^\/v1\/subjects\/(?:payments\.authorize|demo\.message)(?:\/receive|\/messages\/[^/]+\/ack)?$/;

const routes = [
  { method: "GET", pattern: /^\/$/, handler: serviceInfo },
  { method: "GET", pattern: /^\/health$/, handler: health },
  { method: "GET", pattern: /^\/v1\/subjects$/, handler: listSubjects },
  { method: "GET", pattern: /^\/v1\/subjects\/([^/]+)$/, handler: describeSubject },
  { method: "POST", pattern: /^\/v1\/contracts$/, handler: negotiateContract },
  { method: "POST", pattern: /^\/v1\/messages$/, handler: publishMessage },
  { method: "POST", pattern: /^\/v1\/subjects\/([^/]+)\/receive$/, handler: receiveMessages },
  { method: "POST", pattern: /^\/v1\/subjects\/([^/]+)\/messages\/([^/]+)\/ack$/, handler: acknowledgeMessage },
  { method: "GET", pattern: /^\/v1\/audit$/, handler: listAudit },
  { method: "GET", pattern: /^\/v1\/quarantine$/, handler: listQuarantine },
  { method: "POST", pattern: /^\/v1\/quarantine\/([^/]+)\/release$/, handler: releaseQuarantine }
];

export function createPigeonServer(broker = createDemoBroker(PigeonBroker), { demoSessions = new DemoSessions() } = {}) {
  const cleanup = setInterval(() => demoSessions.sweep(), 60_000);
  cleanup.unref();
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
      if (url.pathname === "/demo/sessions") {
        request.pigeonBodyLimit = 8192;
        if (request.method !== "POST") return send(response, 405, errorBody("METHOD_NOT_ALLOWED", "Use POST."));
        await readJson(request);
        response.setHeader("cache-control", "no-store");
        return send(response, 201, { session: demoSessions.create() });
      }
      let activeBroker = broker;
      const demo = /^\/demo\/sessions\/([a-f0-9-]{36})(\/.*)?$/.exec(url.pathname);
      if (demo) {
        request.pigeonBodyLimit = 8192;
        response.setHeader("cache-control", "no-store");
        if (!demo[2] && request.method === "DELETE") {
          demoSessions.remove(demo[1]);
          return send(response, 200, { deleted: true });
        }
        const path = demo[2] ?? "";
        if (!DEMO_ROUTES.has(path) && !DEMO_SUBJECT_ROUTE.test(path)) {
          return send(response, 404, errorBody("NOT_FOUND", "Demo route not found."));
        }
        activeBroker = demoSessions.get(demo[1]);
        url.pathname = path;
      }
      const pathMatched = routes.filter((route) => route.pattern.test(url.pathname));

      if (pathMatched.length === 0) {
        return send(response, 404, errorBody("NOT_FOUND", "Route not found."));
      }

      const route = pathMatched.find((candidate) => candidate.method === request.method);
      if (!route) {
        const allow = pathMatched.map((candidate) => candidate.method).join(", ");
        response.setHeader("allow", allow);
        throw new PigeonError("METHOD_NOT_ALLOWED", `${request.method} not allowed on ${url.pathname}.`, { allow });
      }

      const params = url.pathname.match(route.pattern).slice(1).map(decodeURIComponent);
      await route.handler({ request, response, url, broker: activeBroker, params });
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
  server.on("close", () => clearInterval(cleanup));
  return server;
}

function serviceInfo({ response }) {
  send(response, 200, {
    service: "pigeon",
    description: "contract-native message broker",
    protocol: "pigeon.v1",
    contractRequired: true,
    endpoints: {
      health: "/health",
      subjects: "/v1/subjects",
      contracts: "/v1/contracts",
      messages: "/v1/messages",
      audit: "/v1/audit",
      quarantine: "/v1/quarantine"
    }
  });
}

function health({ response }) {
  send(response, 200, { ok: true, service: "pigeon" });
}

function listSubjects({ response, broker }) {
  const subjects = broker.listSubjects().map(subjectSummary);
  send(response, 200, { subjects });
}

function describeSubject({ response, broker, params }) {
  const subject = broker.getSubject(params[0]);
  send(response, 200, { subject });
}

async function negotiateContract({ request, response, broker }) {
  const body = await readJson(request);
  const context = contextFromAuth(request, broker);
  const contract = broker.negotiate(context, { subjects: body.subjects, ttlMs: body.ttlMs });
  send(response, 201, { contract });
}

async function publishMessage({ request, response, broker }) {
  const body = await readJson(request);
  const context = contextFromAuth(request, broker);
  if (body.contractId) context.contractId = body.contractId;
  const result = broker.publish(body, context);
  send(response, result.status === "duplicate" ? 200 : 202, result);
}

async function receiveMessages({ request, response, broker, params }) {
  const body = await readJson(request);
  const context = contextFromAuth(request, broker);
  if (body.contractId) context.contractId = body.contractId;
  const messages = broker.receive(params[0], context, { max: body.max ?? 1 });
  send(response, 200, { messages });
}

async function releaseQuarantine({ request, response, broker, params }) {
  const body = await readJson(request);
  const context = contextFromAuth(request, broker);
  if (body.contractId) context.contractId = body.contractId;
  const result = broker.releaseQuarantine(params[0], context);
  send(response, 202, result);
}

async function acknowledgeMessage({ request, response, broker, params }) {
  const body = await readJson(request);
  const context = contextFromAuth(request, broker);
  if (body.contractId) context.contractId = body.contractId;
  const message = broker.ack(params[0], params[1], context);
  send(response, 200, { status: "acked", message });
}

function listAudit({ response, broker }) {
  send(response, 200, { records: broker.listAudit() });
}

function listQuarantine({ response, broker }) {
  send(response, 200, { records: broker.listQuarantine() });
}

function subjectSummary(subject) {
  return {
    name: subject.name,
    mode: subject.mode,
    intents: subject.intents,
    classification: subject.data?.classification ?? null,
    regions: subject.regionPolicy?.allowedRegions ?? [],
    idempotencyRequired: Boolean(subject.delivery?.idempotency?.required),
    replayAllowed: Boolean(subject.replay?.allowed)
  };
}

function contextFromAuth(request, broker) {
  return {
    principal: broker.authenticate(request.headers["authorization"]),
    region: request.headers["x-pigeon-region"] ?? "uk",
    contractId: request.headers["x-pigeon-contract"] ?? null
  };
}

function statusFor(code) {
  return {
    UNAUTHENTICATED: 401,
    POLICY_DENIED: 403,
    REPLAY_DENIED: 403,
    REGION_DENIED: 403,
    INTENT_DENIED: 403,
    CONTRACT_REQUIRED: 403,
    CONTRACT_NOT_FOUND: 403,
    CONTRACT_EXPIRED: 403,
    CONTRACT_PRINCIPAL_MISMATCH: 403,
    SUBJECT_NOT_IN_CONTRACT: 403,
    OPERATION_NOT_IN_CONTRACT: 403,
    NO_PERMITTED_SUBJECTS: 403,
    RATE_LIMITED: 429,
    SENSITIVE_FIELD_DENIED: 422,
    RAW_PAN_DETECTED: 422,
    IDEMPOTENCY_REQUIRED: 422,
    CLASSIFICATION_DENIED: 422,
    ENVELOPE_INVALID: 422,
    SCHEMA_INVALID: 422,
    SCHEMA_NOT_FOUND: 500,
    SUBJECT_NOT_FOUND: 404,
    MESSAGE_NOT_FOUND: 404,
    MESSAGE_NOT_DELIVERED: 409,
    DEMO_EXPIRED: 410,
    QUARANTINE_NOT_FOUND: 404,
    BAD_REQUEST: 400,
    PAYLOAD_TOO_LARGE: 413,
    METHOD_NOT_ALLOWED: 405
  }[code] ?? 500;
}

function errorBody(code, message, details = {}) {
  return { error: { code, message, details } };
}

function send(response, status, body) {
  if (response.writableEnded) return;
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body, null, 2));
}

async function readJson(request) {
  const maxBytes = request.pigeonBodyLimit ?? MAX_BODY_BYTES;
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new PigeonError("PAYLOAD_TOO_LARGE", `Request body exceeds ${maxBytes} bytes.`);
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PigeonError("BAD_REQUEST", "Request body is not valid JSON.");
  }
}

export function createDemoBrokerForEnv() {
  const dataDir = process.env.PIGEON_DATA_DIR;
  if (!dataDir) {
    return registerPublicDemoSubject(createDemoBroker(PigeonBroker));
  }
  const broker = new PigeonBroker({
    store: new FileStore({ path: join(dataDir, "messages.log") }),
    audit: new AuditLog({ path: join(dataDir, "audit.log") })
  });
  registerDemoSubjects(broker);
  return registerPublicDemoSubject(broker);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 8787);
  const server = createPigeonServer(createDemoBrokerForEnv());
  server.listen(port, () => {
    console.log(`Pigeon broker listening on http://localhost:${port}`);
  });
  process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
  });
}
