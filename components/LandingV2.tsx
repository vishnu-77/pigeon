"use client";

import { useState } from "react";
import { ArrowRight, Check, Github, X } from "lucide-react";
import { PigeonLogo } from "@/components/PigeonLogo";

type View = "developer" | "researcher";
type Replay = "allow" | "quarantine";
type Stack = "node" | "python" | "rust";

const GITHUB = "https://github.com/vishnu-77/pigeon";
const DEMO = "https://demo.pigeonmq.cc";

const installs: Record<Stack, string> = {
  node: "npm install pigeonmq",
  python: 'pip install "git+https://github.com/vishnu-77/pigeon.git#subdirectory=sdk/python"',
  rust: "cargo add pigeonmq --git https://github.com/vishnu-77/pigeon"
};

const examples = [
  ["AI agent → tool runner", "agents.tool.invoke", "Delegated intent and tool scope", "next"],
  ["Checkout → payment gateway", "payments.authorize", "PCI and sensitive-field boundary", "live"],
  ["Profile service → analytics", "customer.profile.export", "Purpose and classification boundary", "next"],
  ["EU service → worker", "processing.customer.event", "Runtime region boundary", "next"],
  ["CI runner → deploy controller", "deploy.release.request", "Environment and intent boundary", "next"],
  ["Order service → notifier", "notifications.send", "Schema, PII and idempotency", "live"]
] as const;

