# Pigeon Protocol v1

Pigeon Protocol v1 is the language-neutral HTTP contract between a Pigeon broker and its clients.

The Node.js implementation in this repository is the canonical broker today. Official JavaScript, Python and Rust clients must preserve the protocol semantics defined here rather than reimplement broker policy logic.

## Design invariant

**A governed operation requires an authenticated principal and a valid runtime communication contract.**

Clients do not assert their own identity or authority. The broker resolves identity from the presented credential, negotiates a contract, binds that contract to the principal, and validates subsequent operations under the contract ID.

```text
credential
    ↓
authenticated principal
    ↓
POST /v1/contracts
    ↓
communication contract
    ↓
x-pigeon-contract
    ↓
publish / receive / replay / ack
    ↓
allow | deny | quarantine
```

## Transport

Protocol v1 uses HTTP + JSON.

Default development endpoint:

```text
http://localhost:8787
```

Required/recognised headers:

| Header | Purpose |
|---|---|
| `authorization: Bearer <credential>` | Authenticate the calling principal |
| `x-pigeon-contract: <contract_id>` | Bind a governed operation to a negotiated contract |
| `x-pigeon-region: <region>` | Supply the caller/runtime region used by current policy gates |
| `content-type: application/json` | JSON request bodies |

A client-supplied principal field is never a substitute for broker authentication.

## Service metadata

`GET /`

Returns machine-readable broker metadata including the protocol version and core endpoints.

`GET /health`

Returns broker health:

```json
{ "ok": true, "service": "pigeon" }
```

## Subject discovery

`GET /v1/subjects`

Returns registered subjects and selected public constraints.

`GET /v1/subjects/{subject}`

Returns the broker's current subject definition.

## Contract negotiation

`POST /v1/contracts`

Example request:

```json
{
  "subjects": ["payments.authorize"],
  "ttlMs": 900000
}
```

The broker authenticates the request and returns only the subset permitted for that principal.

Example response shape:

```json
{
  "contract": {
    "id": "contract_1",
    "principal": "spiffe://example/ns/app/sa/producer",
    "subjects": [
      {
        "name": "payments.authorize",
        "operations": ["publish"]
      }
    ],
    "expiresAt": 0
  }
}
```

Exact additive fields may evolve within Protocol v1. Clients should ignore fields they do not understand unless explicitly marked required in a future revision.

A principal with no permitted requested subjects receives a typed denial such as `NO_PERMITTED_SUBJECTS`; no contract is issued.

## Publish

`POST /v1/messages`

Requires `x-pigeon-contract`.

Representative envelope:

```json
{
  "subject": "payments.authorize",
  "type": "payment.authorization.requested",
  "source": "checkout-service",
  "intent": "authorize_payment",
  "idempotencyKey": "order_42:authorize",
  "classification": "pci",
  "region": "uk",
  "data": {
    "merchantId": "m",
    "orderId": "order_42",
    "amount": 42.5,
    "currency": "GBP",
    "paymentToken": "tok"
  }
}
```

An accepted new message returns HTTP `202`. A recognised duplicate may return HTTP `200` with `status: "duplicate"`.

The broker may reject or quarantine an otherwise well-formed message if contract/policy gates fail.

## Receive

`POST /v1/subjects/{subject}/receive`

Requires a contract containing the receive operation for the requested subject.

```json
{ "max": 10 }
```

Response:

```json
{ "messages": [] }
```

## Audit and quarantine

`GET /v1/audit`

Returns current audit records.

`GET /v1/quarantine`

Returns quarantined records.

`POST /v1/quarantine/{id}/release`

Releases a quarantined record only when the authenticated principal and contract permit the operation.

## Error contract

Protocol errors use a typed JSON envelope:

```json
{
  "error": {
    "code": "CONTRACT_REQUIRED",
    "message": "...",
    "details": {}
  }
}
```

Official SDKs expose the same three fields:

- `code`
- HTTP `status`
- `details`

Representative protocol codes include:

- `UNAUTHENTICATED`
- `NO_PERMITTED_SUBJECTS`
- `CONTRACT_REQUIRED`
- `CONTRACT_NOT_FOUND`
- `CONTRACT_EXPIRED`
- `CONTRACT_PRINCIPAL_MISMATCH`
- `SUBJECT_NOT_IN_CONTRACT`
- `OPERATION_NOT_IN_CONTRACT`
- `INTENT_DENIED`
- `REGION_DENIED`
- `CLASSIFICATION_DENIED`
- `SENSITIVE_FIELD_DENIED`
- `IDEMPOTENCY_REQUIRED`
- `SCHEMA_INVALID`
- `RATE_LIMITED`

SDKs must preserve server codes instead of replacing them with language-specific error strings.

## Cross-language conformance

An official client must pass integration tests against the real broker for at least:

1. successful contract negotiation;
2. successful governed publish;
3. unauthorised negotiation denial;
4. typed error-code preservation.

Additional scenarios should include region, sensitive-data, duplicate/idempotency and receive semantics as the conformance suite expands.

## Versioning

SDK compatibility is defined against **Pigeon Protocol v1**, not identical package patch versions.

For example, these may all be compatible simultaneously:

```text
pigeonmq npm       1.x
pigeonmq Python    0.x / 1.x
pigeonmq Rust      0.x / 1.x
protocol           v1
```

A breaking wire/semantic change requires a new protocol version rather than silent SDK divergence.
