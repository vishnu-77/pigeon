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
    tokenizedFields: ["paymentToken"],
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

export const demoMessageSchema = {
  type: "object",
  required: ["demoRunId", "message"],
  properties: {
    demoRunId: { type: "string" },
    message: { type: "string" },
    restricted: {
      type: "object",
      properties: {
        secret: { type: "string" }
      }
    }
  }
};

export const demoMessageSubject = {
  name: "demo.message",
  mode: "workQueue",
  intents: ["send_demo_message"],
  schema: {
    name: "demo.message.v1",
    compatibility: "backward"
  },
  regionPolicy: {
    home: "uk",
    allowedRegions: ["uk", "eu"],
    crossRegion: "deny"
  },
  delivery: {
    retry: {
      maxAttempts: 2,
      backoff: "linear",
      maxDelayMs: 2_000
    },
    idempotency: {
      required: true,
      key: "idempotencyKey",
      ttlMs: 3_600_000
    }
  },
  replay: {
    allowed: false
  },
  retention: {
    messagesMs: 3_600_000,
    auditMs: 86_400_000
  },
  data: {
    classification: "internal",
    encryption: "required",
    forbiddenFields: ["restricted.secret"]
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
        principals: ["spiffe://pigeon-demo/ns/public/sa/demo-producer"],
        intents: ["send_demo_message"],
        regions: ["uk", "eu"]
      }
    ],
    receive: [
      {
        effect: "allow",
        principals: ["spiffe://pigeon-demo/ns/public/sa/demo-consumer"],
        regions: ["uk", "eu"]
      }
    ],
    ack: [
      {
        effect: "allow",
        principals: ["spiffe://pigeon-demo/ns/public/sa/demo-consumer"],
        regions: ["uk", "eu"]
      }
    ],
    replay: []
  }
};

export const DEMO_PRINCIPALS = {
  checkout: { id: "spiffe://merchant-prod/ns/checkout/sa/checkout-api" },
  gateway: { id: "spiffe://merchant-prod/ns/payments/sa/gateway-adapter" },
  ordersApi: { id: "spiffe://merchant-prod/ns/orders/sa/orders-api" },
  notifier: { id: "spiffe://merchant-prod/ns/notify/sa/notifier-worker" },
  notifyReplay: { id: "spiffe://merchant-prod/ns/ops/sa/notify-replay" },
  catalog: { id: "spiffe://merchant-prod/ns/catalog/sa/catalog-api" },
  demoProducer: { id: "spiffe://pigeon-demo/ns/public/sa/demo-producer" },
  demoConsumer: { id: "spiffe://pigeon-demo/ns/public/sa/demo-consumer" }
};

export const DEMO_TOKENS = {
  "checkout-token": DEMO_PRINCIPALS.checkout,
  "gateway-token": DEMO_PRINCIPALS.gateway,
  "orders-token": DEMO_PRINCIPALS.ordersApi,
  "notifier-token": DEMO_PRINCIPALS.notifier,
  "notify-replay-token": DEMO_PRINCIPALS.notifyReplay,
  "catalog-token": DEMO_PRINCIPALS.catalog,
  "demo-producer-token": DEMO_PRINCIPALS.demoProducer,
  "demo-consumer-token": DEMO_PRINCIPALS.demoConsumer
};

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

export function registerDemoSubjects(broker) {
  broker.registerSchema("payment.authorization.v1", paymentAuthorizationSchema);
  broker.registerSubject(paymentsAuthorizeSubject);
  broker.registerSchema("notification.send.v1", notificationSendSchema);
  broker.registerSubject(notificationsSendSubject);
  broker.registerSchema("demo.message.v1", demoMessageSchema);
  broker.registerSubject(demoMessageSubject);
  registerDemoAuth(broker);
  return broker;
}

export function createDemoBroker(BrokerClass) {
  return registerDemoSubjects(new BrokerClass());
}
