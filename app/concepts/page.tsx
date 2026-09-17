import type { Metadata } from "next";
import { DocsShell } from "@/components/DocsShell";

export const metadata: Metadata = {
  title: "Core concepts — PigeonMQ",
  description: "Learn the core concepts behind PigeonMQ communication contracts, message admission, quarantine and audit evidence.",
};

const concepts = [
  ["Principal", "The authenticated identity calling the broker. Pigeon resolves identity from credentials; message fields do not get to invent the caller's identity."],
  ["Subject", "The named communication channel, such as orders.created or payments.authorize. Subject policy defines the operations and constraints that can be negotiated."],
  ["Communication contract", "A short-lived broker-issued session object binding a principal to permitted subjects and operations, plus policy-derived constraints such as schema and expiry."],
  ["Message envelope", "The governed message submitted under a contract. It carries the subject, intent, idempotency key, classification, region and application data used by admission gates."],
  ["Admission gates", "The ordered checks that run before append or delivery. Current gates cover identity, intent, schema, region, sensitive data/classification and idempotency."],
  ["Decision", "The broker outcome for the operation. Pigeon can allow, deny or quarantine and records typed evidence for the decision."],
  ["Quarantine", "A retained record for communication that must not proceed to the receiver. Quarantined records can be inspected and are only releasable through an authorised broker operation."],
  ["Audit event", "The evidence trail describing broker decisions and governed operations. Audit records are part of the protocol rather than an application-side afterthought."],
] as const;

export default function ConceptsPage() {
  return (
    <DocsShell
      eyebrow="Core concepts"
      title="The objects that make communication authority explicit."
      intro="PigeonMQ keeps familiar broker primitives such as subjects and messages, then adds a broker-issued communication contract and explicit admission decisions to the runtime path."
    >
      <h2>Lifecycle</h2>
      <pre><code>{`credential
    ↓
principal
    ↓  request subjects + operations
communication contract
    ↓  x-pigeon-contract
message envelope
    ↓
admission gates
    ↓
ALLOW | DENY | QUARANTINE
    ↓
delivery / evidence`}</code></pre>

      <div className="docs-card-grid">
        {concepts.map(([title, copy]) => (
          <section key={title} className="docs-card docs-card-static">
            <h3>{title}</h3>
            <p>{copy}</p>
          </section>
        ))}
      </div>

      <h2>Authority is negotiated, not asserted</h2>
      <p>A client asks for the subjects and operations it needs. The broker authenticates the principal and issues only the subset permitted by policy. Subsequent publish, receive, replay and acknowledgement operations must carry the resulting contract ID.</p>

      <h2>Contracts do not replace message admission</h2>
      <p>The contract establishes the communication scope for a session. Each message still passes the broker's admission chain, so a permitted publisher can still be denied or quarantined when the message violates schema, region, classification, sensitive-data or idempotency constraints.</p>

      <h2>Identity stays server-side</h2>
      <p>Authentication determines the principal. A client-supplied field such as <code>source</code> is message data, not proof of identity.</p>

      <div className="docs-link-row">
        <a href="/quickstart">Run the quickstart →</a>
        <a href="/protocol">Read Protocol v1 →</a>
      </div>
    </DocsShell>
  );
}
