"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Copy, FlaskConical, Github, Terminal, X } from "lucide-react";

type View = "developer" | "researcher";
type Replay = "allow" | "quarantine";
type Stack = "node" | "python" | "rust" | "http";

const GITHUB = "https://github.com/vishnu-77/pigeon";

const STACKS: Record<Stack, { name: string; status: string; install: string; steps: string[] }> = {
  node: {
    name: "Node / TypeScript",
    status: "npm · available now",
    install: "npm install pigeonmq",
    steps: [
      "npx pigeon broker start",
      'import { PigeonClient } from "pigeonmq"',
      'await pigeon.connect(["payments.authorize"])',
      "await pigeon.request(…)"
    ]
  },
  python: {
    name: "Python",
    status: "official SDK · in repository",
    install: 'pip install "git+https://github.com/vishnu-77/pigeon.git#subdirectory=sdk/python"',
    steps: [
      "from pigeonmq import PigeonClient",
      'pigeon = PigeonClient(token="checkout-token")',
      'pigeon.connect(["payments.authorize"])',
      "pigeon.request(…)"
    ]
  },
  rust: {
    name: "Rust",
    status: "official SDK · in repository",
    install: "git clone https://github.com/vishnu-77/pigeon.git",
    steps: [
      "cd pigeon",
      "cargo test --manifest-path sdk/rust/Cargo.toml",
      "use pigeonmq::{PigeonClient, RequestOptions};",
      "client.connect(&[\"payments.authorize\"]).await?"
    ]
  },
  http: {
    name: "HTTP",
    status: "Pigeon Protocol v1",
    install: "POST /v1/contracts → POST /v1/messages",
    steps: [
      "authenticate with a bearer credential",
      "negotiate a communication contract",
      "send x-pigeon-contract on messages",
      "handle typed Pigeon decisions"
    ]
  }
};

const DEV_NAV = [
  ["#how", "How it works"],
  ["#quickstart", "Quickstart"],
  ["#why", "Why Pigeon"],
  ["#status", "Status"]
];

const RESEARCH_NAV = [
  ["#gap", "The gap"],
  ["#model", "Model"],
  ["#experiment", "Experiment"],
  ["#questions", "Open questions"]
];