export function LandingV2() {
  const [view, setView] = useState<View>("developer");
  const [stack, setStack] = useState<Stack>("node");
  const [replay, setReplay] = useState<Replay>("quarantine");

  return (
    <div className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <header className="sticky top-0 z-50 border-b rule bg-[color:var(--paper)]/96 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-5 px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5" aria-label="Pigeon home">
            <PigeonLogo size={30} />
            <span className="text-sm font-semibold tracking-[.02em]">PIGEON</span>
          </a>
          <nav className="ml-auto hidden items-center gap-6 text-sm text-[color:var(--muted)] md:flex">
            <a href="#how" className="hover:text-[color:var(--ink)]">How it works</a>
            <a href="#quickstart" className="hover:text-[color:var(--ink)]">Quickstart</a>
            <a href="#use-cases" className="hover:text-[color:var(--ink)]">Use cases</a>
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <div className="flex border border-[color:var(--line-strong)] bg-[color:var(--paper-soft)] text-xs">
              {(["developer", "researcher"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setView(item)}
                  className={`px-3 py-2 capitalize transition-colors ${view === item ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : "text-[color:var(--muted)] hover:text-[color:var(--ink)]"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <a href={GITHUB} target="_blank" rel="noreferrer" className="hidden h-9 items-center gap-2 border border-[color:var(--line-strong)] px-3 text-sm sm:flex">
              <Github size={14} /> GitHub
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b rule">
          <div className="site-grid pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1240px] gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_.86fr] lg:items-center">
            <div className="max-w-[44rem]">
              <div className="mb-7 flex items-center gap-4">
                <div className="brand-mark-stage"><PigeonLogo size={76} /></div>
                <div>
                  <p className="kicker mono text-[color:var(--brand)]">Open source · contract-native messaging</p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">Pigeon Protocol v1</p>
                </div>
              </div>
              <h1 className="max-w-[43rem] text-[3.2rem] font-semibold leading-[.96] tracking-[-.055em] sm:text-[5rem]">
                Every message runs under a contract.
              </h1>
              <p className="mt-7 max-w-[41rem] text-[1.06rem] leading-8 text-[color:var(--muted)]">
                Pigeon is a message broker where communication authority is negotiated before delivery. Services, agents and workers authenticate, receive a runtime communication contract, and every message is checked before it reaches a receiver.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={DEMO} className="inline-flex h-11 items-center gap-2 rounded-md bg-[color:var(--ink)] px-5 text-sm font-medium text-[color:var(--paper)] transition-transform hover:-translate-y-0.5">
                  Run live demo <ArrowRight size={15} />
                </a>
                <a href={view === "researcher" ? "#research" : "#quickstart"} className="inline-flex h-11 items-center rounded-md border border-[color:var(--line-strong)] px-5 text-sm transition-colors hover:bg-[color:var(--paper-soft)]">
                  {view === "researcher" ? "Read the research" : "Install Pigeon"}
                </a>
              </div>
              <div className="mt-9 max-w-[38rem] overflow-hidden border border-[color:var(--line-strong)] bg-[color:var(--terminal)] text-[color:var(--terminal-text)]">
                <div className="flex border-b border-white/10 text-[.7rem] uppercase tracking-[.11em] text-white/45">
                  {(["node", "python", "rust"] as const).map((item) => (
                    <button key={item} onClick={() => setStack(item)} className={`px-4 py-2.5 ${stack === item ? "bg-white/[.07] text-white" : "hover:text-white/75"}`}>
                      {item}
                    </button>
                  ))}
                </div>
                <div className="flex min-h-12 items-center gap-3 overflow-x-auto px-4 py-3 mono text-[.8rem]">
                  <span className="text-white/35">$</span><code className="whitespace-nowrap">{installs[stack]}</code>
                </div>
              </div>
            </div>

            <ContractReplay replay={replay} setReplay={setReplay} />
          </div>
        </section>

        {view === "developer" ? <DeveloperSections /> : <ResearchSections />}

        <section id="use-cases" className="border-b rule">
          <div className="section-shell">
            <SectionHeading kicker="Communication surfaces" title="Not a payments product. A broker primitive." copy="The same contract model can govern service-to-service, agent-to-tool and workflow communication. Only scenarios backed by implemented subjects are labelled live." />
            <div className="mt-10 grid border border-[color:var(--line)] md:grid-cols-2 lg:grid-cols-3">
              {examples.map(([title, subject, proof, status], i) => (
                <article key={subject} className={`p-6 ${i % 3 ? "lg:border-l rule" : ""} ${i >= 3 ? "border-t rule" : i >= 2 ? "md:border-t lg:border-t-0 rule" : i >= 2 ? "border-t rule" : ""}`}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="mono text-xs text-[color:var(--brand)]">{subject}</span>
                    <span className={`mono text-[10px] uppercase tracking-[.12em] ${status === "live" ? "text-[color:var(--allow)]" : "text-[color:var(--muted)]"}`}>{status}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{proof}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="status">
          <div className="section-shell grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-start">
            <SectionHeading kicker="Status" title="A real broker, with an intentionally narrow public demo." copy="The runtime, protocol, SDKs and evidence paths live in main. The public website explains them and delegates live execution to separately deployed sender, broker and receiver services." />
            <div className="grid border border-[color:var(--line)] sm:grid-cols-2">
              {[
                ["Broker", "main", "Protocol, contracts, admission, append, receive, audit and quarantine."],
                ["Website", "website", "Developer/researcher narrative and live-demo orchestration."],
                ["Live demo", "payments + notifications", "Two broker-backed examples today; other paths stay explicit roadmap items."],
                ["Source", "Apache-2.0", "Inspect the implementation, tests, protocol and evaluation directly on GitHub."]
              ].map(([title, meta, copy], i) => (
                <div key={title} className={`p-5 ${i % 2 ? "sm:border-l rule" : ""} ${i >= 2 ? "border-t rule" : ""}`}>
                  <p className="mono text-xs text-[color:var(--brand)]">{meta}</p>
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t rule">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-5 py-8 text-sm text-[color:var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2"><PigeonLogo size={24} /><span>Pigeon · contract-native messaging</span></div>
          <div className="flex flex-wrap gap-5"><a href={DEMO}>Live demo</a><a href={GITHUB}>GitHub</a><a href="https://www.npmjs.com/package/pigeonmq">npm</a></div>
        </div>
      </footer>
    </div>
  );
}

function ContractReplay({ replay, setReplay }: { replay: Replay; setReplay: (value: Replay) => void }) {
  const fail = replay === "quarantine";
  const gates = ["identity", "intent", "schema", "region", "data", "idempotency"];
  return (
    <aside className="contract-card bg-[color:var(--paper-soft)]">
      <div className="flex items-center justify-between gap-4 border-b rule px-5 py-4">
        <div><p className="kicker mono text-[color:var(--muted)]">Communication replay</p><p className="mt-1 text-sm">Static, deterministic, no looping animation.</p></div>
        <div className="flex border border-[color:var(--line)] text-xs">
          <button onClick={() => setReplay("allow")} className={`px-3 py-2 ${!fail ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : "text-[color:var(--muted)]"}`}>Allow</button>
          <button onClick={() => setReplay("quarantine")} className={`border-l rule px-3 py-2 ${fail ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : "text-[color:var(--muted)]"}`}>Violation</button>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <FlowStep index="01" label="principal" value="checkout-service" />
        <FlowStep index="02" label="contract" value="CTR_0182 · payments.authorize · publish" />
        <FlowStep index="03" label="message" value={fail ? "MSG_1049 · forbidden field card.pan" : "MSG_1049 · tokenised authorisation"} />
        <div className="my-5 grid grid-cols-2 gap-x-6 gap-y-2 border-y rule py-4 mono text-xs sm:grid-cols-3">
          {gates.map((gate) => {
            const pass = !(fail && gate === "data");
            return <div key={gate} className="flex items-center justify-between gap-2"><span className="text-[color:var(--muted)]">{gate}</span>{gate.pass ? <Check size={14} className="text-[color:var(--allow)]" /> : <X size={14} className="text-[color:var(--deny)]" />}</div>;
          })}
        </div>
        <div className="flex items-center justify-between gap-4"><span className="mono text-xs text-[color:var(--muted)]">broker decision</span><span className={`mono text-xs font-semibold ${fail ? "text-[color:var(--quarantine)]" : "text-[color:var(--allow)]"}`}>{fail ? "QUARANTINE" : "ALLOW"}</span></div>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">{fail ? "The receiver never sees the violating message; the decision remains evidence." : "The accepted message is appended and can be received by an authorised consumer."}</p>
      </div>
    </aside>
  );
}

function FlowStep({ index, label, value }: { index: string; label: string; value: string }) {
  return <div className="flow-step"><span className="flow-index mono">{index}</span><div><span className="mono text-[10px] uppercase tracking-[.12em] text-[color:var(--muted)]">{label}</span><p className="mt-1 text-sm font-medium">{value}</p></div></div>;
}

function DeveloperSections() {
  return (
    <>
      <section id="how" className="border-b rule"><div className="section-shell"><SectionHeading kicker="How it works" title="Negotiated authority before delivery." copy="Pigeon preserves a normal broker flow but makes communication authority explicit before messages enter it." /><div className="mt-10 grid border border-[color:var(--line)] md:grid-cols-4">{[
        ["01", "Authenticate", "Resolve the principal from credentials, not message claims."],
        ["02", "Negotiate", "Intersect requested subjects with policy and issue a short-lived contract."],
        ["03", "Communicate", "Publish, receive and replay under the contract ID."],
        ["04", "Decide", "Allow, deny or quarantine before delivery while recording evidence."]
      ].map(([n,t,c],i)=><div key={t} className={`p-6 ${i ? "border-t md:border-l md:border-t-0 rule" : ""}`}><p className="mono text-xs text-[color:var(--brand)]">{n}</p><h3 className="mt-5 text-lg font-semibold">{t}</h3><p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{c}</p></div>)}</div></div></section>
      <section id="quickstart" className="border-b rule"><div className="section-shell grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><SectionHeading kicker="Quickstart" title="Keep the developer flow familiar." copy="Install a client, authenticate, negotiate once, then use the resulting session contract for messaging." /><div className="code-panel"><pre><code>{`import { PigeonClient } from "pigeonmq";\n\nconst pigeon = new PigeonClient({\n  baseUrl: "http://localhost:8787",\n  token: process.env.PIGEON_TOKEN\n});\n\nawait pigeon.connect(["payments.authorize"]);\nawait pigeon.request("payments.authorize", payload, {\n  intent: "authorize_payment", region: "uk"\n});`}</code></pre></div></div></section>
    </>
  );
}

function ResearchSections() {
  return (
    <section id="research" className="border-b rule">
      <div className="section-shell">
        <SectionHeading kicker="Research view" title="From subject permission to contextual communication authority." copy="Pigeon explores whether short-lived runtime communication contracts can express more context than static subject ACLs without turning messaging into an impractical policy bottleneck." />
        <div className="mt-10 grid border border-[color:var(--line)] lg:grid-cols-3">
          {[
            ["Gap", "Static subject permissions answer who may publish; they say less about intent, region, data sensitivity and task context at the moment of communication."],
            ["Model", "Principal → communication contract → message → decision. Contracts bind identity to permitted subjects and operations; message gates still run per publish."],
            ["Questions", "Revocation, composition, replication, semantic attributes, broker overhead and the boundary between governance value and operational cost remain open research directions."]
          ].map(([title, copy],i)=><article key={title} className={`p-6 ${i ? "border-t lg:border-l lg:border-t-0 rule" : ""}`}><h3 className="text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">{copy}</p></article>)}
        </div>
        <div className="mt-7"><a href={`${GITHUB}/blob/main/docs/research.md`} className="inline-flex items-center gap-2 text-sm font-medium underline decoration-[color:var(--line-strong)] underline-offset-4">Inspect the research notes <ArrowRight size={14} /></a></div>
      </div>
    </section>
  );
}

function SectionHeading({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return <div className="max-w-[48rem]"><p className="kicker mono text-[color:var(--brand)]">{kicker}</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">{title}</h2><p className="mt-4 text-base leading-7 text-[color:var(--muted)]">{copy}</p></div>;
}
