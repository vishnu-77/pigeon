# Pigeon

[![CI](https://github.com/vishnu-77/pigeon/actions/workflows/ci.yml/badge.svg)](https://github.com/vishnu-77/pigeon/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](.nvmrc)

Pigeon is a policy-native messaging prototype.

```text
Messages carry intent.
Subjects carry policy.
Brokers enforce guarantees.
```

This repository currently contains a dependency-free single-node MVP that demonstrates governed async communication for a card payment authorization flow.

## What Works

- Subject registration
- Message envelope normalization
- Intent-based admission
- Principal-based publish and receive authorization
- Region checks
- Schema validation
- Required idempotency keys
- Duplicate suppression on retry
- Sensitive field denial
- Quarantine for policy/schema failures
- Immutable in-memory audit log
- Request/reply-shaped payment authorization demo
- Minimal HTTP API

## Flows

See [docs/flows.md](docs/flows.md) for the payment authorization, publish admission, retry/idempotency, delivery, quarantine, and replay flows.

For a local sender/receiver simulation using separate containers on one Docker network, see [docs/local-container-simulation.md](docs/local-container-simulation.md).

## Run

```bash
npm test
npm run demo
npm start
```

## Container Simulation

```bash
docker compose up --build
```

This starts a broker container, a checkout sender container, and a gateway receiver container.

The HTTP broker listens on `http://localhost:8787`.

Health check:

```bash
curl http://localhost:8787/health
```

Publish a payment authorization:

```bash
curl -X POST http://localhost:8787/v1/messages \
  -H "content-type: application/json" \
  -H "x-pigeon-principal: spiffe://merchant-prod/ns/checkout/sa/checkout-api" \
  -H "x-pigeon-region: uk" \
  -d '{
    "subject": "payments.authorize",
    "type": "payment.authorization.requested",
    "source": "checkout-service",
    "intent": "authorize_payment",
    "idempotencyKey": "order_456:authorize",
    "classification": "pci",
    "region": "uk",
    "data": {
      "merchantId": "merchant_123",
      "orderId": "order_456",
      "amount": 42.5,
      "currency": "GBP",
      "paymentToken": "tok_visa_abc"
    }
  }'
```

Receive as the gateway adapter:

```bash
curl -X POST http://localhost:8787/v1/subjects/payments.authorize/receive \
  -H "content-type: application/json" \
  -H "x-pigeon-principal: spiffe://merchant-prod/ns/payments/sa/gateway-adapter" \
  -H "x-pigeon-region: uk" \
  -d '{ "max": 10 }'
```

## The Payment Subject

The demo subject is `payments.authorize`.

It enforces:

- only checkout can publish `authorize_payment`
- only the gateway adapter can receive
- idempotency key is mandatory
- replay is disabled
- payload must match `payment.authorization.v1`
- raw `card.pan` is forbidden
- messages can only originate in `uk` or `eu`
- accepted, denied, duplicate, delivery, replay, and quarantine events are audited

## Next Engineering Steps

1. Replace in-memory storage with an append-only log plus SQLite/RocksDB indexes.
2. Add leases, nack, retry backoff, and dead-letter/quarantine release workflows.
3. Add signed policy bundles and policy version pinning per message.
4. Add durable subject definitions from YAML.
5. Add OpenTelemetry spans and metrics.
6. Add SPIFFE mTLS identity extraction at the HTTP/gRPC boundary.
7. Add Kafka/NATS bridge adapters.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for development
setup, project layout, and how to add a subject. Please also read the
[Code of Conduct](CODE_OF_CONDUCT.md). For security issues, follow
[SECURITY.md](SECURITY.md) rather than opening a public issue.

## License

Licensed under the [Apache License 2.0](LICENSE).
