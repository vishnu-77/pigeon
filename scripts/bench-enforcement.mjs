// Enforcement-overhead benchmark (FND-10).
//
// Pigeon does not claim to beat Kafka/NATS on raw throughput. Its honest metric is
// the cost of *governance*: how many microseconds contract validation + the policy
// gates + schema validation + audit add per message. This measures exactly that on
// the in-memory hot path.
//
// Run:  npm run bench
//
// Zero runtime dependencies - node stdlib only (performance.now).

import { performance } from "node:perf_hooks";
import { PigeonBroker } from "../src/broker.js";
import { paymentAuthorizationSchema, paymentsAuthorizeSubject, DEMO_PRINCIPALS } from "../src/subjects.js";

const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 50_000);
const WARMUP = Math.min(5_000, ITERATIONS);

function newBroker() {
  const broker = new PigeonBroker();
  broker.registerSchema("payment.authorization.v1", paymentAuthorizationSchema);
  broker.registerSubject(paymentsAuthorizeSubject);
  broker.registerToken("checkout-token", DEMO_PRINCIPALS.checkout);
  return broker;
}

const checkout = { principal: DEMO_PRINCIPALS.checkout, region: "uk" };

function bench(label, iterations, fn) {
  for (let i = 0; i < WARMUP; i += 1) fn(i);
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) fn(i);
  const elapsedMs = performance.now() - start;
  const perOpUs = (elapsedMs * 1000) / iterations;
  const opsPerSec = Math.round(iterations / (elapsedMs / 1000));
  console.log(
    `  ${label.padEnd(42)} ${perOpUs.toFixed(2).padStart(8)} us/op   ${opsPerSec.toLocaleString().padStart(12)} ops/s`
  );
  return perOpUs;
}

function payment(i) {
  return { merchantId: "m", orderId: `order_${i}`, amount: 10, currency: "GBP", paymentToken: "tok" };
}

console.log(`\nPigeon enforcement overhead  (${ITERATIONS.toLocaleString()} iterations, in-memory)\n`);

// Contract negotiation cost.
const negotiateBroker = newBroker();
bench("contract negotiation", ITERATIONS, () => {
  negotiateBroker.negotiate(checkout, { subjects: ["payments.authorize"] });
});

// Full-enforcement publish: contract validate + policy + region + classification +
// forbidden-fields + schema + idempotency + audit. Unique idempotency keys so every
// message is a real accept (not a dedupe short-circuit).
const publishBroker = newBroker();
const publishContract = publishBroker.negotiate(checkout, { subjects: ["payments.authorize"], ttlMs: 10 ** 15 });
const publishContext = { principal: DEMO_PRINCIPALS.checkout, region: "uk", contractId: publishContract.id };
bench("publish (full governance + audit)", ITERATIONS, (i) => {
  publishBroker.publish({
    subject: "payments.authorize",
    type: "payment.authorization.requested",
    source: "ignored",
    intent: "authorize_payment",
    idempotencyKey: `bench_${i}`,
    classification: "pci",
    region: "uk",
    data: payment(i)
  }, publishContext);
});

console.log("\nInterpretation: the numbers above are the price of governance per message");
console.log("on a single in-memory node - what Pigeon adds on top of moving bytes.\n");
