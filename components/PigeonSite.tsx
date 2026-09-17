"use client";

import { ArrowRight, Check, Copy, Menu, RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
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
const DOCS = `${GITHUB}/tree/main/docs`;
const DEMO = process.env.NEXT_PUBLIC_DEMO_URL || "/demo";
const INSTALL = "npm install pigeonmq";

const CAPABILITIES = [
  ["Communication contracts", "Authenticate a principal, request subjects and operations, and receive a short-lived contract that defines the communication authority for the session."],
  ["Message admission", "Evaluate identity, intent, schema, region, sensitive data and idempotency before a message is appended or delivered."],
  ["Delivery and replay", "Publish, receive, acknowledge and replay through the same contract-bound protocol rather than bypassing policy after initial connection."],
  ["Evidence and quarantine", "Record broker decisions and retain blocked communication as inspectable evidence when a message violates its contract or subject policy."],
] as const;

const HOW = [
  ["01", "Authenticate", "Resolve the principal from credentials. Identity is established by the broker, not trusted from message fields."],
  ["02", "Negotiate", "Request the subjects and operations needed for the session. Pigeon compiles the permitted subset into a runtime communication contract."],
  ["03", "Communicate", "Publish and receive under the contract ID using Pigeon Protocol v1 over HTTP or an official client."],
  ["04", "Decide", "Run the ordered admission chain before delivery and return allow, deny or quarantine with decision evidence."],
] as const;

const USE_CASES = [
  ["Service-to-service messaging", "orders.created", "Govern producer identity, schema, intent and delivery context across internal services."],
  ["Workers and asynchronous jobs", "jobs.process", "Bind job publishers and workers to explicit operations and short-lived communication scope."],
  ["AI agents and tool runners", "agents.tool.invoke", "Carry delegated intent and tool scope into asynchronous agent-to-tool communication."],
  ["Regional data flows", "customer.profile.export", "Evaluate region and classification constraints before a message crosses a processing boundary."],
  ["Operational workflows", "deploy.release.request", "Express environment and intent constraints for CI, deployment and automation events."],
  ["Notifications and payments", "notifications.send", "Apply schema, sensitive-field and idempotency checks to domain-specific messaging paths."],
] as const;

const CLIENTS = [
  ["Node.js / TypeScript", "npm", "PigeonClient ships with the pigeonmq package."],
  ["Python", "SDK source", "Protocol-compatible Python client for Pigeon Protocol v1."],
  ["Rust", "SDK source", "Protocol-compatible Rust client for Pigeon Protocol v1."],
  ["Any language", "HTTP", "Pigeon Protocol v1 is available directly over HTTP."],
] as const;

function replayScript(mode: ReplayMode): ReplayLine[] {
  const violation = mode === "violation";
  return [
    { kind: "context", label: "principal", value: "orders-service", pause: 420 },
    { kind: "contract", label: "contract", value: "CTR_0182 · notifications.send · publish", pause: 520 },
    {
      kind: "message",
      label: "message",
      value: violation ? "MSG_1049 · forbidden field customer.raw_email" : "MSG_1049 · notification request",
      pause: 520,
    },
    { kind: "gate", label: "identity", value: "principal authenticated", pass: true, pause: 230 },
    { kind: "gate", label: "intent", value: "send_notification", pass: true, pause: 230 },
    { kind: "gate", label: "schema", value: "notifications.send/v1", pass: true, pause: 230 },
    { kind: "gate", label: "region", value: "uk", pass: true, pause: 230 },
    { kind: "gate", label: "data", value: violation ? "raw contact field is forbidden" : "approved fields only", pass: !violation, pause: 360 },
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
    <figure className="overflow-hidden rounded-lg border border-line-strong/70 bg-term">
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
              <div key={`${line.label}-${index}`} className="replay-row flex items-center justify-between gap-4 border-l-2 border-white/10 py-1 pl-3 text-term-text/80">
                <span><span className="text-term-dim">gate/{line.label}</span> · {line.value}</span>
                {line.pass ? <Check size={13} className="shrink-0 text-[#7CC9C8]" /> : <X size={13} className="shrink-0 text-[#E7B25A]" />}
              </div>
            );
          }
          if (line.kind === "decision") {
            return (
              <div key={`${line.label}-${index}`} className={`replay-row my-2 border-l-2 py-2 pl-3 pr-2 ${line.pass ? "border-[#7CC9C8] bg-[#7CC9C8]/[0.07] text-[#7CC9C8]" : "border-[#E7B25A] bg-[#E7B25A]/10 text-[#E7B25A]"}`}>
                <p>{line.label} → {line.value}</p>
              </div>
            );
          }
          if (line.kind === "receiver") {
            return <p key={`${line.label}-${index}`} className="replay-row border-l-2 border-white/10 py-1 pl-3 text-term-text/75">receiver → {line.value}</p>;
          }
          return (
            <p key={`${line.label}-${index}`} className="replay-row py-1 text-term-text/90">
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

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`reveal ${className}`}>{children}</div>;
}

