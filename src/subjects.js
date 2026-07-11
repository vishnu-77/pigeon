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

export function createPaymentBroker(BrokerClass) {
  const broker = new BrokerClass();
  broker.registerSchema("payment.authorization.v1", paymentAuthorizationSchema);
  broker.registerSubject(paymentsAuthorizeSubject);
  return broker;
}
