import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PigeonBroker } from "./broker.js";
import { AuditLog } from "./audit.js";
import { FileStore } from "./file-store.js";
import { createDemoBroker, registerDemoSubjects } from "./subjects.js";
import { isPigeonError, PigeonError } from "./errors.js";

const MAX_BODY_BYTES = 1_048_576; // 1 MiB

const EXAMPLES = join(dirname(fileURLToPath(import.meta.url)), "..", "examples");
const DASHBOARD = readFileSync(join(EXAMPLES, "dashboard.html"), "utf8");
const DOCS = readFileSync(join(EXAMPLES, "docs.html"), "utf8");

// Route table. Path patterns are matched first; a path match with the wrong
// method yields 405 instead of falling through to 404.
const routes = [
  { method: "GET", pattern: /^\/$/, handler: dashboard },
  { method: "GET", pattern: /^\/dashboard$/, handler: dashboard },
  { method: "GET", pattern: /^\/docs$/, handler: docs },
  { method: "GET", pattern: /^\/health$/, handler: health },
  { method: "GET", pattern: /^\/v1\/subjects$/, handler: listSubjects },
  { method: "GET", pattern: /^\/v1\/subjects\/([^/]+)$/, handler: describeSubject },
  { method: "POST", pattern: /^\/v1\/contracts$/, handler: negotiateContract },
  { method: "POST", pattern: /^\/v1\/messages$/, handler: publishMessage },
  { method: "POST", pattern: /^\/v1\/subjects\/([^/]+)\/receive$/, handler: receiveMessages },
  { method: "GET", pattern: /^\/v1\/audit$/, handler: listAudit },
  { method: "GET", pattern: /^\/v1\/quarantine$/, handler: listQuarantine },
  { method: "POST", pattern: /^\/v1\/quarantine\/([^/]+)\/release$/, handler: releaseQuarantine }
];

export function createPigeonServer(broker = createDemoBroker(PigeonBroker)) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
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
      await route.handler({ request, response, url, broker, params });
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
}

function dashboard({ response }) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(DASHBOARD);
}

function docs({ response }) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(DOCS);
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

// Identity is resolved server-side from the bearer credential and bound to the
// request context. A client-supplied principal is never trusted (FND-01).
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
  if (response.writableEnded) {
    return;
  }
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body, null, 2));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new PigeonError("PAYLOAD_TOO_LARGE", `Request body exceeds ${MAX_BODY_BYTES} bytes.`);
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PigeonError("BAD_REQUEST", "Request body is not valid JSON.");
  }
}

// When PIGEON_DATA_DIR is set, back the broker with a durable append-only store and
// a durable, hash-chained audit log so state and evidence survive restarts (FND-03/05).
export function createDemoBrokerForEnv() {
  const dataDir = process.env.PIGEON_DATA_DIR;
  if (!dataDir) {
    return createDemoBroker(PigeonBroker);
  }
  const broker = new PigeonBroker({
    store: new FileStore({ path: join(dataDir, "messages.log") }),
    audit: new AuditLog({ path: join(dataDir, "audit.log") })
  });
  return registerDemoSubjects(broker);
}

// Start the server only when this file is run directly (not when imported by tests).
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
