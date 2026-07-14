# Pigeon client SDK (TypeScript / ESM)

A small, dependency-free client for the Pigeon HTTP broker. It authenticates with a
bearer token, negotiates a session contract, and runs `publish` / `receive` / `request`
under it - surfacing policy denials as typed `PigeonClientError`s.

Ships as ESM (`pigeon-client.mjs`) with type declarations (`pigeon-client.d.ts`), so it
is consumable from TypeScript without a build step. Runs anywhere `fetch` exists
(Node >= 18, browsers).

## Usage

```js
import { PigeonClient, PigeonClientError } from "./pigeon-client.mjs";

const client = new PigeonClient({ url: "http://localhost:8787", token: "checkout-token" });

// Authenticate + negotiate a session contract.
await client.connect(["payments.authorize"]);

try {
  const { status, message } = await client.request("payments.authorize", {
    merchantId: "m", orderId: "o1", amount: 10, currency: "GBP", paymentToken: "tok"
  }, { intent: "authorize_payment", idempotencyKey: "o1:auth", classification: "pci", region: "uk" });
  console.log(status, message.id);
} catch (error) {
  if (error instanceof PigeonClientError) {
    console.error(`denied: ${error.code} (${error.status}) - ${error.message}`);
  } else {
    throw error;
  }
}
```

An unauthorized principal is denied at `connect()` - no contract is ever issued:

```js
const attacker = new PigeonClient({ url, token: "catalog-token" });
await attacker.connect(["payments.authorize"]); // throws PigeonClientError NO_PERMITTED_SUBJECTS
```

## API

| Method | Description |
| --- | --- |
| `connect(subjects, { ttlMs? })` | Authenticate and negotiate a session contract. |
| `publish(message)` | Publish a full envelope under the contract. |
| `request(subject, data, options)` | Convenience wrapper that builds the envelope. |
| `receive(subject, { max })` | Pull authorized messages. |
| `subjects()` / `quarantine()` | Read the subject catalog / quarantine. |

Errors are `PigeonClientError` with `.code`, `.status`, and `.details`.
