#!/usr/bin/env node
// Pigeon CLI (FND-13).
//
//   pigeon demo                       run the in-process governed walkthrough
//   pigeon broker start               start the HTTP broker (honors PORT, PIGEON_DATA_DIR)
//   pigeon policy lint [dir]          lint a policy catalog (default: ./policies)
//   pigeon publish <subject> ...      publish to a running broker over HTTP
//   pigeon quarantine                 list the running broker's quarantine
//
// HTTP verbs talk to PIGEON_URL (default http://localhost:8787) and authenticate with
// --token (or PIGEON_TOKEN), negotiating a session contract first.

import { PigeonBroker } from "./broker.js";
import { createPaymentBroker } from "./subjects.js";
import { loadCatalog, lintCatalog } from "./policy-loader.js";

const [command, subcommand, ...rest] = process.argv.slice(2);
const url = process.env.PIGEON_URL ?? "http://localhost:8787";

try {
  await run(command, subcommand, rest);
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}

async function run(command, subcommand, rest) {
  if (command === "demo") return demo();
  if (command === "broker" && subcommand === "start") return brokerStart();
  if (command === "policy" && subcommand === "lint") return policyLint(rest[0] ?? "policies");
  if (command === "publish") return publish(subcommand, rest);
  if (command === "quarantine") return quarantine();
  usage();
}

function usage() {
  console.log([
    "Usage:",
    "  pigeon demo",
    "  pigeon broker start",
    "  pigeon policy lint [dir]",
    "  pigeon publish <subject> --token <t> --intent <i> --data '<json>' [--idempotency-key <k>] [--classification <c>] [--region <r>]",
    "  pigeon quarantine"
  ].join("\n"));
}

function demo() {
  const broker = createPaymentBroker(PigeonBroker);
  const checkout = { principal: { id: "spiffe://merchant-prod/ns/checkout/sa/checkout-api" }, region: "uk" };
  const gateway = { principal: { id: "spiffe://merchant-prod/ns/payments/sa/gateway-adapter" }, region: "uk" };

  const session = broker.connect(checkout, { subjects: ["payments.authorize"] });
  const publishResult = session.request("payments.authorize", {
    merchantId: "merchant_123", orderId: "order_456", amount: 42.5, currency: "GBP", paymentToken: "tok_visa_abc"
  }, { intent: "authorize_payment", idempotencyKey: "order_456:authorize", classification: "pci", region: "uk" });

  const received = broker.connect(gateway, { subjects: ["payments.authorize"] }).receive("payments.authorize", { max: 10 });
  console.log(JSON.stringify({ contract: session.contract.id, publish: publishResult, received, audit: broker.listAudit() }, null, 2));
}

async function brokerStart() {
  const { createPigeonServer, createDemoBrokerForEnv } = await import("./server.js");
  const port = Number(process.env.PORT ?? 8787);
  const server = createPigeonServer(createDemoBrokerForEnv());
  server.listen(port, () => console.log(`Pigeon broker listening on http://localhost:${port}`));
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
}

function policyLint(dir) {
  const catalog = loadCatalog(dir);
  const { errors, warnings } = lintCatalog(catalog);
  for (const warning of warnings) console.log(`warn:  ${warning}`);
  for (const error of errors) console.log(`error: ${error}`);
  const subjects = catalog.subjects.length;
  const schemas = Object.keys(catalog.schemas).length;
  console.log(`\nlinted ${subjects} subject(s), ${schemas} schema(s): ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length > 0) process.exit(1);
}

async function publish(subject, rest) {
  if (!subject) throw new Error("publish requires a <subject>");
  const flags = parseFlags(rest);
  const token = flags.token ?? process.env.PIGEON_TOKEN;
  if (!token) throw new Error("publish requires --token (or PIGEON_TOKEN)");
  const region = flags.region ?? "uk";

  const contract = await postJson("/v1/contracts", { subjects: [subject] }, { token, region });
  const contractId = contract.contract.id;

  const body = {
    subject,
    type: flags.type ?? `${subject}.request`,
    source: "cli",
    intent: flags.intent,
    idempotencyKey: flags["idempotency-key"],
    classification: flags.classification,
    region,
    data: flags.data ? JSON.parse(flags.data) : {}
  };
  const result = await postJson("/v1/messages", body, { token, region, contractId });
  console.log(JSON.stringify(result, null, 2));
}

async function quarantine() {
  const response = await fetch(`${url}/v1/quarantine`);
  const payload = await response.json();
  console.log(JSON.stringify(payload, null, 2));
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      flags[key] = args[i + 1];
      i += 1;
    }
  }
  return flags;
}

async function postJson(path, body, { token, region, contractId }) {
  const headers = { "content-type": "application/json", "x-pigeon-region": region };
  if (token) headers.authorization = `Bearer ${token}`;
  if (contractId) headers["x-pigeon-contract"] = contractId;
  const response = await fetch(`${url}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${JSON.stringify(payload.error ?? payload)}`);
  }
  return payload;
}
