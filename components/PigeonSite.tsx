"use client";

import { ArrowRight, Check, Github, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PigeonLogo } from "@/components/PigeonLogo";

type View = "developer" | "researcher";
type ReplayMode = "allow" | "violation";
type ReplayLine = {
  kind: "context" | "contract" | "message" | "gate" | "decision" | "receiver";
  label: string;
  value: string;
  pass?: boolean;
  pause?: number;
};

const GITHUB = "https://github.com/vishnu-77/pigeon";
const DEMO = "https://demo.pigeonmq.cc";
const INSTALL = "npm install pigeonmq";

const USE_CASES = [
  ["AI agent → tool runner", "agents.tool.invoke", "Delegated intent and tool scope", "next"],
  ["Checkout → payment gateway", "payments.authorize", "PCI and sensitive-field boundary", "live"],
  ["Profile service → analytics", "customer.profile.export", "Purpose and classification boundary", "next"],
  ["EU service → worker", "processing.customer.event", "Runtime region boundary", "next"],
  ["CI runner → deploy controller", "deploy.release.request", "Environment and intent boundary", "next"],
  ["Order service → notifier", "notifications.send", "Schema, PII and idempotency", "live"],
] as const;

const HOW = [
  ["01", "Authenticate", "Resolve the principal from credentials, not message claims."],
  ["02", "Negotiate", "Intersect requested subjects with policy and issue a short-lived communication contract."],
  ["03", "Communicate", "Publish, receive and replay under the resulting contract ID."],
  ["04", "Decide", "Allow, deny or quarantine before delivery while recording evidence."],
] as const;

function replayScript(mode: ReplayMode): ReplayLine[] {
  const violation = mode === "violation";
  return [
    { kind: "context", label: "principal", value: "checkout-service", pause: 420 },
    { kind: "contract", label: "contract", value: "CTR_0182 · payments.authorize · publish", pause: 520 },
    {
      kind: "message",
      label: "message",
      value: violation ? "MSG_1049 · forbidden field card.pan" : "MSG_1049 · tokenised authorisation",
      pause: 520,
    },
    { kind: "gate", label: "identity", value: "principal authenticated", pass: true, pause: 230 },
    { kind: "gate", label: "intent", value: "authorize_payment", pass: true, pause: 230 },
    { kind: "gate", label: "schema", value: "payments.authorize/v1", pass: true, pause: 230 },
    { kind: "gate", label: "region", value: "uk", pass: true, pause: 230 },
    { kind: "gate", label: "data", value: violation ? "card.pan is forbidden" : "tokenised fields only", pass: !violation, pause: 360 },
    { kind: "gate", label: "idempotency", value: "MSG_1049 unique", pass: true, pause: 420 },
    {
      kind: "decision",
      label: "broker decision",
      value: violation ? "QUARANTINE" : "ALLOW",
      pass: !violation,
      pause: 650,
    },
    {
      kind: "receiver",
      label: "receiver",
      value: violation ? "delivery blocked · evidence retained" : "delivered · acknowledgement recorded",
      pass: !violation,
      pause: 600,
    },
  ];
}

