# PigeonMQ public launch

PigeonMQ is an experimental policy-compiled messaging broker for governed service communication.

Services authenticate, negotiate an identity-bound session contract, and then publish, receive, replay, acknowledge, or release messages under that contract. Subject, schema, intent, region, classification, idempotency, and data-handling rules are checked before a message is routed or stored.

## Canonical product identity

Use the following names consistently:

- Product: **PigeonMQ**
- npm package: `pigeonmq`
- CLI command: `pigeon`
- Repository target name: `pigeonmq`
- Category: policy-compiled messaging broker

Do not describe PigeonMQ primarily as a lightweight queue. Its differentiator is runtime communication governance through compiled session contracts.

## One-sentence positioning

> PigeonMQ compiles messaging policy into short-lived, identity-bound runtime contracts before a service can move a message.

## Demonstration story

The public demo should make five outcomes visible without requiring architecture knowledge:

1. A valid payment authorisation is accepted.
2. A duplicate request is rejected by idempotency enforcement.
3. An unauthorised producer fails contract negotiation.
4. Raw payment-card data is denied, redacted, and quarantined as evidence.
5. A message from a disallowed region is denied.

For every scenario, display:

- authenticated principal;
- negotiated contract;
- evaluated gates;
- decision and reason code;
- audit event;
- quarantined evidence where applicable.

## Public evidence required

Before broad promotion:

- align changelog entries with all published 1.x releases;
- state the compatibility promise covered by version 1.x;
- retain the explicit experimental and single-node status;
- publish enforcement-overhead benchmark results with methodology;
- make the dashboard accessible through a hosted demonstration;
- verify the npm package, Git tag, GitHub Release, and changelog agree.

## Launch thesis

Traditional brokers provide logs, queues, routing, and delivery semantics. Application teams usually implement communication governance separately through client libraries, sidecars, gateway policy, and conventions. PigeonMQ explores whether governance can become part of the messaging primitive itself.

The launch should invite technical scrutiny of this thesis rather than claim that PigeonMQ replaces Kafka, NATS, or RabbitMQ.

## Contributor entry points

Create bounded issues for:

- one OpenTelemetry broker-decision counter;
- one new governed subject and test fixture;
- one policy-linter validation rule;
- one additional denial scenario in the dashboard;
- benchmark result export in JSON.

Each issue should list affected files, test commands, acceptance criteria, and expected scope.

## Success metrics

Track external design feedback, demo completions, independent integrations, contributor PRs, references in architecture discussions, and benchmark reproductions. Treat repository stars as a secondary signal.
