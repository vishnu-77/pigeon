# Pigeon Vision

> This document is the north star. The code in this repo is a small, executable
> MVP of the model described here - not the full system. See the
> [Roadmap](#roadmap) for how the two connect.

## Thesis

Pigeon should not be "another broker." It should be an async communication layer
where **delivery semantics and governance semantics are part of the same contract**.

```text
Messages carry intent.
Subjects carry policy.
Brokers enforce guarantees.
```

A producer does not merely publish bytes to `payments.authorize`. It submits an
intent-bound operation to a governed subject whose policy decides who may send, who
may receive, how retries work, whether replay is legal, where data may move, what
must be audited, and how failures are isolated.

## Design goals

1. Make governance a first-class runtime behavior, not a sidecar convention.
2. Support multiple messaging shapes behind one subject model: pub/sub, stream,
   queue, retained state, and request/reply.
3. Make retries, deduplication, replay, quarantine, and audit explicit per subject.
4. Treat identity, schema, residency, and sensitivity as part of message admission.
5. Keep the system open: standard envelopes, pluggable policy engines, portable
   clients, and Kubernetes-native operations.

## Non-goals

1. Do not initially compete with Kafka on massive historical stream analytics.
2. Do not initially compete with NATS on ultra-minimal latency.
3. Do not promise magical exactly-once effects across arbitrary external systems.
4. Do not require users to replace every broker on day one.

Pigeon wins by being the *governed* messaging layer. It can later use its own log,
embed storage, or bridge to Kafka, NATS, RabbitMQ, Pulsar, and cloud queues.

## Core concepts

### Subject

A subject is the governed communication resource. Everything - who can publish,
schema, residency, retries, replay, retention, quarantine - is declared on it.

```yaml
apiVersion: pigeon.io/v1
kind: Subject
metadata:
  name: payments.authorize
spec:
  mode: requestReply
  regionPolicy:
    allowedRegions: ["uk", "eu"]
    crossRegion: deny
  schema:
    subject: payment.authorization.v1
    compatibility: backward
  authorization:
    engine: cedar
    policyRef: policies/payments-authorize.cedar
  delivery:
    retry: { maxAttempts: 3, backoff: exponential, maxDelay: 30s }
    idempotency: { required: true, key: header.idempotency_key, ttl: 48h }
  replay: { allowed: false }
  retention: { messages: 7d, audit: 7y }
  data: { classification: pci, encryption: required, tokenization: required }
  quarantine: { onSchemaViolation: true, onHandlerFailure: true }
```

### Message envelope

A CloudEvents-compatible envelope so Pigeon interoperates with existing event
tooling while adding governed extensions (`pigeonintent`, `pigeonidempotencykey`,
`pigeonclassification`, `pigeonregion`).

### Intent

Intent is the action the message asks the system to perform (`authorize_payment`,
`capture_payment`, `refund_payment`, `send_notification`, ...). The broker evaluates
intent before accepting, delivering, retrying, replaying, or forwarding a message.

## Subject modes

| Mode | Shape | Good for |
| --- | --- | --- |
| **Pub/Sub** | Fan out to many subscribers | Domain events |
| **Durable stream** | Ordered append log with offsets | Projections, replayable integration streams |
| **Work queue** | Competing consumers, leases, acks, redelivery | Jobs and commands |
| **Retained state** | Last value per key | Config, device state, presence |
| **Request/Reply** | Correlated request-response with timeout + dedupe | Governed async RPC (e.g. payment authorization) |

## State-of-the-art choices

- **Identity** - workload identity (SPIFFE/SPIRE), not static service tokens.
  Policies evaluate workload identity, namespace, environment, and attestations.
- **Policy** - a layered model: fast built-in rules for common cases, **Cedar** for
  analyzable authorization, optional **OPA/Rego** adapter. One internal decision
  interface keeps the broker independent of any single policy language.
- **Schema** - Protobuf, JSON Schema, and Avro; validated before storage, with
  opt-in quarantine of invalid messages for forensics.
- **Idempotency** - no universal exactly-once claim; instead effect-safe primitives:
  required idempotency keys for dangerous intents, atomic append + ledger write,
  producer sequence numbers, consumer leases, transactional outbox/inbox helpers.
- **Replay** - a governed action with allowed principals, max age, required reason,
  field redaction, and mandatory audit.
- **Data residency** - every message carries a region + classification; every
  subject defines allowed movement; cross-region replication is policy-gated at the
  broker, not hidden in infrastructure.
- **Audit** - an immutable event stream separate from user message streams.
- **Quarantine** - not a prettier dead-letter queue but a governed evidence store
  (original envelope, failure reason, policy/schema version, principal, region,
  release policy, audit trail).

## Positioning

Pigeon is to async communication what an API gateway is to HTTP, but deeper: it
controls not only admission, identity, and policy, but also retry semantics, replay
rights, duplicate suppression, audit, and data movement.

| | Kafka | NATS | API gateway | **Pigeon** |
| --- | --- | --- | --- | --- |
| Async delivery | ✅ | ✅ | ❌ | ✅ |
| Identity-aware admission | ⚠️ add-on | ⚠️ add-on | ✅ | ✅ built-in |
| Per-subject policy (intent/region/schema) | ❌ | ❌ | ⚠️ HTTP only | ✅ |
| Governed retries / idempotency | ⚠️ client | ⚠️ client | ❌ | ✅ per subject |
| Governed replay | ❌ | ❌ | ❌ | ✅ |
| Immutable audit + quarantine | ❌ | ❌ | ⚠️ logs | ✅ first-class |

## Hard problems taken seriously

Latency overhead from policy/schema checks · policy versioning during in-flight
delivery · safe replay across schema versions · tenant isolation · quarantine
privacy · consumer-side side effects · backpressure across modes · disaster
recovery with residency constraints · upgrade safety for brokers and policy bundles.

## Roadmap

- **Phase 0 - Formal model (this repo).** Smallest executable model: subject spec,
  envelope spec, policy decision interface, retry/idempotency/replay state machines,
  in-memory broker + HTTP API + audit + quarantine.
- **Phase 1 - Single-node broker.** Durable storage (append-only log for messages,
  SQLite/RocksDB for idempotency/offsets/leases/metadata, separate audit log); gRPC +
  CloudEvents HTTP + streaming consumers.
- **Phase 2 - Kubernetes-native control plane.** CRDs (`Subject`, `PolicyBundle`,
  `SchemaBinding`, `ConsumerGroup`, `RegionBridge`, `Quarantine`) reconciled into
  broker runtime config.
- **Phase 3 - Distributed broker.** Partitioned subjects, replicated logs, Raft for
  metadata/leadership, versioned policy snapshots cached in brokers.
- **Phase 4 - Compatibility bridges.** Kafka / NATS / RabbitMQ / SQS-SNS-EventBridge
  source & sink, so Pigeon can govern communication without a big-bang migration.

The promise:

```text
Not just message delivery.
Governed communication.
```
