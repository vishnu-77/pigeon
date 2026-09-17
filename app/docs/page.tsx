import type { Metadata } from "next";
import { DocsShell } from "@/components/DocsShell";

export const metadata: Metadata = {
  title: "Documentation — PigeonMQ",
  description: "Get started with PigeonMQ, learn the core concepts, and explore Pigeon Protocol v1.",
};

const sections = [
  ["Quickstart", "Install PigeonMQ, start a broker, negotiate a communication contract and publish your first governed message.", "/quickstart"],
  ["Core concepts", "Understand principals, subjects, communication contracts, admission gates, decisions, quarantine and audit evidence.", "/concepts"],
  ["Protocol v1", "Use the language-neutral HTTP + JSON protocol directly or through an official client.", "/protocol"],
  ["Use cases", "See how the same broker model applies to service messaging, workers, agents, regional flows and operational events.", "/use-cases"],
  ["Live demo", "Run an allowed or violating message through a deployed sender, broker and receiver path.", "/demo"],
  ["Architecture", "Read the current architecture, ADRs and implementation notes in the repository.", "https://github.com/vishnu-77/pigeon/tree/main/docs"],
] as const;

export default function DocsPage() {
  return (
    <DocsShell
      eyebrow="PigeonMQ documentation"
      title="Build with contract-native messaging."
      intro="PigeonMQ is an open-source message broker where authenticated principals negotiate short-lived communication contracts and every governed operation is evaluated against broker policy before delivery."
    >
      <h2>Start here</h2>
      <p>The documentation is organised around the same path a message takes through the broker: authenticate, negotiate a contract, publish or receive, evaluate admission gates, then record the resulting decision.</p>
      <div className="docs-card-grid">
        {sections.map(([title, copy, href]) => (
          <a key={href} href={href} className="docs-card" target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
            <h3>{title}</h3>
            <p>{copy}</p>
            <span>Open →</span>
          </a>
        ))}
      </div>

      <h2>Broker model</h2>
      <pre><code>{`credential
    ↓
authenticated principal
    ↓
POST /v1/contracts
    ↓
communication contract
    ↓
identity → intent → schema → region → data → idempotency
                                              ↓
                              allow | deny | quarantine`}</code></pre>

      <h2>Current protocol</h2>
      <p>Pigeon Protocol v1 uses HTTP + JSON. The Node.js implementation is the canonical broker today, while JavaScript, Python and Rust clients preserve the same protocol semantics.</p>
    </DocsShell>
  );
}
