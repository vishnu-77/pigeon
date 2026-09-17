import type { Metadata } from "next";
import { DocsShell } from "@/components/DocsShell";

export const metadata: Metadata = {
  title: "Quickstart — PigeonMQ",
  description: "Install PigeonMQ, start a local broker, negotiate a communication contract and publish a governed message.",
};

export default function QuickstartPage() {
  return (
    <DocsShell
      eyebrow="Get started"
      title="Run your first governed message."
      intro="Start a local PigeonMQ broker, authenticate a producer, negotiate a short-lived communication contract, then publish under that contract."
    >
      <h2>1. Install PigeonMQ</h2>
      <p>PigeonMQ currently requires Node.js 22 or newer.</p>
      <pre><code>{`npm install pigeonmq
npx pigeon broker start`}</code></pre>
      <p>The development broker listens on <code>http://localhost:8787</code> by default.</p>

      <h2>2. Connect a producer</h2>
      <p>The client authenticates with a bearer credential and asks the broker for the subjects it needs. The broker returns only the permitted subset as a communication contract.</p>
      <pre><code>{`import { PigeonClient } from "pigeonmq";

const pigeon = new PigeonClient({
  url: "http://localhost:8787",
  token: "checkout-token"
});

await pigeon.connect(["payments.authorize"]);`}</code></pre>

      <h2>3. Publish under the contract</h2>
      <p>Message admission runs before delivery. Intent, schema, region, classification, sensitive data and idempotency can all participate in the decision.</p>
      <pre><code>{`const result = await pigeon.request(
  "payments.authorize",
  {
    merchantId: "m",
    orderId: "order_42",
    amount: 42.5,
    currency: "GBP",
    paymentToken: "tok"
  },
  {
    intent: "authorize_payment",
    idempotencyKey: "order_42:authorize",
    classification: "pci",
    region: "uk"
  }
);

console.log(result.status); // accepted`}</code></pre>

      <h2>4. See a blocked message</h2>
      <p>A contract does not bypass per-message enforcement. If a message violates subject policy—for example by carrying a forbidden sensitive field—the broker can quarantine it before the receiver processes it.</p>
      <pre><code>{`identity        ✓
intent          ✓
schema          ✓
region          ✓
data             ✕  forbidden sensitive field

QUARANTINE
receiver does not receive the message`}</code></pre>

      <h2>5. Try the built-in walkthrough</h2>
      <pre><code>{`npm run demo`}</code></pre>
      <p>The repository demo covers authorised communication, duplicate suppression, unauthorised producers and sensitive-field quarantine.</p>

      <h2>Next steps</h2>
      <div className="docs-link-row">
        <a href="/concepts">Learn the core concepts →</a>
        <a href="/protocol">Read Protocol v1 →</a>
        <a href="/demo">Open the live demo →</a>
      </div>
    </DocsShell>
  );
}
