"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, Github, Terminal } from "lucide-react";
import { PigeonLogo } from "@/components/PigeonLogo";

const SOURCE = "https://github.com/vishnu-77/pigeon";
const DOCS = `${SOURCE}/blob/main/README.md`;
const PLAYGROUND = process.env.NODE_ENV === "development" ? "/demo/" : "https://demo.pigeonmq.cc";
const CLI = "npm install pigeonmq\nnpx pigeon broker start";
const CLIENT = `import { PigeonClient } from "pigeonmq";

const client = new PigeonClient({
  url: "http://localhost:8787",
  token: "orders-token" // local demo identity
});

await client.connect(["notifications.send"]);

await client.request("notifications.send", {
  recipientId: "customer_28",
  channel: "email",
  templateId: "order_shipped"
}, {
  intent: "send_notification",
  idempotencyKey: "order_1042:notify",
  classification: "pii",
  region: "uk"
});`;
const HTTP = `curl http://localhost:8787/v1/contracts \\
  -H "Authorization: Bearer orders-token" \\
  -H "Content-Type: application/json" \\
  -H "X-Pigeon-Region: uk" \\
  -d '{"subjects":["notifications.send"]}'

# Use the returned contract.id in subsequent
# requests via the X-Pigeon-Contract header.`;
const FEATURES = [
  ["01", "Runtime communication contracts", "Bind an authenticated principal to permitted subjects and operations. Negotiate a short-lived contract before publishing or receiving.", "identity → contract → operation"],
  ["02", "Policy before delivery", "Enforce intent, schema, region, classification and field restrictions on a message before it enters the delivery path.", "evaluate → accept / refuse"],
  ["03", "Subjects and message patterns", "Organise communication into named subjects. Model publish/subscribe, work queues and request/reply with subject-level governance.", "pub/sub · work queue · request/reply"],
  ["04", "Evidence for every decision", "Inspect accepted and refused publishes through structured audit records. Quarantine supported violations with sensitive fields redacted.", "decision → audit → quarantine"],
  ["05", "Delivery controls", "Use idempotency keys, acknowledgement and policy-governed replay to control how messages are accepted and consumed.", "deduplicate · acknowledge · replay"],
  ["06", "Policies you can version", "Author subjects and schemas as JSON. Lint the catalog and load communication rules independently of application code.", "author → lint → load"]
];

function SectionTitle({ label, title, children }: { label: string; title: string; children?: React.ReactNode }) {
  return <div className="infra-section-title"><span className="infra-kicker">{label}</span><h2>{title}</h2>{children && <p>{children}</p>}</div>;
}

function Architecture() {
  return <figure className="infra-architecture">
    <figcaption><span><span className="infra-status-dot" /> THE MESSAGE PATH</span><span>ILLUSTRATIVE</span></figcaption>
    <div className="infra-diagram-sources"><div><Terminal size={15} /><span>Services</span></div><div><span className="infra-agent-icon" aria-hidden="true">⌘</span><span>Agents</span></div><div><span className="infra-agent-icon" aria-hidden="true">≡</span><span>Workers</span></div></div>
    <div className="infra-connector"><span>authenticate + negotiate</span><span aria-hidden="true">↓</span></div>
    <div className="infra-broker-node"><div className="infra-node-title"><PigeonLogo size={31} /><strong>PIGEON</strong><span>BROKER</span></div><div className="infra-contract-strip"><span>RUNTIME CONTRACT</span><code>principal · subjects · operations · expiry</code></div><div className="infra-gates"><span>Intent</span><span>Schema</span><span>Region</span><span>Data</span></div><p>Every publish is checked against the contract and subject policy.</p></div>
    <div className="infra-diagram-outcomes"><div><span className="infra-outcome-line" aria-hidden="true">↓</span><span className="infra-outcome infra-outcome-allow">ALLOW</span><strong>Deliver to receiver</strong></div><div><span className="infra-outcome-line" aria-hidden="true">↓</span><span className="infra-outcome infra-outcome-deny">DENY / QUARANTINE</span><strong>Contain the violation</strong></div></div>
    <div className="infra-audit-line"><span aria-hidden="true">↳</span> Structured audit evidence along the path</div>
  </figure>;
}

