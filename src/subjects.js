export const paymentAuthorizationSchema = {
  type: "object",
  required: ["merchantId", "amount", "currency", "paymentToken", "orderId"],
  properties: {
    merchantId: { type: "string" },
    orderId: { type: "string" },
    amount: { type: "number" },
    currency: { type: "string", pattern: "^[A-Z]{3}$" },
    paymentToken: { type: "string" },
    card: {
      type: "object",
      properties: {
        pan: { type: "string" }
      }
    }
  }
};

export const paymentsAuthorizeSubject = {
  name: "payments.authorize",
  mode: "requestReply",
  intents: ["authorize_payment"],
  schema: {
    name: "payment.authorization.v1",
    compatibility: "backward"
  },
  regionPolicy: {
    home: "uk",
    allowedRegions: ["uk", "eu"],
    crossRegion: "deny"
  },
  delivery: {
    retry: {
      maxAttempts: 3,
      backoff: "exponential",
      maxDelayMs: 30_000
    },
    idempotency: {
      required: true,
      key: "idempotencyKey",
      ttlMs: 172_800_000
    }
  },
  replay: {
    allowed: false
  },
  retention: {
    messagesMs: 604_800_000,
    auditMs: 220_752_000_000
  },
  data: {
    classification: "pci",
    encryption: "required",
    tokenization: "required",
    forbiddenFields: ["card.pan"]
  },
  quarantine: {
    onSchemaViolation: true,
    onPolicyViolation: true,
    onHandlerFailure: true
  },
  policy: {
    publish: [
      {
        effect: "allow",
        principals: ["spiffe://merchant-prod/ns/checkout/sa/checkout-api"],
        intents: ["authorize_payment"],
        regions: ["uk", "eu"]
      }
    ],
    receive: [
      {
        effect: "allow",
        principals: ["spiffe://merchant-prod/ns/payments/sa/gateway-adapter"],
        regions: ["uk", "eu"]
      }
    ],
    ack: [
      {
        effect: "allow",
        principals: ["spiffe://merchant-prod/ns/payments/sa/gateway-adapter"],
        regions: ["uk", "eu"]
      }
    ],
    replay: []
  }
};

export const notificationSendSchema = {
  type: "object",
  required: ["recipientId", "channel", "templateId"],
  properties: {
    recipientId: { type: "string" },
    channel: { type: "string", enum: ["email", "sms", "push"] },
    templateId: { type: "string" },
    locale: { type: "string" },
    params: { type: "object" },
    recipient: {
      type: "object",
      properties: {
        ssn: { type: "string" }
      }
    }
  }
};

// A second, non-payment subject that exercises a different subject mode
// (work queue) and different governance than payments: PII rather than PCI,
// and replay is *allowed* for an audited ops principal with a stated reason.
export const notificationsSendSubject = {
  name: "notifications.send",
  mode: "workQueue",
  intents: ["send_notification"],
  schema: {
    name: "notification.send.v1",
    compatibility: "backward"
  },
  regionPolicy: {
    home: "uk",
    allowedRegions: ["uk", "eu"],
    crossRegion: "deny"
  },
  delivery: {
    retry: {
      maxAttempts: 5,
      backoff: "exponential",
      maxDelayMs: 60_000
    },
    idempotency: {
      required: true,
      key: "idempotencyKey",
      ttlMs: 86_400_000
    }
  },
  replay: {
    allowed: true
  },
  retention: {
    messagesMs: 259_200_000,
    auditMs: 220_752_000_000
  },
  data: {
    classification: "pii",
    encryption: "required",
    forbiddenFields: ["recipient.ssn"]
  },
  quarantine: {
    onSchemaViolation: true,
    onPolicyViolation: true,
    onHandlerFailure: true
  },
  policy: {
    publish: [
      {
        effect: "allow",
        principals: ["spiffe://merchant-prod/ns/orders/sa/orders-api"],
        intents: ["send_notification"],
        regions: ["uk", "eu"]
      }
    ],
    receive: [
      {
        effect: "allow",
        principals: ["spiffe://merchant-prod/ns/notify/sa/notifier-worker"],
        regions: ["uk", "eu"]
      }
    ],
    ack: [
      {
        effect: "allow",
        principals: ["spiffe://merchant-prod/ns/notify/sa/notifier-worker"],
        regions: ["uk", "eu"]
      }
    ],
    replay: [
      {
        effect: "allow",
        principals: ["spiffe://merchant-prod/ns/ops/sa/notify-replay"],
        regions: ["uk", "eu"],
        requireReason: true
      }
    ]
  }
};

// Demo principals (SPIFFE ids) and the bearer tokens that authenticate as them.
// Tokens are static and hard-coded for the local demo only - a real deployment
// would resolve identity from mTLS/SPIFFE/JWT (see ADR-0004). Never ship these.
export const DEMO_PRINCIPALS = {
  checkout: { id: "spiffe://merchant-prod/ns/checkout/sa/checkout-api" },
  gateway: { id: "spiffe://merchant-prod/ns/payments/sa/gateway-adapter" },
  ordersApi: { id: "spiffe://merchant-prod/ns/orders/sa/orders-api" },
  notifier: { id: "spiffe://merchant-prod/ns/notify/sa/notifier-worker" },
  notifyReplay: { id: "spiffe://merchant-prod/ns/ops/sa/notify-replay" },
  catalog: { id: "spiffe://merchant-prod/ns/catalog/sa/catalog-api" }
};

export const DEMO_TOKENS = {
  "checkout-token": DEMO_PRINCIPALS.checkout,
  "gateway-token": DEMO_PRINCIPALS.gateway,
  "orders-token": DEMO_PRINCIPALS.ordersApi,
  "notifier-token": DEMO_PRINCIPALS.notifier,
  "notify-replay-token": DEMO_PRINCIPALS.notifyReplay,
  "catalog-token": DEMO_PRINCIPALS.catalog
};

// Registers the demo bearer tokens on a broker so its authenticator can resolve
// them to principals.
export function registerDemoAuth(broker) {
  for (const [token, principal] of Object.entries(DEMO_TOKENS)) {
    broker.registerToken(token, principal);
  }
  return broker;
}

export function createPaymentBroker(BrokerClass) {
  const broker = new BrokerClass();
  broker.registerSchema("payment.authorization.v1", paymentAuthorizationSchema);
  broker.registerSubject(paymentsAuthorizeSubject);
  registerDemoAuth(broker);
  return broker;
}

// Registers every demo subject (and demo auth) on an existing broker instance.
export function registerDemoSubjects(broker) {
  broker.registerSchema("payment.authorization.v1", paymentAuthorizationSchema);
  broker.registerSubject(paymentsAuthorizeSubject);
  broker.registerSchema("notification.send.v1", notificationSendSchema);
  broker.registerSubject(notificationsSendSubject);
  registerDemoAuth(broker);
  return broker;
}

// Convenience factory used by the HTTP server and the walkthrough demo so the
// full catalog of governed subjects is available.
export function createDemoBroker(BrokerClass) {
  return registerDemoSubjects(new BrokerClass());
}
