"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Copy, Github } from "lucide-react";

const GITHUB = "https://github.com/vishnu-77/pigeon";
const DEMO = "https://demo.pigeonmq.cc";

type Tab = "why" | "how" | "applications" | "try" | "performance";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "why", label: "Why Pigeon" },
  { id: "how", label: "How it works" },
  { id: "applications", label: "Applications" },
  { id: "try", label: "Try a message" },
  { id: "performance", label: "Performance" }
];

export function Landing() {
  const [tab, setTab] = useState<Tab>("why");

  return (
    <div className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <header className="sticky top-0 z-40 border-b rule bg-[color:var(--paper)]/95 backdrop-blur-sm">
        <nav className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-5 sm:px-8" aria-label="Main navigation">
          <a href="#top" className="font-semibold tracking-[-0.025em]">PIGEON</a>
          <div className="hidden flex-1 items-center justify-center gap-7 text-sm text-[color:var(--muted)] lg:flex">
            <a href="#understand" className="hover:text-[color:var(--ink)]">Concepts</a>
            <a href="#quickstart" className="hover:text-[color:var(--ink)]">Quickstart</a>
            <a href={DEMO} className="hover:text-[color:var(--ink)]">Demo</a>
          </div>
          <a href={GITHUB} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-2 text-sm font-medium">
            <Github size={15} /> GitHub
          </a>
        </nav>
      </header>

      <main id="top">
        <Hero />
        <Understand tab={tab} setTab={setTab} />
        <CoreConcepts />
        <Quickstart />
        <Gateway />
      </main>

      <footer className="border-t rule">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-8 text-sm text-[color:var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Pigeon · contract-native messaging · Apache-2.0</span>
          <div className="flex gap-5">
            <a href="https://www.npmjs.com/package/pigeonmq" className="hover:text-[color:var(--ink)]">npm</a>
            <a href={`${GITHUB}/tree/main/docs`} className="hover:text-[color:var(--ink)]">Docs</a>
            <a href={`${GITHUB}/issues`} className="hover:text-[color:var(--ink)]">Issues</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <section className="border-b rule">
      <div className="mx-auto grid max-w-[1280px] gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center">
        <div>
          <p className="kicker mono text-[color:var(--brand)]">Open source · contract-native messaging</p>
          <h1 className="mt-6 max-w-[50rem] text-[3.25rem] font-semibold leading-[.94] tracking-[-.055em] sm:text-[5rem]">
            Every message runs under a contract.
          </h1>
          <p className="mt-7 max-w-[46rem] text-[1.08rem] leading-8 text-[color:var(--muted)]">
            Pigeon is a message broker that turns communication policy into short-lived runtime contracts. Producers and consumers authenticate, negotiate what they may communicate, then operate under that contract.
          </p>

          <div className="mt-8 inline-grid border border-[color:var(--line-strong)] bg-[color:var(--paper-soft)] mono text-[.82rem] sm:grid-cols-7">
            {[
              "Principal",
              "→",
              "Contract",
              "→",
              "Message",
              "→",
              "Decision"
            ].map((item, index) => (
              <span key={`${item}-${index}`} className={`px-3 py-2.5 ${index ? "border-t rule sm:border-l sm:border-t-0" : ""}`}>{item}</span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
            <a href={DEMO} className="action-link">Try Pigeon <ArrowRight size={14} /></a>
            <a href="#quickstart" className="action-link">Quickstart <ArrowRight size={14} /></a>
            <a href={GITHUB} target="_blank" rel="noreferrer" className="action-link">View source <ArrowRight size={14} /></a>
          </div>
        </div>

        <HeroContract />
      </div>
    </section>
  );
}

function HeroContract() {
  return (
    <div className="border border-[color:var(--line-strong)] bg-[color:var(--paper-soft)]">
      <div className="flex items-center justify-between border-b rule px-4 py-3">
        <span className="mono text-xs text-[color:var(--muted)]">COMMUNICATION CONTRACT</span>
        <span className="mono text-xs text-[color:var(--allow)]">ACTIVE</span>
      </div>
      <dl className="divide-y divide-[color:var(--line)] text-sm">
        <ContractRow label="principal" value="orders-api" />
        <ContractRow label="subject" value="notifications.send" />
        <ContractRow label="operation" value="publish" />
        <ContractRow label="intent" value="send_notification" />
        <ContractRow label="region" value="uk" />
        <ContractRow label="classification" value="pii" />
      </dl>
      <div className="border-t rule px-4 py-3 text-sm text-[color:var(--muted)]">
        The message carries data. The contract carries communication authority.
      </div>
    </div>
  );
}

function ContractRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[125px_1fr] px-4 py-3">
      <dt className="mono text-xs text-[color:var(--muted)]">{label}</dt>
      <dd className="mono text-xs text-[color:var(--ink)]">{value}</dd>
    </div>
  );
}

function Understand({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  return (
    <section id="understand" className="border-b rule">
      <div className="section-shell">
        <div className="max-w-[52rem]">
          <p className="kicker mono text-[color:var(--brand)]">Understand Pigeon</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Start with the messaging model, then try it.</h2>
          <p className="mt-4 max-w-[48rem] leading-7 text-[color:var(--muted)]">The same broker primitive can sit between ordinary services, workflows and agent systems. These examples show where the contract model can be applied.</p>
        </div>

        <div className="mt-10 overflow-x-auto border border-[color:var(--line-strong)]">
          <div className="flex min-w-max bg-[color:var(--paper-soft)]">
            {TABS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-4 py-3 text-sm ${index ? "border-l rule" : ""} ${tab === item.id ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : "text-[color:var(--muted)] hover:text-[color:var(--ink)]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="min-h-[410px] bg-[color:var(--paper-soft)] p-5 sm:p-7">
            {tab === "why" && <WhyTab />}
            {tab === "how" && <HowTab />}
            {tab === "applications" && <ApplicationsTab />}
            {tab === "try" && <TryTab />}
            {tab === "performance" && <PerformanceTab />}
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyTab() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="border border-[color:var(--line)] p-5">
        <p className="mono text-xs text-[color:var(--muted)]">SUBJECT PERMISSION</p>
        <h3 className="mt-3 text-xl font-semibold">Where may this principal communicate?</h3>
        <pre className="mt-6 whitespace-pre-wrap mono text-sm leading-7 text-[color:var(--muted)]">{`checkout-api\n     ↓\nmay publish\n     ↓\npayments.authorize`}</pre>
      </div>
      <div className="border border-[color:var(--ink)] p-5">
        <p className="mono text-xs text-[color:var(--brand)]">PIGEON CONTRACT</p>
        <h3 className="mt-3 text-xl font-semibold">Under what authority may it communicate?</h3>
        <pre className="mt-6 whitespace-pre-wrap mono text-sm leading-7 text-[color:var(--muted)]">{`checkout-api\n     ↓\ncontract\n  subject      payments.authorize\n  operation    publish\n  intent       authorize_payment\n  region       uk\n  data         pci\n     ↓\nmessage → decision`}</pre>
      </div>
    </div>
  );
}

function HowTab() {
  const stages = [
    ["01", "Authenticate", "Resolve the principal from trusted credentials."],
    ["02", "Negotiate contract", "Intersect the requested communication with subject policy and issue a short-lived contract."],
    ["03", "Communicate", "Publish, receive, acknowledge or replay while presenting the negotiated contract."],
    ["04", "Decide", "Evaluate identity, intent, schema, region, data policy and idempotency before delivery."]
  ];

  return (
    <div>
      <div className="grid border border-[color:var(--line)] md:grid-cols-4">
        {stages.map(([n, title, copy], index) => (
          <div key={title} className={`p-5 ${index ? "border-t rule md:border-l md:border-t-0" : ""}`}>
            <p className="mono text-xs text-[color:var(--brand)]">{n}</p>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{copy}</p>
          </div>
        ))}
      </div>
      <div className="mt-7 grid gap-2 mono text-xs sm:grid-cols-6">
        {[
          ["identity", true],
          ["intent", true],
          ["schema", true],
          ["region", true],
          ["data", true],
          ["idempotency", true]
        ].map(([name]) => (
          <div key={String(name)} className="flex items-center justify-between border border-[color:var(--line)] px-3 py-3">
            <span className="text-[color:var(--muted)]">{String(name)}</span><Check size={13} className="text-[color:var(--allow)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ApplicationsTab() {
  const applications = [
    {
      title: "Service → service",
      path: "order service → notifications.send → notifier",
      boundaries: "intent · PII · region · idempotency",
      status: "LIVE EXAMPLE"
    },
    {
      title: "Transaction → gateway",
      path: "checkout → payments.authorize → gateway",
      boundaries: "PCI · tokenisation · region · forbidden fields",
      status: "LIVE EXAMPLE"
    },
    {
      title: "Agent → tool",
      path: "agent → agents.tool.invoke → tool runner",
      boundaries: "agent identity · task intent · tool scope · lifetime",
      status: "EXAMPLE APPLICATION"
    },
    {
      title: "Agent → agent / A2A",
      path: "agent A → agents.delegate.task → agent B",
      boundaries: "caller · receiver · delegated task · scope · lifetime",
      status: "EXAMPLE APPLICATION"
    },
    {
      title: "CI → deployment control",
      path: "runner → deploy.release.request → controller",
      boundaries: "environment · release intent · principal · region",
      status: "EXAMPLE APPLICATION"
    },
    {
      title: "Data service → processor",
      path: "profile service → customer.profile.export → analytics",
      boundaries: "classification · purpose · region · permitted fields",
      status: "EXAMPLE APPLICATION"
    }
  ];

  return (
    <div className="grid gap-px border border-[color:var(--line)] bg-[color:var(--line)] md:grid-cols-2 lg:grid-cols-3">
      {applications.map((app) => (
        <article key={app.title} className="bg-[color:var(--paper-soft)] p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold">{app.title}</h3>
            <span className={`mono text-[10px] ${app.status.startsWith("LIVE") ? "text-[color:var(--allow)]" : "text-[color:var(--muted)]"}`}>{app.status}</span>
          </div>
          <p className="mt-5 mono text-xs leading-6 text-[color:var(--ink)]">{app.path}</p>
          <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">{app.boundaries}</p>
        </article>
      ))}
    </div>
  );
}

function TryTab() {
  const [message, setMessage] = useState("Hello from Pigeon");
  const demoHref = useMemo(() => `${DEMO}?message=${encodeURIComponent(message || "Hello from Pigeon")}`, [message]);

  return (
    <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
      <div>
        <p className="mono text-xs text-[color:var(--muted)]">TYPE ANY MESSAGE</p>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, 280))}
          className="mt-3 min-h-32 w-full resize-none border border-[color:var(--line-strong)] bg-[color:var(--paper)] p-4 text-base outline-none focus:border-[color:var(--ink)]"
          aria-label="Demo message"
        />
        <a href={demoHref} className="mt-4 inline-flex items-center gap-2 border-b border-[color:var(--ink)] pb-1 text-sm font-medium">
          Send through the live demo <ArrowRight size={14} />
        </a>
      </div>
      <div className="border border-[color:var(--line)] bg-[color:var(--paper)] p-5">
        <p className="mono text-xs text-[color:var(--muted)]">WHAT PIGEON ADDS AROUND IT</p>
        <div className="mt-5 grid gap-3 mono text-xs sm:grid-cols-2">
          {[
            ["principal", "demo-producer"],
            ["subject", "demo.message"],
            ["operation", "publish"],
            ["intent", "send_demo_message"],
            ["region", "uk"],
            ["decision", "evaluated by broker"]
          ].map(([key, value]) => (
            <div key={key} className="border-b rule pb-3"><span className="block text-[color:var(--muted)]">{key}</span><span className="mt-1 block">{value}</span></div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-6 text-[color:var(--muted)]">Your text remains message data. Pigeon evaluates whether that communication can proceed under the negotiated contract.</p>
      </div>
    </div>
  );
}

function PerformanceTab() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <p className="mono text-xs text-[color:var(--muted)]">LIVE DEMO</p>
        <h3 className="mt-3 text-xl font-semibold">See the actual hosted path.</h3>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">Each live run reports contract negotiation, publish, receive and end-to-end timings so network time and broker work are not presented as the same thing.</p>
        <a href={DEMO} className="mt-5 inline-flex items-center gap-2 border-b border-[color:var(--ink)] pb-1 text-sm font-medium">Open performance view <ArrowRight size={14} /></a>
      </div>
      <div className="border border-[color:var(--line)] p-5">
        <p className="mono text-xs text-[color:var(--muted)]">ENFORCEMENT BENCHMARK</p>
        <div className="mt-5 grid grid-cols-2 gap-px bg-[color:var(--line)]">
          <Metric label="default iterations" value="50,000" />
          <Metric label="reports" value="µs/op" />
          <Metric label="reports" value="ops/s" />
          <Metric label="scope" value="broker path" />
        </div>
        <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">The benchmark measures the cost of contract validation, policy gates, schema checks, idempotency and audit on the broker path. It is not a Kafka or NATS throughput comparison.</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[color:var(--paper-soft)] p-4"><span className="mono text-[10px] text-[color:var(--muted)]">{label}</span><strong className="mt-2 block text-lg font-semibold">{value}</strong></div>;
}

function CoreConcepts() {
  const concepts = [
    ["Communication contract", "Short-lived authority bound to an authenticated principal, subject and permitted operations."],
    ["Subject policy", "Defines delivery semantics plus intent, region, schema, data and replay constraints."],
    ["Broker decision", "Communication is allowed, denied or quarantined before normal delivery."],
    ["Audit evidence", "Records who attempted what, under which contract, and the resulting broker decision."]
  ];

  return (
    <section className="border-b rule">
      <div className="section-shell">
        <p className="kicker mono text-[color:var(--brand)]">Core concepts</p>
        <div className="mt-8 grid border border-[color:var(--line)] md:grid-cols-4">
          {concepts.map(([title, copy], index) => (
            <article key={title} className={`p-5 ${index ? "border-t rule md:border-l md:border-t-0" : ""}`}>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Quickstart() {
  const install = "npm install pigeonmq";
  return (
    <section id="quickstart" className="border-b rule">
      <div className="section-shell grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
        <div>
          <p className="kicker mono text-[color:var(--brand)]">Quickstart</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-.035em]">From install to a governed message.</h2>
          <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">Start the broker, connect to a subject and publish through a negotiated contract.</p>
        </div>
        <div className="overflow-hidden border border-[color:var(--line-strong)] bg-[color:var(--terminal)] text-[color:var(--terminal-text)]">
          <div className="flex items-center border-b border-white/10 px-4 py-3 mono text-xs text-white/45">
            <span className="flex-1">INSTALL</span><CopyButton value={install} />
          </div>
          <pre className="overflow-x-auto p-5 mono text-[.82rem] leading-7"><code>{`$ npm install pigeonmq\n$ npx pigeon broker start\n\nimport { PigeonClient } from "pigeonmq";\n\nconst pigeon = new PigeonClient({\n  url: "http://localhost:8787",\n  token: process.env.PIGEON_TOKEN\n});\n\nawait pigeon.connect(["notifications.send"]);\n\nawait pigeon.publish({\n  subject: "notifications.send",\n  intent: "send_notification",\n  data: { message: "order confirmed" }\n});`}</code></pre>
        </div>
      </div>
    </section>
  );
}

function Gateway() {
  return (
    <section>
      <div className="section-shell">
        <div className="grid gap-px border border-[color:var(--line)] bg-[color:var(--line)] md:grid-cols-3">
          <a href={DEMO} className="bg-[color:var(--paper)] p-6 hover:bg-[color:var(--paper-soft)]">
            <span className="mono text-xs text-[color:var(--brand)]">LIVE DEMO</span>
            <h3 className="mt-3 text-xl font-semibold">Send a message</h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Watch sender, broker and receiver execute one governed communication.</p>
          </a>
          <a href={`${GITHUB}/tree/main/docs`} className="bg-[color:var(--paper)] p-6 hover:bg-[color:var(--paper-soft)]">
            <span className="mono text-xs text-[color:var(--brand)]">DOCUMENTATION</span>
            <h3 className="mt-3 text-xl font-semibold">Read the model</h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Explore architecture, flows, policies, ADRs and current implementation boundaries.</p>
          </a>
          <a href={GITHUB} className="bg-[color:var(--paper)] p-6 hover:bg-[color:var(--paper-soft)]">
            <span className="mono text-xs text-[color:var(--brand)]">OPEN SOURCE</span>
            <h3 className="mt-3 text-xl font-semibold">Inspect the broker</h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Run the code, reproduce the benchmark and contribute on GitHub.</p>
          </a>
        </div>
      </div>
    </section>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-2 text-white/55 hover:text-white"
      aria-label="Copy install command"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "copied" : "copy"}
    </button>
  );
}
