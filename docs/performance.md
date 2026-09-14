# Pigeon performance reference

Pigeon measures the cost of its broker-side communication governance separately from hosted network latency and separately from distributed-broker throughput.

## Reference run

The current reference was produced in GitHub Actions on 14 September 2026 with:

- Ubuntu 24.04
- Node.js 22.23.2
- 50,000 measured iterations after warm-up
- single in-memory Pigeon broker

```text
Pigeon enforcement overhead  (50,000 iterations, in-memory)

contract negotiation                           7.08 us/op        141,159 ops/s
publish (full governance + audit)             10.79 us/op         92,720 ops/s
```

`publish (full governance + audit)` includes contract validation, policy evaluation, region/classification and sensitive-data checks, schema validation, idempotency handling, append and audit work on the benchmark path.

These numbers are **not** a comparison with Kafka, NATS, RabbitMQ or another broker. They are also not an ungoverned-vs-governed delta. They are a reproducible reference for the current Pigeon implementation on one CI runner.

The hosted demo reports its own sender, contract, publish, receive and end-to-end timings. Those values include network and deployment latency and therefore should not be presented as Pigeon's broker enforcement cost.

## Reproduce

```bash
npm ci
npm run bench
```

Override the measured iterations when needed:

```bash
BENCH_ITERATIONS=100000 npm run bench
```

The benchmark source is [`scripts/bench-enforcement.mjs`](../scripts/bench-enforcement.mjs).
