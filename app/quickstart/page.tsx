import type { Metadata } from "next";
import { DocsShell } from "@/components/DocsShell";

export const metadata: Metadata = {
  title: "Quickstart — PigeonMQ",
  description: "Install PigeonMQ, start a local broker, negotiate a communication contract, publish a governed message and inspect the broker decision.",
  alternates: { canonical: "/quickstart" },
};

export default function QuickstartPage() {
  return (
    <DocsShell
      eyebrow="Quickstart"
      title="Run your first governed message."
      intro="This walkthrough starts one broker, checks health, negotiates a communication contract, publishes an accepted message, then shows the same path rejecting a policy violation before delivery."
    >
      <h2>Before you start</h2>
      <p>PigeonMQ currently requires Node.js 22 or newer. The examples below use the Node.js client, but the broker itself exposes Pigeon Protocol v1 over HTTP + JSON.</p>

      <h2>1. Install PigeonMQ</h2>
      <pre><code>{`npm install pigeonmq`}</code></pre>

      <h2>2. Start the broker</h2>
      <pre><code>{`npx pigeon broker start`}</code></pre>
      <p>The local broker listens on <code>http://localhost:8787</code> by default.</p>
      <pre><code>{`curl http://localhost:8787/health`}</code></pre>
      <p>A healthy broker should return a successful health response before you continue.</p>

      <h2>3. Authenticate and negotiate a contract</h2>
      <p>The client presents a credential and requests the subjects it needs. The broker resolves the principal and returns only the communication scope permitted by policy.</p>
      <pre><code>{`import { PigeonClient } from "pigeonmq";

const pigeon = new PigeonClient({
  url: "http://localhost:8787",
  token: "checkout-token"
});

await pigeon.connect(["payments.authorize"]);`}</code></pre>
      <p>The resulting contract is short-lived and bound to the authenticated principal. It does not let the client invent identity or permissions.</p>

      <h2>4. Publish a governed message</h2>
      <p>Publishing under a valid contract still triggers message admission. The broker can evaluate intent, schema, region, classification, sensitive data and idempotency before the message proceeds.</p>
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

      <h2>5. Understand the broker path</h2>
      <pre><code>{`credential
    ↓
authenticated principal
    ↓
communication contract
    ↓
message envelope
    ↓
identity → intent → schema → region → data → idempotency
                                              ↓
                              allow | deny | quarantine`}</code></pre>
      <p>The contract establishes session authority. The admission chain decides whether this specific operation may proceed.</p>

      <h2>6. See a blocked message</h2>
      <p>A permitted producer can still violate policy. If the message carries a forbidden sensitive field, crosses a region boundary, fails schema validation or otherwise falls outside the contract and subject policy, the broker can stop it before receiver processing.</p>
      <pre><code>{`identity        ✓
intent          ✓
schema          ✓
region          ✓
data             ✕  forbidden sensitive field

QUARANTINE
receiver does not receive the message`}</code></pre>

      <h2>7. Run the built-in walkthrough</h2>
      <pre><code>{`npm run demo`}</code></pre>
      <p>The repository walkthrough covers authorised communication, duplicate suppression, unauthorised producers and sensitive-field quarantine.</p>

      <h2>8. Useful CLI commands</h2>
      <div className="docs-table-wrap">
        <table>
          <thead><tr><th>Command</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr><td><code>pigeon broker start</code></td><td>Start the HTTP broker.</td></tr>
            <tr><td><code>pigeon demo</code></td><td>Run the governed walkthrough.</td></tr>
            <tr><td><code>pigeon policy lint [dir]</code></td><td>Validate a policy catalogue.</td></tr>
            <tr><td><code>pigeon publish &lt;subject&gt; ...</code></td><td>Negotiate a contract and publish over HTTP.</td></tr>
            <tr><td><code>pigeon quarantine</code></td><td>Inspect quarantined communication.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Where to go next</h2>
      <div className="docs-link-row">
        <a href="/concepts">Core concepts →</a>
        <a href="/protocol">Protocol v1 →</a>
        <a href="/use-cases">Messaging patterns →</a>
        <a href="/demo">Live demo →</a>
      </div>
    </DocsShell>
  );
}