export function Landing() {
  const [view, setView] = useState<View>("developer");
  const nav = view === "developer" ? DEV_NAV : RESEARCH_NAV;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "research") setView("researcher");
  }, []);

  function chooseView(next: View) {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "researcher") url.searchParams.set("view", "research");
    else url.searchParams.delete("view");
    window.history.replaceState({}, "", url);
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b rule bg-[color:var(--paper)]/95 backdrop-blur-sm">
        <nav className="mx-auto flex h-16 max-w-[1280px] items-center gap-7 px-5 sm:px-8" aria-label="Main navigation">
          <a href="#top" className="flex items-center gap-3 font-semibold text-[color:var(--ink)]">
            <PigeonMark />
            <span className="tracking-[-0.02em]">PIGEON</span>
          </a>

          <ul className="hidden flex-1 items-center justify-center gap-7 text-sm text-[color:var(--muted)] lg:flex">
            {nav.map(([href, label]) => (
              <li key={href}>
                <a className="transition-colors hover:text-[color:var(--ink)]" href={href}>{label}</a>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-2">
            <ViewToggle view={view} setView={chooseView} />
            <a
              href={GITHUB}
              target="_blank"
              rel="noreferrer"
              className="hidden h-9 items-center gap-2 bg-[color:var(--ink)] px-3.5 text-sm font-medium text-[color:var(--paper)] sm:flex"
            >
              <Github size={15} /> GitHub
            </a>
          </div>
        </nav>
      </header>

      <main id="top">
        <Hero view={view} setView={chooseView} />
        {view === "developer" ? <DeveloperView /> : <ResearcherView />}
      </main>

      <footer className="border-t rule">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-9 text-sm text-[color:var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Pigeon · contract-native messaging · Apache-2.0</span>
          <div className="flex gap-5">
            <a className="hover:text-[color:var(--ink)]" href={`${GITHUB}/tree/main`}>Broker</a>
            <a className="hover:text-[color:var(--ink)]" href={`${GITHUB}/issues`}>Issues</a>
            <a className="hover:text-[color:var(--ink)]" href="https://www.npmjs.com/package/pigeonmq">npm</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Hero({ view, setView }: { view: View; setView: (view: View) => void }) {
  return (
    <section className="relative overflow-hidden border-b rule">
      <div className="site-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-[1280px] gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(430px,560px)] lg:items-center lg:pb-28">
        <div className="max-w-[43rem]">
          <p className="kicker mono text-[color:var(--brand)]">Open source · message broker · research prototype</p>
          <h1 className="mt-6 max-w-[42rem] text-[3.2rem] font-semibold leading-[0.94] tracking-[-0.055em] text-[color:var(--ink)] sm:text-[4.8rem]">
            Every message runs under a contract.
          </h1>
          <p className="mt-7 max-w-[40rem] text-[1.08rem] leading-8 text-[color:var(--muted)]">
            Pigeon is a <strong className="font-medium text-[color:var(--ink)]">contract-native message broker</strong>. A service authenticates, negotiates what it may communicate, and every message is checked against that runtime contract before routing or delivery.
          </p>

          <InstallStrip />

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#quickstart" className="inline-flex h-11 items-center gap-2 bg-[color:var(--ink)] px-5 text-sm font-medium text-[color:var(--paper)]">
              Send your first message <ArrowRight size={15} />
            </a>
            <a href={GITHUB} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 border border-[color:var(--line-strong)] px-5 text-sm text-[color:var(--ink)] hover:bg-[color:var(--paper-soft)]">
              <Github size={15} /> View source
            </a>
          </div>

          <button
            type="button"
            onClick={() => setView(view === "developer" ? "researcher" : "developer")}
            className="mt-6 text-left text-sm text-[color:var(--muted)] underline decoration-[color:var(--line-strong)] underline-offset-4 hover:text-[color:var(--ink)]"
          >
            {view === "developer" ? "Evaluating the research idea? Switch to Researcher view." : "Want to run it? Switch to Developer view."}
          </button>
        </div>

        <MessageReplay />
      </div>
    </section>
  );
}

function InstallStrip() {
  const [stack, setStack] = useState<"npm" | "python" | "rust">("npm");
  const command = stack === "npm"
    ? "npm install pigeonmq"
    : stack === "python"
      ? "Python SDK · in repo / PyPI release next"
      : "Rust SDK · in repo / crates.io release next";

  return (
    <div className="mt-9 max-w-[37rem] overflow-hidden border border-[color:var(--line-strong)] bg-[color:var(--terminal)] text-[color:var(--terminal-text)]">
      <div className="flex border-b border-white/10 text-[.72rem] uppercase tracking-[.09em] text-white/45">
        {(["npm", "python", "rust"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStack(item)}
            className={`px-4 py-2.5 ${stack === item ? "bg-white/[.07] text-white" : "hover:text-white/75"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="flex min-h-12 items-center gap-3 px-4 py-3 mono text-[.84rem]">
        <span className="text-white/35">$</span>
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">{command}</code>
        {stack === "npm" && <CopyButton value={command} />}
      </div>
    </div>
  );
}

function MessageReplay() {
  const [scenario, setScenario] = useState<Replay>("quarantine");
  const fail = scenario === "quarantine";
  const gates = [
    ["identity", true],
    ["intent", true],
    ["schema", true],
    ["region", true],
    ["data", !fail],
    ["idempotency", true]
  ] as const;

  return (
    <aside className="border border-[color:var(--line-strong)] bg-[color:var(--paper-soft)]">
      <div className="flex items-center justify-between border-b rule px-4 py-3">
        <div>
          <p className="kicker mono text-[color:var(--muted)]">Message replay</p>
          <p className="mt-1 text-sm text-[color:var(--ink)]">The website replays broker semantics; it is not the broker UI.</p>
        </div>
        <div className="flex border border-[color:var(--line)] text-xs">
          <button type="button" onClick={() => setScenario("allow")} className={`px-3 py-2 ${!fail ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : "text-[color:var(--muted)]"}`}>Allowed</button>
          <button type="button" onClick={() => setScenario("quarantine")} className={`border-l rule px-3 py-2 ${fail ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : "text-[color:var(--muted)]"}`}>Violation</button>
        </div>
      </div>

      <div className="relative p-5 sm:p-6 replay-rail">
        <span className="route-pulse" aria-hidden="true" />
        <ReplayRow title="checkout-api" meta="authenticated principal" />
        <ReplayRow title="CTR_0182" meta="payments.authorize · publish · UK/EU · PCI" />
        <ReplayRow title="MSG_1049" meta={fail ? "contains forbidden field: card.pan" : "tokenised payment authorisation"} />

        <div className="ml-11 mt-3 grid grid-cols-2 gap-x-6 gap-y-2 border-y rule py-4 mono text-[.78rem] sm:grid-cols-3">
          {gates.map(([gate, pass]) => (
            <div key={gate} className="flex items-center justify-between gap-3">
              <span className="text-[color:var(--muted)]">{gate}</span>
              {pass ? <Check size={14} className="text-[color:var(--allow)]" /> : <X size={14} className="text-[color:var(--deny)]" />}
            </div>
          ))}
        </div>

        <div className="ml-11 mt-4 flex items-center justify-between gap-3">
          <span className="mono text-xs text-[color:var(--muted)]">broker decision</span>
          <span className={`kicker mono ${fail ? "text-[color:var(--quarantine)]" : "text-[color:var(--allow)]"}`}>
            {fail ? "QUARANTINED" : "ALLOW"}
          </span>
        </div>
        <p className="ml-11 mt-3 text-sm leading-6 text-[color:var(--muted)]">
          {fail ? "The receiver never sees the violating message. The decision becomes audit evidence." : "The message is appended and becomes available to an authorised receiver."}
        </p>
      </div>
    </aside>
  );
}

function ReplayRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="relative grid min-h-[74px] grid-cols-[38px_1fr] items-start gap-3">
      <span className="replay-dot mt-1.5" />
      <div>
        <p className="mono text-[.82rem] font-semibold text-[color:var(--ink)]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{meta}</p>
      </div>
    </div>
  );
}

function DeveloperView() {
  return (
    <>
      <section id="how" className="border-b rule">
        <div className="section-shell">
          <SectionTitle eyebrow="How it works" title="Messaging begins with negotiated authority." intro="Pigeon keeps the normal broker lifecycle, but inserts a runtime communication contract before the message path." />
          <div className="mt-12 grid border border-[color:var(--line)] md:grid-cols-4">
            {[
              ["01", "Authenticate", "The broker resolves the principal. Identity is not accepted from the message body."],
              ["02", "Negotiate", "Requested subjects are intersected with policy and compiled into a session contract."],
              ["03", "Communicate", "Publish, receive and replay execute under the resulting contract ID."],
              ["04", "Decide", "Admission gates allow, deny or quarantine before the message reaches a receiver."]
            ].map(([n, title, copy], index) => (
              <article key={title} className={`p-6 ${index ? "border-t rule md:border-l md:border-t-0" : ""}`}>
                <p className="mono text-xs text-[color:var(--brand)]">{n}</p>
                <h3 className="mt-5 text-lg font-semibold text-[color:var(--ink)]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Quickstart />

      <section id="why" className="border-b rule">
        <div className="section-shell grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <SectionTitle eyebrow="Why Pigeon" title="Topic permission is necessary. It is not the whole communication decision." intro="Pigeon explores what happens when the broker understands the negotiated context of a message, not only the address it is sent to." />
          <div className="grid border-t rule sm:grid-cols-2">
            {[
              ["Intent", "A producer may publish to a subject but still use an intent outside its negotiated communication scope."],
              ["Data boundary", "Schema-valid data can still violate classification or forbidden-field constraints."],
              ["Residency", "A permitted subject can still be invalid for the region in which this message is being processed."],
              ["Evidence", "A rejected communication becomes a typed decision, quarantine record and audit event instead of an opaque application failure."]
            ].map(([title, copy], index) => (
              <article key={title} className={`py-6 sm:p-6 ${index % 2 ? "sm:border-l rule" : ""} ${index > 1 ? "border-t rule" : ""}`}>
                <h3 className="font-semibold text-[color:var(--ink)]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="status" className="border-b rule">
        <div className="section-shell">
          <SectionTitle eyebrow="Current status" title="Working broker. Explicit boundaries." intro="Pigeon is deliberately transparent about the line between the current experiment and production distributed messaging." />
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <StatusList title="Shipped" positive items={["policy-compiled session contracts", "publish / receive / replay / ack", "identity, intent, schema, region and data gates", "idempotency and rate limiting", "quarantine + hash-chained audit", "Node, Python and Rust clients", "cross-language integration CI", "enforcement benchmark"]} />
            <StatusList title="Not claimed yet" items={["multi-node replicated broker", "production mTLS/SPIFFE/JWT edge identity", "durable distributed session contracts", "streaming consumer leases", "Kafka / NATS / RabbitMQ compatibility bridges", "production-grade availability guarantees"]} />
          </div>
        </div>
      </section>
    </>
  );
}

function Quickstart() {
  const [stack, setStack] = useState<Stack>("node");
  const selected = STACKS[stack];

  return (
    <section id="quickstart" className="border-b rule">
      <div className="section-shell">
        <SectionTitle eyebrow="Quickstart" title="Reach the first governed decision, not just a running server." intro="The adoption target is simple: start the broker, negotiate one contract, send one valid message, then trigger one violation." />

        <div className="mt-12 grid overflow-hidden border border-[color:var(--line-strong)] lg:grid-cols-[18rem_1fr]">
          <div className="flex overflow-x-auto border-b rule bg-[color:var(--paper-soft)] lg:flex-col lg:border-b-0 lg:border-r">
            {(Object.keys(STACKS) as Stack[]).map((id) => {
              const item = STACKS[id];
              const active = id === stack;
              return (
                <button key={id} type="button" onClick={() => setStack(id)} className={`min-w-[12rem] border-l-2 px-5 py-4 text-left lg:min-w-0 lg:border-b rule ${active ? "border-l-[color:var(--brand)] bg-white/40" : "border-l-transparent hover:bg-white/30"}`}>
                  <span className="block font-medium text-[color:var(--ink)]">{item.name}</span>
                  <span className="mt-1 block text-xs text-[color:var(--muted)]">{item.status}</span>
                </button>
              );
            })}
          </div>

          <div className="bg-[color:var(--terminal)] p-6 text-[color:var(--terminal-text)] sm:p-8">
            <p className="kicker mono text-white/45">{selected.status}</p>
            <div className="mt-5 flex items-center gap-3 border border-white/10 bg-white/[.03] px-4 py-3 mono text-[.83rem]">
              <span className="text-white/35">$</span>
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">{selected.install}</code>
              <CopyButton value={selected.install} />
            </div>
            <ol className="mt-8 space-y-5">
              {selected.steps.map((step, index) => (
                <li key={step} className="grid grid-cols-[1.7rem_1fr] gap-3">
                  <span className="mono text-xs text-white/35">0{index + 1}</span>
                  <code className="mono text-[.82rem] leading-6 text-white/80">{step}</code>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <p className="mt-5 text-sm text-[color:var(--muted)]">
          Python and Rust are already first-party repository clients and CI targets. PyPI/crates.io publication is intentionally not shown as live until release automation and registry ownership are complete.
        </p>
      </div>
    </section>
  );
}

function ResearcherView() {
  return (
    <>
      <section id="gap" className="border-b rule">
        <div className="section-shell grid gap-12 lg:grid-cols-[.85fr_1.15fr]">
          <SectionTitle eyebrow="The gap" title="Messaging authority is usually coarser than the communication itself." intro="Pigeon investigates whether the broker can make a contextual communication decision before routing without turning every message into a heavyweight policy evaluation." />
          <div className="border border-[color:var(--line)] bg-[color:var(--paper-soft)] p-6 sm:p-8">
            <p className="mono text-xs text-[color:var(--muted)]">CONVENTIONAL QUESTION</p>
            <p className="mt-3 text-xl text-[color:var(--ink)]">Can principal A publish to subject X?</p>
            <div className="my-7 h-px bg-[color:var(--line)]" />
            <p className="mono text-xs text-[color:var(--brand)]">PIGEON QUESTION</p>
            <p className="mt-3 text-xl leading-8 text-[color:var(--ink)]">Under what runtime contract may A communicate this message, for this intent, with these data and residency constraints?</p>
          </div>
        </div>
      </section>

      <section id="model" className="border-b rule">
        <div className="section-shell">
          <SectionTitle eyebrow="Model" title="Compile communication authority, then keep the message path small." intro="The current prototype treats a communication contract as the session-scoped result of intersecting authenticated identity, requested subjects and policy." />
          <div className="mt-12 overflow-x-auto border-y rule py-8 mono text-sm text-[color:var(--ink)]">
            <pre>{`Authenticated Principal
        ∩
Requested Subject Set
        ∩
Subject Policy
        ↓
Communication Contract
        ↓
Message × Contract
        ↓
Identity · Intent · Schema · Region · Data · Idempotency
        ↓
Allow | Deny | Quarantine`}</pre>
          </div>
        </div>
      </section>

      <section id="experiment" className="border-b rule">
        <div className="section-shell">
          <SectionTitle eyebrow="Experiment" title="A reproducible broker path, not a conceptual diagram only." intro="The project exposes concrete violation classes and an enforcement benchmark so the research claim can be challenged against the running implementation." />
          <div className="mt-12 overflow-x-auto border border-[color:var(--line)]">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-[color:var(--paper-soft)] mono text-xs text-[color:var(--muted)]">
                <tr><th className="p-4">Experiment</th><th className="p-4">Variable</th><th className="p-4">Expected decision</th><th className="p-4">Evidence</th></tr>
              </thead>
              <tbody>
                {[
                  ["authorised publish", "valid contract + valid envelope", "ALLOW", "message + audit"],
                  ["unauthorised producer", "principal outside policy", "DENY at negotiation", "typed error"],
                  ["region violation", "message region outside scope", "DENY / QUARANTINE", "decision + audit"],
                  ["sensitive data", "forbidden field", "QUARANTINE", "held envelope + audit"],
                  ["duplicate", "same idempotency key", "SUPPRESS", "duplicate decision"],
                  ["overhead", "contract enforcement enabled", "bounded latency", "npm run bench"]
                ].map((row) => (
                  <tr key={row[0]} className="border-t rule">
                    {row.map((cell, index) => <td key={cell} className={`p-4 ${index === 2 ? "mono text-[color:var(--ink)]" : "text-[color:var(--muted)]"}`}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="questions" className="border-b rule">
        <div className="section-shell grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <SectionTitle eyebrow="Open questions" title="The interesting work begins where the MVP stops." intro="The current implementation is intentionally single-node so the next research questions are explicit rather than hidden behind product claims." />
          <ol className="border-t rule">
            {[
              "What is the correct revocation model for an already-negotiated communication contract?",
              "How should contracts be replicated and reconciled across broker nodes without reintroducing a heavy policy hot path?",
              "Which attributes belong in messaging semantics, and which should remain application policy?",
              "How should contract authority compose across agent-to-agent and service-to-service hops?",
              "What benchmark best captures governance strength versus enforcement overhead?"
            ].map((question, index) => (
              <li key={question} className="grid grid-cols-[2.2rem_1fr] gap-4 border-b rule py-5">
                <span className="mono text-xs text-[color:var(--brand)]">0{index + 1}</span>
                <span className="leading-7 text-[color:var(--ink)]">{question}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b rule">
        <div className="section-shell">
          <div className="grid gap-8 border border-[color:var(--line-strong)] bg-[color:var(--ink)] p-7 text-[color:var(--paper)] sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="kicker mono text-white/45">Reproduce it</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.035em]">Run the broker, tests and enforcement benchmark yourself.</h2>
              <p className="mt-4 max-w-[50rem] text-sm leading-7 text-white/60">The research surface should remain attached to the executable artefact. The repository contains the broker, ADRs, flows, tests, SDKs and benchmark.</p>
            </div>
            <a href={GITHUB} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 bg-[color:var(--paper)] px-5 text-sm font-medium text-[color:var(--ink)]">
              <FlaskConical size={16} /> Open repository
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function StatusList({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) {
  return (
    <div className="border-t rule">
      <h3 className="py-4 font-semibold text-[color:var(--ink)]">{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 border-t rule py-3 text-sm text-[color:var(--muted)]">
            {positive ? <Check size={15} className="mt-0.5 shrink-0 text-[color:var(--allow)]" /> : <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-[color:var(--line-strong)]" />}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ViewToggle({ view, setView }: { view: View; setView: (view: View) => void }) {
  return (
    <div className="flex h-9 border border-[color:var(--line-strong)] bg-[color:var(--paper-soft)] text-xs" role="group" aria-label="Website view">
      <button type="button" aria-pressed={view === "developer"} onClick={() => setView("developer")} className={`px-3 ${view === "developer" ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : "text-[color:var(--muted)]"}`}>Developer</button>
      <button type="button" aria-pressed={view === "researcher"} onClick={() => setView("researcher")} className={`border-l rule px-3 ${view === "researcher" ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : "text-[color:var(--muted)]"}`}>Researcher</button>
    </div>
  );
}

function SectionTitle({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <div className="max-w-[48rem]">
      <p className="kicker mono text-[color:var(--brand)]">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-[color:var(--ink)] sm:text-4xl">{title}</h2>
      <p className="mt-5 max-w-[44rem] text-[1rem] leading-7 text-[color:var(--muted)]">{intro}</p>
    </div>
  );
}

function PigeonMark() {
  return (
    <svg width="25" height="25" viewBox="0 0 25 25" aria-hidden="true">
      <path d="M4 12.5h7.5V5l9.5 7.5-9.5 7.5v-7.5H4Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="4" cy="12.5" r="2" fill="var(--brand)" />
    </svg>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const label = useMemo(() => copied ? "Copied" : "Copy", [copied]);

  return (
    <button
      type="button"
      aria-label={`${label} command`}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="grid h-8 w-8 shrink-0 place-items-center border border-white/10 text-white/45 hover:text-white"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}
