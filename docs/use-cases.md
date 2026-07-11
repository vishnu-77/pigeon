# Where & How to Use Pigeon

Pigeon fits anywhere a message is not "just data from A to B" but a **governed
operation** - where *who* sent it, *what* it is allowed to do, *where* it may travel,
and *whether it can be retried or replayed* all matter.

The common shape is always the same: declare a **subject**, attach **policy**, and let
the broker enforce it on every publish and delivery. Below are concrete places this
pays off, each with a subject sketch you can adapt.

## Quick index

| Use case | Why Pigeon | Subject mode |
| --- | --- | --- |
| [Regulated card payments (PCI)](#1-regulated-card-payments-pci) | No double charges, no raw PAN, full audit | request/reply |
| [PII & GDPR data residency](#2-pii--gdpr-data-residency) | Keep data in-region, block sensitive fields | work queue |
| [Healthcare / HIPAA events](#3-healthcare--hipaa-events) | Least-privilege access, evidence trail | pub/sub |
| [Multi-tenant SaaS isolation](#4-multi-tenant-saas-isolation) | Per-tenant identity & policy | pub/sub / queue |
| [Governed async RPC / commands](#5-governed-async-rpc--commands) | Idempotent commands, authorized callers | request/reply |
| [Audit & compliance evidence](#6-audit--compliance-evidence) | Immutable trail + quarantine | any |
| [Reliable work queues](#7-reliable-work-queues) | Governed retries & replay | work queue |

---

## 1. Regulated card payments (PCI)

**Problem:** a retried checkout must never double-charge; raw card numbers must never
land in a message log; auditors need proof of every decision.

**With Pigeon:** only `checkout-api` can publish `authorize_payment`; only the gateway
adapter can receive; an idempotency key is mandatory (retries return the original);
`card.pan` is a forbidden field (denied + quarantined); replay is disabled; every
accept/deny/retry is audited. This is the built-in demo - run `npm run demo`.

```yaml
name: payments.authorize
mode: requestReply
data: { classification: pci, forbiddenFields: [card.pan] }
delivery: { idempotency: { required: true } }
replay: { allowed: false }
regionPolicy: { allowedRegions: [uk, eu] }
```

## 2. PII & GDPR data residency

**Problem:** customer data must stay in the EU/UK, and a stray SSN or email must not
leak into downstream systems.

**With Pigeon:** the subject pins `allowedRegions` and `crossRegion: deny`, so a
message tagged `region: us` is refused at admission. Sensitive fields
(`recipient.ssn`) are forbidden and quarantined as evidence. This is the shipped
`notifications.send` subject - see it in `npm run demo`.

```yaml
name: notifications.send
mode: workQueue
data: { classification: pii, forbiddenFields: [recipient.ssn] }
regionPolicy: { allowedRegions: [uk, eu], crossRegion: deny }
replay: { allowed: true }   # audited ops principal only, reason required
```

## 3. Healthcare / HIPAA events

**Problem:** clinical events (`lab.result.ready`, `admission.recorded`) may only be
consumed by authorized services, and access must be provable years later.

**With Pigeon:** publish/receive policies are keyed to workload identity; schema
validation rejects malformed records; classification `phi` plus forbidden identifiers
prevent oversharing; the immutable audit log is the retention-grade evidence trail.

```yaml
name: lab.result.ready
mode: pubsub
data: { classification: phi, forbiddenFields: [patient.nationalId] }
retention: { audit: 7y }
policy:
  receive:
    - { effect: allow, principals: [spiffe://health/ns/ehr/sa/reader] }
```

## 4. Multi-tenant SaaS isolation

**Problem:** tenant A's workers must never receive tenant B's events, even by mistake.

**With Pigeon:** encode the tenant in the workload identity and gate publish/receive
on it (and on principal attributes). Every cross-tenant attempt is denied *and*
audited, turning "trust the code" into "prove it at the broker."

```yaml
policy:
  receive:
    - effect: allow
      principals: [spiffe://saas/ns/tenant-a/sa/worker]
      attributes: { tenant: tenant-a }
```

## 5. Governed async RPC / commands

**Problem:** a command like `refund_payment` or `terminate_instance` is dangerous -
it must be idempotent, come from an authorized caller, and be traceable.

**With Pigeon:** request/reply mode with a required idempotency key gives effect-safe
commands: duplicate suppression means a retried `refund_payment` refunds once. Intent
checks ensure a caller allowed to *read* cannot *mutate*.

```yaml
name: billing.refund
mode: requestReply
intents: [refund_payment]
delivery: { idempotency: { required: true } }
```

## 6. Audit & compliance evidence

**Problem:** "show me who sent what, when, and why it was allowed" - without scraping
application logs.

**With Pigeon:** the audit log is a separate, immutable stream of governance events
(`publish.accepted`, `publish.denied`, `quarantine.created`, `replay.executed`, ...).
Quarantine keeps the offending envelope with its failure reason, principal, region,
and policy version. Query it over HTTP: `GET /v1/audit`, `GET /v1/quarantine`.

## 7. Reliable work queues

**Problem:** background jobs need bounded retries, and re-processing after an outage
must be a controlled, audited action - not an ad-hoc script.

**With Pigeon:** work-queue mode gives competing consumers with delivery cursors and
acks; retry policy is declared on the subject; **replay is governed** - only an ops
principal with a stated reason can re-emit a window, and it is audited.

```yaml
name: notifications.send
mode: workQueue
delivery: { retry: { maxAttempts: 5, backoff: exponential } }
replay:
  allowed: true
policy:
  replay:
    - { effect: allow, principals: [spiffe://ops/sa/notify-replay], requireReason: true }
```

---

## How to adopt it incrementally

1. **Model one subject.** Pick your riskiest message (a payment, a refund, a PII
   event) and declare it as a subject with real policy - see `src/subjects.js`.
2. **Front it with Pigeon.** Point producers/consumers at the HTTP API
   (`POST /v1/messages`, `POST /v1/subjects/:name/receive`). Keep your existing
   broker for everything else.
3. **Prove the guarantees.** Use `GET /v1/audit` and `GET /v1/quarantine` to show
   auditors and teammates what the broker enforced.
4. **Expand.** Add subjects as the model earns trust. Bridges to Kafka/NATS are on the
   [roadmap](vision.md#roadmap) so you never need a big-bang migration.
