import type { Metadata } from "next";
import { DocsShell } from "@/components/DocsShell";

export const metadata: Metadata = {
  title: "Documentation — PigeonMQ",
  description: "PigeonMQ documentation: quickstart, concepts, protocol, messaging patterns, architecture and live demo.",
};

const sections = [
  ["Quickstart", "Install the package, start a broker, negotiate a communication contract and publish your first governed message.", "/quickstart"],
  ["Core concepts", "Learn principals, subjects, communication contracts, message envelopes, admission gates, decisions, quarantine and audit evidence.", "/concepts"],
  ["Protocol v1", "Use the language-neutral HTTP + JSON protocol directly or through a client implementation.", "/protocol"],
  ["Use cases", "Apply the same broker model to service messaging, asynchronous workers, agent-to-tool calls, regional flows and operational events.", "/use-cases"],
  ["Live demo", "Run an allowed or violating message and inspect the broker decision before receiver delivery.", "/demo"],
  ["Architecture", "Read ADRs, message flows and implementation notes in the repository.", "https://github.com/vishnu-77/pigeon/tree/main/docs"],
] as const;

export default function DocsPage() {
  return (
    <DocsShell
      eyebrow="PigeonMQ documentation"
      title="Everything needed to understand and build with PigeonMQ."
      intro="PigeonMQ is a contract-native message broker. Start with the quickstart, then learn the runtime model, protocol and message-admission semantics that every client shares."
    >
      <h2>Start here</h2>
      <p>The fastest path is: start one broker, authenticate a producer, negotiate a communication contract, publish a message, and inspect the broker decision. From there, the documentation separates concepts from protocol details so application code does not need to reimplement broker policy.</p>

      <div className="docs-card-grid">
        {sections.map(([title, copy, href]) => (
          <a key={href} href={href} className="docs-card" target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
            <h3>{title}</h3>
            <p>{copy}</p>
            <span>Open →</span>
          </a>
        ))}
      </div>

      <h2>Broker model in one view</h2>
      <pre><code>{`credential
    ↓
authenticated principal
    ↓
request subjects + operations
    ↓
communication contract
    ↓
publish / receive / replay / acknowledge
    ↓
identity → intent → schema → region → data → idempotency
                                              ↓
                              allow | deny | quarantine
                                              ↓
                                    delivery + evidence`}</code></pre>

      <h2>What the broker is responsible for</h2>
      <div className="docs-table-wrap">
        <table>
          <thead><tr><th>Concern</th><th>PigeonMQ behaviour</th></tr></thead>
          <tbody>
            <tr><td>Identity</td><td>Resolve the principal from credentials at the broker boundary.</td></tr>
            <tr><td>Authority</td><td>Issue a short-lived contract containing the permitted communication scope.</td></tr>
            <tr><td>Message admission</td><td>Evaluate runtime constraints before a governed operation proceeds.</td></tr>
            <tr><td>Containment</td><td>Deny or quarantine communication that falls outside policy.</td></tr>
            <tr><td>Evidence</td><td>Return typed decisions and retain audit information for governed operations.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Protocol and clients</h2>
      <p>Pigeon Protocol v1 uses HTTP + JSON. The Node.js implementation is the canonical broker today. JavaScript, Python and Rust clients target the same protocol semantics, so language choice does not change how contracts and broker decisions work.</p>

      <h2>Suggested reading order</h2>
      <ol>
        <li><a href="/quickstart">Quickstart</a> — run the system end to end.</li>
        <li><a href="/concepts">Core concepts</a> — understand the runtime objects.</li>
        <li><a href="/protocol">Protocol v1</a> — integrate without relying on a specific SDK.</li>
        <li><a href="/use-cases">Use cases</a> — map the model to real messaging patterns.</li>
        <li><a href="/demo">Live demo</a> — inspect an allow/quarantine decision interactively.</li>
      </ol>
    </DocsShell>
  );
}
