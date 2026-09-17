import type { Metadata } from "next";
import { DocsShell } from "@/components/DocsShell";

export const metadata: Metadata = {
  title: "Use cases — PigeonMQ",
  description: "Messaging patterns for PigeonMQ across services, workers, agents, regional data flows and operational workflows.",
};

const cases = [
  ["Service-to-service messaging", "orders.created", "Use subject policy plus runtime contracts to bind producers and consumers to explicit operations, schema and message context."],
  ["Asynchronous workers", "jobs.process", "Issue bounded publish and receive authority to workers rather than treating every connected worker as indefinitely authorised."],
  ["AI agents and tool runners", "agents.tool.invoke", "Carry delegated intent, tool scope and message context into asynchronous agent-to-tool communication."],
  ["Regional data processing", "customer.profile.export", "Evaluate region and data classification constraints before a message crosses a processing boundary."],
  ["Operational automation", "deploy.release.request", "Apply explicit intent and environment constraints to CI, deployment and infrastructure events."],
  ["Domain messaging", "notifications.send", "Apply schema, sensitive-field and idempotency rules to application-specific communication paths."],
] as const;

export default function UseCasesPage() {
  return (
    <DocsShell
      eyebrow="Use cases"
      title="One broker model across different communication paths."
      intro="PigeonMQ does not encode one business domain. Subjects and policy define the application-specific rules; communication contracts and admission semantics stay consistent across the broker."
    >
      <div className="docs-card-grid">
        {cases.map(([title, subject, copy]) => (
          <section key={subject} className="docs-card docs-card-static">
            <p className="font-mono text-xs text-accent">{subject}</p>
            <h3>{title}</h3>
            <p>{copy}</p>
          </section>
        ))}
      </div>

      <h2>Common enforcement model</h2>
      <p>Every use case follows the same protocol shape:</p>
      <pre><code>{`authenticate principal
        ↓
request subject + operation
        ↓
communication contract
        ↓
submit governed message
        ↓
identity → intent → schema → region → data → idempotency
        ↓
allow | deny | quarantine`}</code></pre>

      <h2>What changes by application</h2>
      <p>The subject definition determines which operations are available and which constraints matter. A deployment event may care about environment and intent; a regional data flow may care about classification and region; an agent tool invocation may care about delegated intent and tool scope.</p>

      <h2>What stays consistent</h2>
      <p>Identity is established by the broker, authority is represented by a short-lived contract, each governed operation carries the contract ID, and broker decisions produce typed evidence.</p>

      <div className="docs-link-row">
        <a href="/concepts">Core concepts →</a>
        <a href="/protocol">Protocol v1 →</a>
        <a href="/demo">Run the live demo →</a>
      </div>
    </DocsShell>
  );
}