function MessageReplay() {
  const [mode, setMode] = useState<ReplayMode>("violation");
  const script = useMemo(() => replayScript(mode), [mode]);
  const [shown, setShown] = useState(0);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  const play = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setShown(0);
    let index = 0;
    const step = () => {
      index += 1;
      setShown(index);
      if (index < script.length) timer.current = setTimeout(step, script[index - 1].pause ?? 350);
    };
    timer.current = setTimeout(step, 380);
  }, [script]);

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      setShown(script.length);
      return;
    }
    play();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [mode, play, reduceMotion, script.length]);

  const done = shown >= script.length;

  return (
    <figure className="overflow-hidden rounded-lg border border-line-strong/70 bg-term shadow-[0_24px_60px_-32px_rgba(0,0,0,0.5)]">
      <div className="border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <figcaption className="font-mono text-[0.72rem] text-term-dim">Pigeon communication replay</figcaption>
          <button
            type="button"
            onClick={play}
            disabled={!done}
            className="flex items-center gap-1.5 font-mono text-[0.72rem] text-term-dim transition-colors enabled:hover:text-term-text disabled:opacity-0"
          >
            <RotateCcw size={12} aria-hidden="true" /> Replay
          </button>
        </div>
        <div className="flex border-t border-white/10 font-mono text-[0.68rem]">
          {(["allow", "violation"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`border-r border-white/10 px-4 py-2 capitalize transition-colors ${
                mode === item ? "bg-white/[0.07] text-term-text" : "text-term-dim hover:text-term-text"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[31rem] space-y-1.5 px-4 py-4 font-mono text-[0.72rem] leading-relaxed sm:min-h-[29rem] sm:px-5 sm:text-[0.78rem]">
        {script.slice(0, shown).map((line, index) => {
          if (line.kind === "gate") {
            return (
              <div key={`${line.label}-${index}`} className="flex items-center justify-between gap-4 border-l-2 border-white/10 py-1 pl-3 text-term-text/80">
                <span><span className="text-term-dim">gate/{line.label}</span> · {line.value}</span>
                {line.pass ? <Check size={13} className="shrink-0 text-[#7CC9C8]" /> : <X size={13} className="shrink-0 text-[#E7B25A]" />}
              </div>
            );
          }
          if (line.kind === "decision") {
            return (
              <div key={`${line.label}-${index}`} className={`my-2 border-l-2 py-2 pl-3 pr-2 ${line.pass ? "border-[#7CC9C8] bg-[#7CC9C8]/[0.07] text-[#7CC9C8]" : "border-[#E7B25A] bg-[#E7B25A]/10 text-[#E7B25A]"}`}>
                <p>{line.label} → {line.value}</p>
              </div>
            );
          }
          if (line.kind === "receiver") {
            return <p key={`${line.label}-${index}`} className="border-l-2 border-white/10 py-1 pl-3 text-term-text/75">receiver → {line.value}</p>;
          }
          return (
            <p key={`${line.label}-${index}`} className="py-1 text-term-text/90">
              <span className="text-term-dim">{line.label.padEnd(10, " ")}</span> {line.value}
            </p>
          );
        })}
        {!done && <span className="caret inline-block h-4 w-2 translate-y-0.5 bg-term-text/70" aria-hidden="true" />}
      </div>

      <div className="grid grid-cols-4 border-t border-white/10 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-term-dim sm:text-[0.68rem]">
        {["Authenticate", "Contract", "Decide", "Deliver"].map((step) => (
          <div key={step} className="border-r border-white/10 px-2 py-3 text-center last:border-r-0 sm:px-4">{step}</div>
        ))}
      </div>
    </figure>
  );
}

function SectionHeader({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return (
    <div className="max-w-[48rem]">
      <p className="font-mono text-[0.78rem] text-accent">{kicker}</p>
      <h2 className="mt-4 font-serif text-[2.45rem] leading-[1.04] tracking-[-0.02em] text-ink sm:text-[3.2rem]">{title}</h2>
      <p className="mt-5 text-[1.02rem] leading-7 text-muted">{copy}</p>
    </div>
  );
}

function DeveloperSections() {
  return (
    <>
      <section id="how" className="border-b border-line">
        <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
          <SectionHeader
            kicker="How it works"
            title="Negotiated authority before delivery."
            copy="Pigeon preserves a normal broker flow but makes communication authority explicit before messages enter it."
          />
          <div className="mt-12 grid overflow-hidden rounded-lg border border-line md:grid-cols-4">
            {HOW.map(([number, title, copy], index) => (
              <article key={title} className={`bg-panel p-6 ${index ? "border-t border-line md:border-l md:border-t-0" : ""}`}>
                <p className="font-mono text-xs text-accent">{number}</p>
                <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="quickstart" className="border-b border-line">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-20 sm:px-10 sm:py-24 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <SectionHeader
            kicker="Quickstart"
            title="Keep the developer flow familiar."
            copy="Install a client, authenticate, negotiate once, then use the resulting session contract for messaging."
          />
          <div className="overflow-hidden rounded-lg border border-line-strong/70 bg-term text-term-text">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 font-mono text-[0.7rem] text-term-dim">
              <span>node · publisher</span><span>payments.authorize</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[0.76rem] leading-7"><code>{`import { PigeonClient } from "pigeonmq";

const pigeon = new PigeonClient({
  baseUrl: "http://localhost:8787",
  token: process.env.PIGEON_TOKEN
});

await pigeon.connect(["payments.authorize"]);
await pigeon.request("payments.authorize", payload, {
  intent: "authorize_payment",
  region: "uk"
});`}</code></pre>
          </div>
        </div>
      </section>
    </>
  );
}

function ResearchSections() {
  return (
    <section id="research" className="border-b border-line">
      <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
        <SectionHeader
          kicker="Research view"
          title="From subject permission to contextual communication authority."
          copy="Pigeon explores whether short-lived runtime communication contracts can express more context than static subject ACLs without turning messaging into an impractical policy bottleneck."
        />
        <div className="mt-12 grid overflow-hidden rounded-lg border border-line lg:grid-cols-3">
          {[
            ["Gap", "Static subject permissions answer who may publish; they say less about intent, region, data sensitivity and task context at the moment of communication."],
            ["Model", "Principal → communication contract → message → decision. Contracts bind identity to permitted subjects and operations; message gates still run per publish."],
            ["Questions", "Revocation, composition, replication, semantic attributes, broker overhead and the boundary between governance value and operational cost remain open research directions."],
          ].map(([title, copy], index) => (
            <article key={title} className={`bg-panel p-7 ${index ? "border-t border-line lg:border-l lg:border-t-0" : ""}`}>
              <p className="font-mono text-xs text-accent">0{index + 1}</p>
              <h3 className="mt-5 font-serif text-2xl text-ink">{title}</h3>
              <p className="mt-4 text-sm leading-7 text-muted">{copy}</p>
            </article>
          ))}
        </div>
        <a href={`${GITHUB}/blob/main/docs/research.md`} className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-ink underline decoration-line-strong underline-offset-4">
          Inspect the research notes <ArrowRight size={14} />
        </a>
      </div>
    </section>
  );
}

export function PigeonSite() {
  const [view, setView] = useState<View>("developer");

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-6 px-5 sm:px-10" aria-label="Main">
          <a href="#top" className="flex items-center gap-2.5 rounded" aria-label="Pigeon home">
            <PigeonLogo size={30} />
            <span className="text-sm font-semibold tracking-[0.03em] text-ink">PIGEON</span>
          </a>
          <div className="hidden items-center gap-7 text-[0.93rem] text-muted lg:flex">
            <a href="#how" className="transition-colors hover:text-ink">How it works</a>
            <a href="#quickstart" className="transition-colors hover:text-ink">Quickstart</a>
            <a href="#use-cases" className="transition-colors hover:text-ink">Use cases</a>
            <a href="#status" className="transition-colors hover:text-ink">Status</a>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-md border border-line bg-panel p-0.5 text-xs sm:flex">
              {(["developer", "researcher"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setView(item)}
                  className={`rounded px-3 py-1.5 capitalize transition-colors ${view === item ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <a href={GITHUB} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong px-3.5 text-sm font-medium text-ink transition-colors hover:bg-panel">
              <Github size={15} /> GitHub
            </a>
          </div>
        </nav>
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b border-line">
          <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-14 px-5 pb-20 pt-16 sm:px-10 sm:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-16 lg:pb-28">
            <div className="max-w-[42rem]">
              <div className="flex items-center gap-4">
                <div className="grid h-[74px] w-[96px] place-items-center rounded-lg border border-line bg-panel">
                  <PigeonLogo size={58} />
                </div>
                <div>
                  <p className="font-mono text-[0.8rem] text-accent">Open source · contract-native messaging</p>
                  <p className="mt-1 text-sm text-muted">Pigeon Protocol v1</p>
                </div>
              </div>

              <h1 className="mt-7 font-serif text-[2.95rem] leading-[0.98] tracking-[-0.025em] text-ink sm:text-[4.15rem]">
                Every message runs under a contract.
              </h1>
              <p className="mt-7 max-w-[39rem] text-[1.08rem] leading-[1.7] text-muted">
                Pigeon is a message broker where communication authority is negotiated before delivery. Services, agents and workers authenticate, receive a runtime communication contract, and every message is checked before it reaches a receiver.
              </p>

              <div className="mt-9 flex max-w-[27rem] items-center gap-3 rounded-lg bg-term py-2 pl-4 pr-2 font-mono text-[0.9rem] text-term-text">
                <span className="select-none text-term-dim">$</span>
                <code className="flex-1 truncate">{INSTALL}</code>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a href={DEMO} className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-[0.95rem] font-medium text-bg transition-transform hover:-translate-y-0.5">
                  Run live demo <ArrowRight size={15} />
                </a>
                <a href="#quickstart" className="inline-flex h-11 items-center rounded-md border border-line-strong px-5 text-[0.95rem] text-ink transition-colors hover:bg-panel">
                  Install Pigeon
                </a>
              </div>

              <p className="mt-6 text-[0.95rem] text-muted">
                {view === "developer" ? "Evaluating the model? Switch to Researcher view for the research boundary." : "Researcher view shows the communication-authority model and open questions."}
              </p>
            </div>

            <MessageReplay />
          </div>
        </section>

        {view === "developer" ? <DeveloperSections /> : <ResearchSections />}

        <section id="use-cases" className="border-b border-line">
          <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
            <SectionHeader
              kicker="Communication surfaces"
              title="Not a payments product. A broker primitive."
              copy="The same contract model can govern service-to-service, agent-to-tool and workflow communication. Only scenarios backed by implemented subjects are labelled live."
            />
            <div className="mt-12 grid overflow-hidden rounded-lg border border-line md:grid-cols-2 lg:grid-cols-3">
              {USE_CASES.map(([title, subject, proof, status], index) => (
                <article key={subject} className={`bg-panel p-6 ${index % 3 ? "lg:border-l lg:border-line" : ""} ${index >= 3 ? "border-t border-line" : index >= 2 ? "md:border-t md:border-line lg:border-t-0" : ""}`}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-xs text-accent">{subject}</span>
                    <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${status === "live" ? "text-ok" : "text-muted"}`}>{status}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{proof}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="status">
          <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-20 sm:px-10 sm:py-24 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <SectionHeader
              kicker="Status"
              title="A real broker, with an intentionally narrow public demo."
              copy="The runtime, protocol, SDKs and evidence paths live in main. The site shows the decision a real broker makes on each example, not the deployment behind it."
            />
            <div className="grid overflow-hidden rounded-lg border border-line sm:grid-cols-2">
              {[
                ["Broker", "main", "Protocol, contracts, admission, append, receive, audit and quarantine."],
                ["Website", "website", "Developer/researcher narrative and live-demo orchestration."],
                ["Live demo", "message + payments + notifications", "Three broker-backed examples today; other paths remain explicit roadmap items."],
                ["Source", "Apache-2.0", "Inspect the implementation, tests, protocol and evaluation directly on GitHub."],
              ].map(([title, meta, copy], index) => (
                <article key={title} className={`bg-panel p-6 ${index % 2 ? "sm:border-l sm:border-line" : ""} ${index >= 2 ? "border-t border-line" : ""}`}>
                  <p className="font-mono text-xs text-accent">{meta}</p>
                  <h3 className="mt-4 font-semibold text-ink">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="flex items-center gap-2.5"><PigeonLogo size={25} /><span>Pigeon · contract-native messaging</span></div>
          <div className="flex flex-wrap items-center gap-5">
            <a href={DEMO} className="transition-colors hover:text-ink">Live demo</a>
            <a href={GITHUB} className="transition-colors hover:text-ink">GitHub</a>
            <a href="https://www.npmjs.com/package/pigeonmq" className="transition-colors hover:text-ink">npm</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