export function PigeonSite() {
  const [tab, setTab] = useState<"node" | "http">("node");
  const [copyState, setCopyState] = useState("");
  async function copyInstall() {
    try { await navigator.clipboard.writeText(CLI); setCopyState("Copied"); }
    catch { setCopyState("Select the commands to copy"); }
  }
  return <div className="infra-site">
    <a className="infra-skip" href="#main">Skip to content</a>
    <header className="infra-header"><nav className="site-navigation infra-container infra-nav" aria-label="Main">
      <a href="/" className="infra-logo" aria-label="Pigeon home"><PigeonLogo size={34} /><span>PIGEON</span></a>
      <div className="infra-nav-main"><a href="#overview">Overview</a><a href="#capabilities">Capabilities</a><a href={DOCS}>Documentation <span aria-hidden="true">↗</span></a><a href="#ecosystem">Ecosystem</a></div>
      <div className="infra-nav-actions"><a href={SOURCE} className="infra-github" aria-label="Pigeon on GitHub"><Github size={18} /><span>GitHub</span></a><a className="infra-button infra-button-small" href={PLAYGROUND}>Try Pigeon <ArrowRight size={13} /></a></div>
    </nav><details className="infra-mobile-menu"><summary>Explore Pigeon</summary><div><a href="#overview">Overview</a><a href="#capabilities">Capabilities</a><a href={DOCS}>Documentation</a><a href="#ecosystem">Ecosystem</a></div></details></header>

    <main id="main">
      <section className="infra-hero infra-container" id="overview">
        <div className="infra-hero-copy"><div className="infra-hero-label"><span className="infra-status-dot" /> OPEN-SOURCE MESSAGING INFRASTRUCTURE</div><h1>Messaging.<br />With policy<br /><span>built in.</span></h1><p className="infra-hero-description">Pigeon is a contract-native message broker for services, agents and workers. Define who can communicate, what they can send and where it can go. Enforce those rules before delivery.</p><div className="infra-hero-actions"><a href="#quickstart" className="infra-button">Get started <ArrowRight size={16} /></a><a href={PLAYGROUND} className="infra-button infra-button-outline">Open the playground <ArrowRight size={16} /></a></div><div className="infra-hero-install"><span>$</span><code>npm install pigeonmq</code><span>Node.js 22+</span></div><p className="infra-project-note">Apache-2.0 licensed. Early-stage broker and research project.</p></div>
        <Architecture />
      </section>
      <div className="infra-foundations"><div className="infra-container"><span>THE FOUNDATIONS</span><strong>Subjects</strong><span aria-hidden="true">/</span><strong>Contracts</strong><span aria-hidden="true">/</span><strong>Policies</strong><span aria-hidden="true">/</span><strong>Delivery</strong><span aria-hidden="true">/</span><strong>Evidence</strong></div></div>
      <section className="infra-section infra-container" id="capabilities"><SectionTitle label="CORE CAPABILITIES" title="A broker that knows the rules.">Messaging primitives and communication policy meet in the same runtime. Here is what Pigeon implements today.</SectionTitle><div className="infra-feature-grid">{FEATURES.map(([number, title, copy, detail]) => <article key={number}><span className="infra-feature-number">{number}</span><h3>{title}</h3><p>{copy}</p><code>{detail}</code></article>)}</div></section>
      <section className="infra-model-section" id="architecture"><div className="infra-container infra-model-grid"><SectionTitle label="THE COMMUNICATION MODEL" title="Permission belongs to a session. Policy applies to every message.">A subject names the communication channel. A contract grants authority to use it. The broker evaluates each message before routing it.</SectionTitle><ol className="infra-model-steps">{[
        ["Authenticate", "Resolve the sender’s identity from a credential."],
        ["Negotiate", "Request subjects. Receive a contract for the operations policy permits."],
        ["Publish", "Send a message with its intent, context and contract reference."],
        ["Enforce & deliver", "Accept valid messages. Refuse violations and record the decision."]
      ].map(([title, copy], i) => <li key={title}><span>{String(i + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol></div></section>
      <section className="infra-section infra-container infra-lab-section"><div><span className="infra-kicker">LEARN BY CHANGING THE RULES</span><h2>Same message.<br /><span>Different policy.</span></h2><p>Write a message. Edit its communication rules. Run it through a real, isolated Pigeon broker and inspect the receiver and audit trail.</p><ul><li><Check size={15} /> Change allowed senders and regions</li><li><Check size={15} /> Require fields or block sensitive data</li><li><Check size={15} /> Compare decisions across policy changes</li></ul><a href={PLAYGROUND} className="infra-button">Experiment with a policy <ArrowRight size={15} /></a></div><div className="infra-lab-example"><div className="infra-code-heading"><span>policy.json</span><span>PLAYGROUND RULES</span></div><pre><code>{`{
  "allowedSenders": ["my-app"],
  "allowedRegions": ["uk", "eu"],
  "forbiddenFields": ["password"],
  "requiredFields": ["message"]
}`}</code></pre><div className="infra-lab-diff"><span>Change one rule</span><code><del>"allowedSenders": ["my-app"]</del><ins>"allowedSenders": []</ins></code></div><div className="infra-lab-result"><span>ALLOW <ArrowRight size={15} /> DENY</span><p>Same payload. The sender no longer has permission.</p></div><p className="infra-example-note">Illustrative policy change. Open the playground to execute it.</p></div></section>
      <section className="infra-quickstart-section" id="quickstart"><div className="infra-container infra-section"><SectionTitle label="START BUILDING" title="From install to your first contract.">Start the local broker, connect a client and send a governed message. The example below uses the included notification subject and local demo identity.</SectionTitle><div className="infra-quickstart-grid"><div className="infra-quickstart-instructions"><h3><span>01</span> Start a broker</h3><p>Install Pigeon with Node.js 22 or newer. Run these commands in a project directory.</p><div className="infra-install-code"><pre>{CLI}</pre><button type="button" onClick={copyInstall} aria-label="Copy installation commands"><Copy size={15} /></button></div><p className="infra-copy-feedback" role="status">{copyState}</p><h3><span>02</span> Connect and communicate</h3><p>Save the Node.js example as <code>example.mjs</code> and run <code>node example.mjs</code> in another terminal. The client negotiates a contract before publishing.</p><a className="infra-text-link" href={`${DOCS}#quick-start`}>Full quickstart <ArrowRight size={14} /></a><div className="infra-quickstart-links"><a href={`${SOURCE}/tree/main/policies`}>Author a subject policy ↗</a><a href={`${SOURCE}/blob/main/spec/protocol-v1.md`}>Explore the HTTP protocol ↗</a></div></div><div className="infra-client-code"><div className="infra-code-tabs" role="tablist" aria-label="Client examples"><button type="button" id="example-node" role="tab" aria-selected={tab === "node"} aria-controls="client-example" onClick={() => setTab("node")}>Node.js / TypeScript</button><button type="button" id="example-http" role="tab" aria-selected={tab === "http"} aria-controls="client-example" onClick={() => setTab("http")}>HTTP</button><span>{tab === "node" ? "example.mjs" : "terminal"}</span></div><pre id="client-example" role="tabpanel" aria-labelledby={`example-${tab}`}><code>{tab === "node" ? CLIENT : HTTP}</code></pre></div></div></div></section>
      <section className="infra-section infra-container" id="use-cases"><SectionTitle label="WHERE IT FITS" title="Build your own communication boundary.">Payments, notifications and agent tools are examples. The primitive is a subject with rules for the messages that cross it.</SectionTitle><div className="infra-usecase-grid">{[
        ["Service → service", "Control which application can publish to a subject and require a valid message shape.", "Identity + schema"],
        ["Producer → regional worker", "Require messages to declare an allowed region before the broker accepts them.", "Region constraints"],
        ["Application → notification worker", "Reference a recipient by ID while rejecting prohibited personal-data fields.", "Field restrictions"],
        ["Agent → tool runner", "Explore how an agent’s communication contract can scope subjects and permitted intent.", "Application pattern"]
      ].map(([title, copy, tag]) => <article key={title}><span>{tag}</span><h3>{title}</h3><p>{copy}</p><a href={PLAYGROUND}>Explore in the playground <ArrowRight size={13} /></a></article>)}</div></section>
      <section className="infra-ecosystem-section" id="ecosystem"><div className="infra-container infra-section"><SectionTitle label="OPEN PROTOCOL. OPEN SOURCE." title="Work in your stack. Inspect the implementation.">The HTTP protocol is the common boundary. Start with the JavaScript client or explore the Python and Rust clients in the repository.</SectionTitle><div className="infra-sdk-links">{[
        ["JS / TS", "JavaScript & TypeScript", "npm package", "https://www.npmjs.com/package/pigeonmq"],
        ["PY", "Python", "Repository SDK", `${SOURCE}/tree/main/sdk/python`],
        ["RS", "Rust", "Repository SDK", `${SOURCE}/tree/main/sdk/rust`],
        ["HTTP", "Any HTTP client", "Protocol v1", `${SOURCE}/blob/main/spec/protocol-v1.md`]
      ].map(([mark, title, detail, href]) => <a key={mark} href={href}><strong>{mark}</strong><div><h3>{title}</h3><p>{detail}</p></div><ArrowRight size={16} /></a>)}</div><div className="infra-project-boundary"><div><span className="infra-kicker">PROJECT STATUS</span><h3>Built in the open.<br />Still being developed.</h3></div><p>Pigeon is an early-stage implementation of contract-native messaging. Its current focus is broker enforcement, protocol behaviour and evidence. Distributed replication, high availability and production-scale operation remain development work.</p><a href={`${SOURCE}/blob/main/docs/backlog.md`}>Read the roadmap <ArrowRight size={14} /></a></div></div></section>
      <section className="infra-container infra-closing"><div><span className="infra-kicker">TAKE THE NEXT STEP</span><h2>Put a message through Pigeon.</h2><p>Try your own rules. Read the protocol. Build something with it.</p></div><div><a href={PLAYGROUND} className="infra-button">Launch playground <ArrowRight size={15} /></a><a href={DOCS} className="infra-button infra-button-outline">Read the docs</a></div></section>
    </main>
    <footer className="infra-footer"><div className="infra-container"><div><a href="/" className="infra-logo"><PigeonLogo size={29} /><span>PIGEON</span></a><p>Contract-native messaging.<br />Apache-2.0 licensed.</p></div><div><strong>Build</strong><a href="#quickstart">Quickstart</a><a href={PLAYGROUND}>Playground</a><a href={DOCS}>Documentation</a></div><div><strong>Understand</strong><a href="#architecture">Architecture</a><a href={`${SOURCE}/blob/main/docs/vision.md`}>Research & vision</a><a href={`${SOURCE}/blob/main/docs/adr/README.md`}>Design decisions</a></div><div><strong>Contribute</strong><a href={SOURCE}>Source code</a><a href={`${SOURCE}/issues`}>Issues & feedback</a><a href={`${SOURCE}/blob/main/CONTRIBUTING.md`}>Contribution guide</a></div></div></footer>
  </div>;
}
