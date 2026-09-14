<div align="center">

<img src="https://raw.githubusercontent.com/vishnu-77/pigeon/main/assets/pigeon-banner.svg" alt="Pigeon" width="100%">

### Pigeon: contract-native messaging

**Every message runs under a communication contract.**

<a href="https://www.npmjs.com/package/pigeonmq">npm</a> · <a href="https://github.com/vishnu-77/pigeon/tree/main/sdk/python">Python SDK</a> · <a href="https://github.com/vishnu-77/pigeon/tree/main/sdk/rust">Rust SDK</a> · <a href="https://github.com/vishnu-77/pigeon/tree/website">Website source</a> · <a href="https://github.com/vishnu-77/pigeon/issues">Issues</a>

[![npm](https://img.shields.io/npm/v/pigeonmq.svg?style=flat-square&labelColor=171512&color=A64B36)](https://www.npmjs.com/package/pigeonmq)
[![CI](https://img.shields.io/github/actions/workflow/status/vishnu-77/pigeon/ci.yml?branch=main&style=flat-square&labelColor=171512&label=CI)](https://github.com/vishnu-77/pigeon/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/Node-22%20%7C%2024-F7F3EA?style=flat-square&labelColor=171512)](package.json)
[![Python SDK](https://img.shields.io/badge/Python-SDK-F7F3EA?style=flat-square&labelColor=171512)](sdk/python/)
[![Rust SDK](https://img.shields.io/badge/Rust-SDK-F7F3EA?style=flat-square&labelColor=171512)](sdk/rust/)
[![License](https://img.shields.io/badge/license-Apache--2.0-white?style=flat-square&labelColor=171512)](LICENSE)

</div>

---

## What is Pigeon?

Pigeon is a **contract-native message broker**. A service authenticates, negotiates what it may communicate, and then publishes or receives messages inside that short-lived runtime contract.

The contract binds an authenticated principal to permitted subjects and operations. Every message is then checked for identity, intent, schema, region, classification, sensitive data and idempotency **before it is routed or delivered**.

```text
principal
    │
    │ negotiate
    ▼
communication contract
    │
    │ message
    ▼
identity → intent → schema → region → data → idempotency
                                              │
                         ┌────────────────────┼────────────────────┐
                         ▼                    ▼                    ▼
                       ALLOW                 DENY             QUARANTINE
```

Pigeon is early-stage infrastructure and research software. The broker path works and is tested; it is not yet a production replacement for a distributed Kafka/NATS/RabbitMQ deployment.

## Why Pigeon?

- **Messages carry intent.** Topic permission tells you where a producer may publish, not why this particular communication should happen.
- **Communication is contextual.** An authorised publisher can still violate schema, residency, classification or data constraints.
- **Authority can expire.** Pigeon compiles permitted communication into session-scoped contracts instead of assuming indefinite publishing authority.
- **Violations become evidence.** Invalid communication can be denied or quarantined and recorded in the audit chain before a receiver processes it.

The research question behind Pigeon is simple: **can communication authority become a runtime primitive of the broker rather than an external policy check?**

## Quick start

Requires Node.js 22 or newer.

```bash
npm install pigeonmq
npx pigeon broker start
```

In another terminal:

```js
import { PigeonClient } from "pigeonmq";

const pigeon = new PigeonClient({
  url: "http://localhost:8787",
  token: "checkout-token"
});

await pigeon.connect(["payments.authorize"]);

const result = await pigeon.request(
  "payments.authorize",
  {
    merchantId: "m",
    orderId: "order_42",
    amount: 42.5,
    currency: "GBP",
    paymentToken: "tok"
  },
  {
    intent: "authorize_payment",
    idempotencyKey: "order_42:authorize",
    classification: "pci",
    region: "uk"
  }
);

console.log(result.status); // accepted
```

Or see the governed flow without writing code:

```bash
npm run demo
```

## Use Pigeon from your stack

The broker exposes **Pigeon Protocol v1 over HTTP**. Official clients share the same contract negotiation and error semantics.

| Runtime | Client | Current distribution |
|---|---|---|
| Node.js / TypeScript | `PigeonClient` exported from `pigeonmq` | npm |
| Python 3.10+ | [`sdk/python`](sdk/python/) | in-tree; PyPI manifest ready |
| Rust stable | [`sdk/rust`](sdk/rust/) | in-tree; crates.io manifest ready |
| Any language | HTTP API | native protocol |

Python and Rust registry publication will follow conformance validation; the repository clients are already tested against a real broker in CI.

## See the contract fail

A successful message is useful. A blocked one explains why Pigeon exists.

```text
checkout-api
    │
    ▼
CTR_0182
payments.authorize
intent = authorize_payment
region = uk
data = pci
    │
    ▼
MSG_1049

identity        ✓
intent          ✓
schema          ✓
region          ✓
data             ✕  card.pan is forbidden

          QUARANTINED

receiver never receives MSG_1049
```

The repository demo includes authorised communication, duplicate suppression, unauthorised producers and sensitive-field quarantine.

## How it works

### 1. Negotiate

An authenticated principal asks for the subjects it needs. Pigeon evaluates subject policy once and compiles the permitted subset into a runtime session contract.

```text
authenticated principal + requested subjects + policy
                         ↓
              communication contract
```

### 2. Communicate

Every publish, receive, replay and acknowledgement executes under that contract. Identity is resolved server-side and never trusted from a message field.

### 3. Enforce

Accepted messages pass an ordered gate chain:

```text
identity → intent → schema → region → sensitivity → idempotency → append → audit
```

### 4. Decide

The broker can **allow**, **deny** or **quarantine** before routing. Audit evidence records the resulting decision.

## Communication contracts

A contract captures the authority negotiated for one authenticated principal and session, including:

- subject and policy identity
- allowed operations
- schema binding
- expiry
- principal binding

The contract narrows communication authority; it does not let the client invent identity or permissions.

## Pigeon Protocol v1

Pigeon intentionally keeps the broker and client ecosystems separate. The Node broker is the canonical implementation today; Python and Rust are clients of the same HTTP protocol rather than separate broker implementations.

Core protocol objects:

```text
Principal
CommunicationContract
MessageEnvelope
Decision
QuarantineRecord
AuditEvent
```

See [`docs/mvp-architecture.md`](docs/mvp-architecture.md), [`docs/flows.md`](docs/flows.md) and the ADRs under [`docs/adr/`](docs/adr/) for the current model.

## CLI

| Command | Purpose |
|---|---|
| `pigeon demo` | Run the governed in-process walkthrough |
| `pigeon broker start` | Start the HTTP broker |
| `pigeon policy lint [dir]` | Lint a policy catalog |
| `pigeon publish <subject> ...` | Negotiate a contract and publish over HTTP |
| `pigeon quarantine` | Inspect quarantined communication |

## Research

Pigeon explores **runtime communication contracts for governed asynchronous systems**.

Current questions include:

1. Can policy be compiled outside the per-message hot path while preserving contextual enforcement?
2. Can message authority include intent, region and data classification without becoming an unbounded policy language?
3. Can rejected communication become reproducible audit evidence rather than merely an application error?
4. What is the enforcement overhead of contract-native messaging?
5. How should contracts be revoked, replicated and reconciled in a distributed broker?

Run the current enforcement benchmark with:

```bash
npm run bench
```

## Current status

**Shipped now**

- policy-compiled session contracts
- server-side identity binding
- publish / receive / replay / ack
- identity, intent, region, classification, sensitive-field and schema gates
- idempotency and duplicate suppression
- rate limiting
- quarantine
- hash-chained audit log
- append-only single-node durable store
- HTTP API and CLI
- JavaScript, Python and Rust clients
- cross-language integration CI
- enforcement benchmark

**Accepted current limits**

- single-node broker/storage model
- static demo bearer credentials; production identity needs mTLS/SPIFFE/JWT
- session contracts are in-memory and single-node
- no streaming consumer leases yet
- no Kafka/NATS/RabbitMQ/SQS-SNS bridges yet

See [`docs/progress.md`](docs/progress.md) for the detailed roadmap and accepted MVP boundaries.

## Architecture roadmap

```text
Phase 0   formal model + working broker          ← current
Phase 1   single-node broker + streaming consumers
Phase 2   Kubernetes control plane
Phase 3   distributed broker
Phase 4   Kafka / NATS / RabbitMQ / SQS-SNS bridges
```

## Website

The broker intentionally ships **without a presentation UI**. The `website` branch contains the public Developer / Researcher landing experience and deterministic replay used to explain the model. This keeps product storytelling out of the broker runtime.

## Community & contributing

- **Issues and ideas:** [GitHub Issues](https://github.com/vishnu-77/pigeon/issues)
- **Development:** see [CONTRIBUTING.md](CONTRIBUTING.md)
- **Security reports:** see [SECURITY.md](SECURITY.md)

```bash
git clone https://github.com/vishnu-77/pigeon.git
cd pigeon
npm ci
npm test
npm run demo
```

## License

Pigeon is released under the [Apache License 2.0](LICENSE).