function SectionHeader({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return (
    <div className="max-w-[49rem]">
      <p className="font-mono text-[0.78rem] text-accent">{kicker}</p>
      <h2 className="mt-4 font-serif text-[2.45rem] leading-[1.04] tracking-[-0.02em] text-ink sm:text-[3.2rem]">{title}</h2>
      <p className="mt-5 text-[1.02rem] leading-7 text-muted">{copy}</p>
    </div>
  );
}

function DeveloperSections() {
  return (
    <>
      <section id="capabilities" className="border-b border-line">
        <Reveal className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
          <SectionHeader
            kicker="Core capabilities"
            title="Messaging with communication authority in the runtime path."
            copy="Pigeon keeps the familiar producer, broker and consumer model, while making the authority for a communication explicit and enforceable before delivery."
          />
          <div className="mt-12 grid overflow-hidden rounded-lg border border-line md:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map(([title, copy], index) => (
              <article key={title} className={`surface-card bg-panel p-6 ${index ? "border-t border-line md:border-l md:border-t-0" : ""} ${index === 2 ? "md:border-l-0 lg:border-l" : ""} ${index >= 2 ? "md:border-t lg:border-t-0" : ""}`}>
                <p className="font-mono text-xs text-accent">0{index + 1}</p>
                <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </Reveal>
      </section>

      <section id="how" className="border-b border-line">
        <Reveal className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
          <SectionHeader
            kicker="How it works"
            title="Authenticate. Negotiate. Communicate. Decide."
            copy="A communication contract is negotiated once for the session; message admission still runs for every publish, receive and replay operation."
          />
          <div className="mt-12 grid overflow-hidden rounded-lg border border-line md:grid-cols-2 lg:grid-cols-4">
            {HOW.map(([number, title, copy], index) => (
              <article key={title} className={`surface-card bg-panel p-6 ${index ? "border-t border-line md:border-l md:border-t-0" : ""} ${index === 2 ? "md:border-l-0 lg:border-l" : ""} ${index >= 2 ? "md:border-t lg:border-t-0" : ""}`}>
                <p className="font-mono text-xs text-accent">{number}</p>
                <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </Reveal>
      </section>

      <section id="quickstart" className="border-b border-line">
        <Reveal className="mx-auto grid max-w-[1320px] gap-12 px-5 py-20 sm:px-10 sm:py-24 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div>
            <SectionHeader
              kicker="Quickstart"
              title="Start a broker and publish under a contract."
              copy="Pigeon Protocol v1 runs over HTTP. Use the Node.js client or call the protocol directly from another runtime."
            />
            <div className="mt-7 flex flex-wrap gap-3 text-sm">
              <a href={DOCS} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong px-4 text-ink transition-colors hover:bg-panel">
                Read the docs <ArrowRight size={14} />
              </a>
              <a href={`${GITHUB}#cli`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-md border border-line px-4 text-muted transition-colors hover:border-line-strong hover:text-ink">
                CLI reference
              </a>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-line-strong/70 bg-term text-term-text">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 font-mono text-[0.7rem] text-term-dim">
              <span>node · publisher</span><span>orders.created</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[0.76rem] leading-7"><code>{`import { PigeonClient } from "pigeonmq";

const pigeon = new PigeonClient({
  url: "http://localhost:8787",
  token: process.env.PIGEON_TOKEN
});

await pigeon.connect(["orders.created"]);

const result = await pigeon.request(
  "orders.created",
  payload,
  {
    intent: "create_order",
    region: "uk",
    idempotencyKey: order.id
  }
);

console.log(result.status);`}</code></pre>
          </div>
        </Reveal>
      </section>
    </>
  );
}

function ResearchSections() {
  return (
    <section id="research" className="border-b border-line">
      <Reveal className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
        <SectionHeader
          kicker="Research"
          title="From subject permission to contextual communication authority."
          copy="Pigeon explores whether short-lived runtime communication contracts can express more context than static subject permissions without turning messaging into an impractical policy bottleneck."
        />
        <div className="mt-12 grid overflow-hidden rounded-lg border border-line lg:grid-cols-3">
          {[
            ["Problem", "Subject permission identifies where a producer may publish. Runtime communication can also depend on intent, region, data classification, schema and task context."],
            ["Model", "Authenticated principal → communication contract → message admission → broker decision. Policy is compiled into a bounded session object, while message gates remain explicit."],
            ["Questions", "Revocation, contract composition, replication, semantic attributes, broker overhead and multi-broker federation remain active research directions."],
          ].map(([title, copy], index) => (
            <article key={title} className={`surface-card bg-panel p-7 ${index ? "border-t border-line lg:border-l lg:border-t-0" : ""}`}>
              <p className="font-mono text-xs text-accent">0{index + 1}</p>
              <h3 className="mt-5 font-serif text-2xl text-ink">{title}</h3>
              <p className="mt-4 text-sm leading-7 text-muted">{copy}</p>
            </article>
          ))}
        </div>
        <div className="mt-7 flex flex-wrap gap-5 text-sm">
          <a href={`${GITHUB}/blob/main/docs/vision.md`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-medium text-ink underline decoration-line-strong underline-offset-4">
            Research and vision notes <ArrowRight size={14} />
          </a>
          <a href={`${GITHUB}/tree/main/docs/adr`} target="_blank" rel="noreferrer" className="text-muted underline decoration-line underline-offset-4 hover:text-ink">Architecture decisions</a>
        </div>
      </Reveal>
    </section>
  );
}

export function PigeonSite() {
  const [view, setView] = useState<View>("developer");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyInstall() {
    try {
      await navigator.clipboard.writeText(INSTALL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-6 px-5 sm:px-10" aria-label="Main">
          <a href="#top" className="flex items-center gap-2.5 rounded" aria-label="PigeonMQ home">
            <PigeonLogo size={34} />
            <span className="text-sm font-semibold tracking-[0.03em] text-ink">PIGEONMQ</span>
          </a>
          <div className="hidden items-center gap-7 text-[0.93rem] text-muted xl:flex">
            <a href="#capabilities" className="transition-colors hover:text-ink">Capabilities</a>
            <a href="#how" className="transition-colors hover:text-ink">How it works</a>
            <a href="#quickstart" className="transition-colors hover:text-ink">Quickstart</a>
            <a href="#use-cases" className="transition-colors hover:text-ink">Use cases</a>
            <a href={DOCS} target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">Docs</a>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-md border border-line bg-panel p-0.5 text-xs md:flex">
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
            <a href={GITHUB} target="_blank" rel="noreferrer" className="hidden h-9 items-center gap-1.5 rounded-md border border-line bg-transparent px-3.5 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:bg-panel hover:text-ink sm:inline-flex">
              GitHub <ArrowRight size={13} className="-rotate-45" aria-hidden="true" />
            </a>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-md border border-line text-muted transition-colors hover:border-line-strong hover:text-ink xl:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}>
              {mobileOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </nav>
        {mobileOpen && (
          <div className="border-t border-line bg-bg px-5 pb-5 pt-3 xl:hidden sm:px-10">
            <div className="mb-3 flex rounded-md border border-line bg-panel p-0.5 text-xs md:hidden">
              {(["developer", "researcher"] as const).map((item) => (
                <button key={item} type="button" onClick={() => { setView(item); setMobileOpen(false); }} className={`flex-1 rounded px-3 py-2 capitalize ${view === item ? "bg-ink text-bg" : "text-muted"}`}>{item}</button>
              ))}
            </div>
            {["capabilities", "how", "quickstart", "use-cases"].map((id) => (
              <a key={id} href={`#${id}`} onClick={() => setMobileOpen(false)} className="block border-b border-line py-3 text-[1rem] capitalize text-text">{id === "how" ? "How it works" : id.replace("-", " ")}</a>
            ))}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={DOCS} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center rounded-md border border-line text-sm text-ink transition-colors hover:bg-panel">Docs</a>
              <a href={GITHUB} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-line bg-transparent text-sm font-medium text-muted transition-colors hover:border-line-strong hover:bg-panel hover:text-ink">GitHub <ArrowRight size={13} className="-rotate-45" aria-hidden="true" /></a>
            </div>
          </div>
        )}
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b border-line">
          <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-14 px-5 pb-20 pt-16 sm:px-10 sm:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-16 lg:pb-28">
            <div className="max-w-[42rem]">
              <div className="hero-enter hero-enter-1 flex items-center gap-5">
                <div className="hero-pigeon" aria-hidden="true"><PigeonLogo size={136} /></div>
                <div>
                  <p className="font-mono text-[0.8rem] text-accent">Open-source message broker · contract-native messaging</p>
                  <p className="mt-1 text-sm text-muted">Pigeon Protocol v1 · Apache-2.0</p>
                </div>
              </div>

              <h1 className="hero-enter hero-enter-2 mt-7 font-serif text-[2.95rem] leading-[0.98] tracking-[-0.025em] text-ink sm:text-[4.15rem]">
                Messaging with runtime communication contracts.
              </h1>
              <p className="hero-enter hero-enter-3 mt-7 max-w-[40rem] text-[1.08rem] leading-[1.7] text-muted">
                PigeonMQ is an open-source message broker for governed asynchronous communication. Producers and consumers authenticate, negotiate short-lived communication contracts, and every message is checked against identity, intent, schema, region and data constraints before delivery.
              </p>

              <div className="hero-enter hero-enter-4 mt-9 flex max-w-[28rem] items-center gap-3 rounded-lg bg-term py-2 pl-4 pr-2 font-mono text-[0.9rem] text-term-text">
                <span className="select-none text-term-dim">$</span>
                <code className="flex-1 truncate">{INSTALL}</code>
                <button type="button" onClick={copyInstall} className="grid h-8 min-w-8 place-items-center rounded-md border border-white/10 px-2 text-term-dim transition-colors hover:bg-white/[0.06] hover:text-term-text" aria-label="Copy install command">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>

              <div className="hero-enter hero-enter-5 mt-6 flex flex-wrap items-center gap-3">
                <a href={DEMO} className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-[0.95rem] font-medium text-bg transition-transform hover:-translate-y-0.5">
                  Run live demo <ArrowRight size={15} />
                </a>
                <a href="#quickstart" className="inline-flex h-11 items-center rounded-md border border-line-strong bg-panel px-5 text-[0.95rem] text-ink transition-colors hover:bg-muted-bg">
                  Get started
                </a>
              </div>

              <p className="hero-enter hero-enter-6 mt-6 text-[0.95rem] text-muted">
                {view === "developer" ? "Explore the protocol, quickstart and messaging patterns below." : "Explore the communication-authority model and research questions below."}
              </p>
            </div>

            <div className="hero-enter hero-enter-replay"><MessageReplay /></div>
          </div>
        </section>

        {view === "developer" ? <DeveloperSections /> : <ResearchSections />}

        <section id="use-cases" className="border-b border-line">
          <Reveal className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
            <SectionHeader
              kicker="Messaging patterns"
              title="One broker model across services, workers, agents and workflows."
              copy="PigeonMQ applies the same contract and admission semantics to asynchronous communication regardless of the application domain. Domain policy determines what each subject permits."
            />
            <div className="mt-12 grid overflow-hidden rounded-lg border border-line md:grid-cols-2 lg:grid-cols-3">
              {USE_CASES.map(([title, subject, copy], index) => (
                <article key={subject} className={`surface-card bg-panel p-6 ${index % 3 ? "lg:border-l lg:border-line" : ""} ${index >= 3 ? "border-t border-line" : index >= 2 ? "md:border-t md:border-line lg:border-t-0" : ""}`}>
                  <span className="font-mono text-xs text-accent">{subject}</span>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </section>

        <section id="clients" className="border-b border-line">
          <Reveal className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
            <SectionHeader
              kicker="Clients and protocol"
              title="Use PigeonMQ from the runtime you already have."
              copy="Use the Node.js client, protocol-compatible SDKs, or integrate directly with Pigeon Protocol v1 over HTTP."
            />
            <div className="mt-12 grid overflow-hidden rounded-lg border border-line md:grid-cols-2 lg:grid-cols-4">
              {CLIENTS.map(([runtime, distribution, copy], index) => (
                <article key={runtime} className={`surface-card bg-panel p-6 ${index ? "border-t border-line md:border-l md:border-t-0" : ""} ${index === 2 ? "md:border-l-0 lg:border-l" : ""} ${index >= 2 ? "md:border-t lg:border-t-0" : ""}`}>
                  <p className="font-mono text-xs text-accent">{distribution}</p>
                  <h3 className="mt-4 font-semibold text-ink">{runtime}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </section>

        <section id="start" className="border-b border-line">
          <Reveal className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
            <div className="overflow-hidden rounded-lg border border-line-strong bg-panel p-7 sm:p-9 lg:flex lg:items-end lg:justify-between lg:gap-12">
              <div className="max-w-[46rem]">
                <p className="font-mono text-[0.78rem] text-accent">Get started</p>
                <h2 className="mt-4 font-serif text-[2.45rem] leading-[1.04] tracking-[-0.02em] text-ink sm:text-[3.2rem]">Put communication contracts on the message path.</h2>
                <p className="mt-5 max-w-[42rem] text-[1.02rem] leading-7 text-muted">Start a broker locally, connect a producer and consumer, then inspect the contract and broker decision for each message.</p>
              </div>
              <div className="mt-7 flex flex-wrap gap-3 lg:mt-0 lg:justify-end">
                <a href={DOCS} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-md border border-line-strong bg-bg px-5 text-[0.95rem] font-medium text-ink transition-colors hover:bg-muted-bg">Read docs</a>
                <a href={DEMO} className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-[0.95rem] font-medium text-bg transition-transform hover:-translate-y-0.5">Run live demo <ArrowRight size={15} /></a>
                <a href={GITHUB} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-md border border-line px-5 text-[0.95rem] text-muted transition-colors hover:border-line-strong hover:text-ink">GitHub <ArrowRight size={13} className="-rotate-45" aria-hidden="true" /></a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="flex items-center gap-2.5"><PigeonLogo size={28} /><span>PigeonMQ · contract-native messaging</span></div>
          <div className="flex flex-wrap items-center gap-5">
            <a href={DEMO} className="transition-colors hover:text-ink">Live demo</a>
            <a href={DOCS} target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">Docs</a>
            <a href={GITHUB} target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">GitHub</a>
            <a href="https://www.npmjs.com/package/pigeonmq" target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">npm</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
