# ADR-0008: Federation-native communication authority

- **Status:** Proposed
- **Date:** 2026-09-14
- **Deciders:** Pigeon maintainers
- **Supersedes / Superseded by:** none

## Context

Pigeon currently models communication authority as a short-lived contract bound to an authenticated principal, subject and permitted operations. The working broker is single-node, but the authority model should not require a future split between a local protocol and a separate federation protocol.

Distributed and cross-domain communication introduces additional trust boundaries. A contract issued inside one administrative domain must not automatically become equivalent authority in another domain. Federation also adds attack surface: more identities, keys, trust relationships, routing paths, revocation state and replication channels.

The protocol therefore needs a model that can extend from one broker to multiple brokers, regions and organisations without weakening the existing invariant that there is no ungoverned message path.

## Decision

We will design Pigeon so federation is a native property of the authority model while keeping a single-node broker as the simplest deployable topology.

The federation model will follow these rules.

### 1. Trust domains are explicit

A Pigeon deployment belongs to a trust domain. Local traffic has the same conceptual origin and destination domain; cross-domain traffic names both boundaries explicitly.

Conceptually:

```text
origin_domain       acme.uk
 destination_domain analytics.eu
```

These fields become protocol context rather than a separate federation-only envelope.

### 2. Cross-domain communication requires two decisions

A federated message must satisfy both:

```text
origin egress authority
AND
destination ingress authority
```

The origin domain decides whether its principal may send the communication out of the domain. The destination domain independently decides whether that communication may enter and reach a local consumer.

No remote contract bypasses local ingress policy.

### 3. Authority may be attenuated but never amplified

The core federation invariant is:

> **Authority never increases as communication crosses a trust boundary.**

A destination may preserve or narrow imported authority. It may not silently add operations, subjects, intents, regions, data access or lifetime that were absent from the originating grant.

Example:

```text
origin grant
  subject     agents.delegate.task
  intent      investigate_issue
  operations  publish
  scope       repo.read, test.run
  ttl         15m

remote contract
  subject     agents.delegate.task
  intent      investigate_issue
  operations  receive
  scope       repo.read
  ttl         5m
```

The second contract is narrower. It cannot expand to `repo.write`, `production.deploy` or credential access unless those capabilities were independently authorised through a separate local flow.

### 4. Federation grants are short-lived and audience-bound

A cross-domain authority object should be verifiable independently of the issuing broker and should include at minimum:

```text
issuer / origin domain
audience / destination domain
principal or delegated identity
subject
operation
intent
policy / contract reference
issued-at
expiry
nonce or equivalent replay protection
payload or envelope digest where appropriate
signature
```

Exact serialisation and signing format are left for a later protocol ADR.

### 5. No global federation secret

Federation must not depend on one shared super-token across all brokers. Trust should be established using independently rotatable domain/workload identity material.

Candidate mechanisms include mTLS, SPIFFE/SPIRE federation, short-lived JWTs and JWKS-backed signing keys. These are design options, not claims of current implementation support.

### 6. Local policy remains sovereign

A destination domain owns its local subject policy, schemas, data restrictions and consumer permissions. Imported authority is evidence to evaluate, not a command to override local policy.

### 7. Separate trust, control and data concerns

The distributed design should preserve three logical planes:

```text
Trust plane
  workload identity
  domain identity
  certificates / keys
  trust bundles
  rotation

Control plane
  subject policy
  schemas
  contract issuance
  revocation
  federation relationships
  policy versions

Data plane
  publish
  receive
  acknowledgement
  replay
  admission
  routing
  quarantine
```

This is a logical architecture boundary; it does not require three separate products or services in the initial implementation.

### 8. Consensus is used selectively

A future distributed broker should not force every operation through global consensus. Strong consistency should be reserved for state whose correctness requires it, such as partition/consumer ownership, critical revocation state or leadership. Metrics, discovery and other non-authoritative state may use weaker replication models.

### 9. Federation does not imply payload decryption by every broker

Transport security remains a deployment concern. A future subject policy may additionally require end-to-end payload encryption where intermediary brokers route authenticated metadata without possessing the plaintext payload. Payload-level encryption is not part of the current implementation.

## Initial cross-domain flow

```text
Producer
   │
   ▼
Origin Pigeon domain
   │
   ├─ authenticate principal
   ├─ validate local contract
   └─ egress decision
   │
   ▼
Federation link
   │
   ▼
Destination Pigeon domain
   │
   ├─ verify issuer / audience / expiry
   ├─ validate anti-replay context
   ├─ attenuate imported authority
   └─ ingress decision
   │
   ▼
Consumer
```

The existing invariant remains unchanged:

> **There is no ungoverned message path.**

## Consequences

### Positive

- A single-node deployment and a federated deployment share the same authority model.
- Cross-region, cross-account and cross-organisation communication can preserve contextual authority instead of collapsing to subject-level trust at the boundary.
- A2A delegation can be represented without giving one agent unrestricted authority over another domain.
- Local administrators retain control over ingress policy.
- Short-lived, audience-bound authority reduces the usefulness of replayed or leaked federation credentials.

### Costs and risks

- Federation creates additional key-management, revocation, replay-protection and availability requirements.
- Contract attenuation requires a formally defined comparison model for authority scopes.
- Revocation propagation becomes a distributed-systems problem.
- Cross-domain audit correlation needs stable identifiers without creating a global privileged control plane.
- Multi-broker routing and replication must be designed independently from the authority semantics.

### Follow-up work

Before federation can be called implemented, Pigeon needs separate decisions and tests for:

1. domain identity and trust discovery;
2. signed federation grant format;
3. authority attenuation semantics;
4. anti-replay behaviour;
5. revocation propagation;
6. distributed contract/state replication;
7. routing and partition ownership;
8. cross-domain audit correlation;
9. failure and partition behaviour;
10. measurable federation-path latency and enforcement overhead.

Until those ship, federation remains a proposed architecture and must not be presented as an implemented product capability on the public landing page.

### Alternatives considered

- **Require a distributed cluster for every installation** — rejected because it raises the adoption and operational floor for local development and small deployments without improving the authority model itself.
- **Treat federation as a later gateway bolted onto the protocol** — rejected because it risks creating a second authority model and allows local/federated semantics to diverge.
- **Trust contracts issued by another Pigeon domain directly** — rejected because it removes destination policy sovereignty and allows remote issuers to define local authority.
- **Use one shared federation credential** — rejected because compromise would create an excessively broad blast radius and make independent rotation and trust relationships difficult.
