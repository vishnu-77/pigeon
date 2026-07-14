import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PigeonBroker } from "../src/index.js";
import { createDemoBroker } from "../src/subjects.js";
import { createPigeonServer } from "../src/server.js";
import { PigeonClient, PigeonClientError } from "../sdk/typescript/pigeon-client.mjs";

let server;
let url;

before(async () => {
  server = createPigeonServer(createDemoBroker(PigeonBroker));
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

after(() => server.close());

const payment = { merchantId: "m", orderId: "o1", amount: 10, currency: "GBP", paymentToken: "tok" };
const options = { intent: "authorize_payment", idempotencyKey: "sdk:o1", classification: "pci", region: "uk" };

test("SDK runs the payment demo end to end", async () => {
  const checkout = new PigeonClient({ url, token: "checkout-token" });
  await checkout.connect(["payments.authorize"]);
  const result = await checkout.request("payments.authorize", payment, options);
  assert.equal(result.status, "accepted");

  const gateway = new PigeonClient({ url, token: "gateway-token" });
  await gateway.connect(["payments.authorize"]);
  const messages = await gateway.receive("payments.authorize", { max: 10 });
  assert.ok(messages.length >= 1);
});

test("SDK surfaces the denial path as a typed error", async () => {
  const attacker = new PigeonClient({ url, token: "catalog-token" });
  await assert.rejects(
    () => attacker.connect(["payments.authorize"]),
    (error) => error instanceof PigeonClientError && error.code === "NO_PERMITTED_SUBJECTS" && error.status === 403
  );
});

test("SDK requires a contract before publishing", async () => {
  const client = new PigeonClient({ url, token: "checkout-token" });
  await assert.rejects(
    () => client.request("payments.authorize", payment, options),
    (error) => error instanceof PigeonClientError && error.code === "CONTRACT_REQUIRED"
  );
});
