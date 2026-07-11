# Pigeon Flows

These diagrams show how Pigeon turns ordinary messaging into governed communication.

## Payment Authorization

```mermaid
sequenceDiagram
  autonumber
  participant Checkout as checkout-service
  participant Pigeon as Pigeon broker
  participant Policy as policy engine
  participant Schema as schema registry
  participant Ledger as idempotency ledger
  participant Audit as audit log
  participant Gateway as payment-gateway-adapter

  Checkout->>Pigeon: publish authorize_payment
  Pigeon->>Policy: can checkout publish this intent?
  Policy-->>Pigeon: allow
  Pigeon->>Schema: validate payment.authorization.v1
  Schema-->>Pigeon: valid
  Pigeon->>Ledger: check idempotency key
  Ledger-->>Pigeon: new request
  Pigeon->>Ledger: store message + idempotency key
  Pigeon->>Audit: publish.accepted
  Gateway->>Pigeon: receive payments.authorize
  Pigeon->>Policy: can gateway receive?
  Policy-->>Pigeon: allow
  Pigeon->>Audit: delivery.dispatched
  Pigeon-->>Gateway: deliver authorization request
```

## Publish Admission

```mermaid
flowchart TD
  Start["Producer publishes message"] --> Subject["Resolve subject policy"]
  Subject --> Auth["Authenticate principal"]
  Auth --> PublishPolicy{"Publish allowed?"}
  PublishPolicy -- No --> Deny["Deny + audit"]
  PublishPolicy -- Yes --> Intent{"Intent allowed?"}
  Intent -- No --> Deny
  Intent -- Yes --> Region{"Region allowed?"}
  Region -- No --> Deny
  Region -- Yes --> Sensitive{"Forbidden sensitive fields?"}
  Sensitive -- Yes --> Quarantine["Quarantine + audit"]
  Sensitive -- No --> Schema{"Schema valid?"}
  Schema -- No --> Quarantine
  Schema -- Yes --> Idempotency{"Duplicate idempotency key?"}
  Idempotency -- Yes --> Duplicate["Return original accepted message"]
  Idempotency -- No --> Commit["Append message + record key"]
  Commit --> Audit["Audit publish.accepted"]
  Audit --> Accepted["Accepted"]
```

## Retry And Duplicate Suppression

```mermaid
sequenceDiagram
  autonumber
  participant Checkout as checkout-service
  participant Pigeon as Pigeon broker
  participant Ledger as idempotency ledger
  participant Audit as audit log

  Checkout->>Pigeon: publish order_456:authorize
  Pigeon->>Ledger: lookup key
  Ledger-->>Pigeon: not found
  Pigeon->>Ledger: store key -> msg_1
  Pigeon-->>Checkout: accepted msg_1

  Checkout->>Pigeon: retry order_456:authorize
  Pigeon->>Ledger: lookup key
  Ledger-->>Pigeon: msg_1
  Pigeon->>Audit: publish.duplicate
  Pigeon-->>Checkout: duplicate, return msg_1
```

## Delivery

```mermaid
flowchart TD
  Consumer["Consumer requests messages"] --> Subject["Resolve subject"]
  Subject --> ReceivePolicy{"Receive allowed?"}
  ReceivePolicy -- No --> Deny["Deny + audit"]
  ReceivePolicy -- Yes --> Cursor["Read from consumer cursor"]
  Cursor --> Dispatch["Dispatch messages"]
  Dispatch --> Attempt["Record delivery attempt"]
  Attempt --> Audit["Audit delivery.dispatched"]
  Audit --> ConsumerAck["Consumer processes and acks"]
  ConsumerAck --> AckPolicy{"Ack allowed?"}
  AckPolicy -- No --> Deny
  AckPolicy -- Yes --> Ack["Audit delivery.acked"]
```

## Quarantine

```mermaid
flowchart TD
  Message["Incoming message"] --> Check{"Policy/schema violation?"}
  Check -- No --> Normal["Normal publish flow"]
  Check -- Yes --> Quarantine["Create quarantine record"]
  Quarantine --> Evidence["Store envelope, reason, principal, region, policy version"]
  Evidence --> Audit["Audit quarantine.created"]
  Audit --> Review["Operator/security review"]
```

## Replay

```mermaid
flowchart TD
  Request["Replay requested"] --> Enabled{"Replay enabled on subject?"}
  Enabled -- No --> Denied["Deny + audit replay.denied"]
  Enabled -- Yes --> Policy{"Replay policy allows principal?"}
  Policy -- No --> Denied
  Policy -- Yes --> Reason{"Reason supplied?"}
  Reason -- No --> Denied
  Reason -- Yes --> Execute["Return governed replay window"]
  Execute --> Audit["Audit replay.executed"]
```

## Where To Show These

Use these diagrams in:

1. `README.md` for the short product explanation.
2. `docs/flows.md` for engineering and architecture details.
3. GitHub project page or docs site because Mermaid renders directly.
4. Demo scripts or talks to explain why a payment authorization is not just a message from A to B.
