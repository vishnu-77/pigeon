import type { Metadata } from "next";
import { DocsShell } from "@/components/DocsShell";

export const metadata: Metadata = {
  title: "Pigeon Protocol v1 — PigeonMQ",
  description: "Language-neutral HTTP + JSON protocol for PigeonMQ clients and brokers.",
};

const endpoints = [
  ["GET /", "Broker metadata and protocol information."],
  ["GET /health", "Broker health."],
  ["GET /v1/subjects", "Discover registered subjects and selected public constraints."],
  ["POST /v1/contracts", "Authenticate and negotiate permitted subjects and operations."],
  ["POST /v1/messages", "Publish a governed message under x-pigeon-contract."],
  ["POST /v1/subjects/{subject}/receive", "Receive messages when the contract contains receive authority."],
  ["GET /v1/audit", "Read current audit records."],
  ["GET /v1/quarantine", "Inspect quarantined communication."],
  ["POST /v1/quarantine/{id}/release", "Release a quarantined record when the caller and contract permit it."],
] as const;

export default function ProtocolPage() {
  return (
    <DocsShell
      eyebrow="Protocol reference"
      title="Pigeon Protocol v1."
      intro="Protocol v1 is the language-neutral HTTP + JSON contract between PigeonMQ brokers and clients. SDKs preserve these semantics instead of reimplementing broker policy logic."
    >
      <h2>Design invariant</h2>
      <p><strong>A governed operation requires an authenticated principal and a valid runtime communication contract.</strong> Clients do not assert their own authority. The broker resolves identity, negotiates a contract and validates subsequent operations under that contract ID.</p>

      <h2>Required headers</h2>
      <div className="docs-table-wrap"><table><thead><tr><th>Header</th><th>Purpose</th></tr></thead><tbody>
        <tr><td><code>authorization: Bearer &lt;credential&gt;</code></td><td>Authenticate the calling principal.</td></tr>
        <tr><td><code>x-pigeon-contract: &lt;contract_id&gt;</code></td><td>Bind a governed operation to a negotiated contract.</td></tr>
        <tr><td><code>x-pigeon-region: &lt;region&gt;</code></td><td>Supply the runtime region used by current policy gates.</td></tr>
        <tr><td><code>content-type: application/json</code></td><td>JSON request bodies.</td></tr>
      </tbody></table></div>

      <h2>Endpoints</h2>
      <div className="docs-table-wrap"><table><thead><tr><th>Endpoint</th><th>Purpose</th></tr></thead><tbody>
        {endpoints.map(([endpoint, purpose]) => <tr key={endpoint}><td><code>{endpoint}</code></td><td>{purpose}</td></tr>)}
      </tbody></table></div>

      <h2>Negotiate a contract</h2>
      <pre><code>{`POST /v1/contracts
Authorization: Bearer <credential>
Content-Type: application/json

{
  "subjects": ["payments.authorize"],
  "ttlMs": 900000
}`}</code></pre>
      <p>The broker returns only the requested subjects and operations permitted for the authenticated principal. A principal with no permitted requested subjects receives a typed denial and no contract is issued.</p>

      <h2>Publish</h2>
      <pre><code>{`POST /v1/messages
Authorization: Bearer <credential>
x-pigeon-contract: contract_1
Content-Type: application/json

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
}`}</code></pre>
      <p>A new accepted message returns HTTP <code>202</code>. A recognised duplicate may return HTTP <code>200</code> with <code>status: "duplicate"</code>. Contract or policy failures can deny or quarantine an otherwise well-formed message.</p>

      <h2>Typed errors</h2>
      <pre><code>{`{
  "error": {
    "code": "CONTRACT_REQUIRED",
    "message": "...",
    "details": {}
  }
}`}</code></pre>
      <p>Representative codes include <code>UNAUTHENTICATED</code>, <code>CONTRACT_EXPIRED</code>, <code>SUBJECT_NOT_IN_CONTRACT</code>, <code>INTENT_DENIED</code>, <code>REGION_DENIED</code>, <code>SENSITIVE_FIELD_DENIED</code>, <code>IDEMPOTENCY_REQUIRED</code>, <code>SCHEMA_INVALID</code> and <code>RATE_LIMITED</code>.</p>

      <h2>Versioning</h2>
      <p>SDK compatibility is defined against Pigeon Protocol v1, not identical package patch versions. A breaking wire or semantic change requires a new protocol version.</p>

      <div className="docs-link-row">
        <a href="https://github.com/vishnu-77/pigeon/blob/main/spec/protocol-v1.md" target="_blank" rel="noreferrer">Canonical protocol specification ↗</a>
        <a href="/quickstart">Quickstart →</a>
      </div>
    </DocsShell>
  );
}
