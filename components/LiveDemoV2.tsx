"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { PigeonLogo } from "@/components/PigeonLogo";

type ScenarioKey = "agent-tool-call" | "payments" | "customer-data" | "cross-region" | "deployment-event" | "notifications";
type Mode = "allow" | "violation";
type ServiceState = { ok: boolean; latencyMs?: number; status?: number };
type StatusPayload = { ok: boolean; services?: Record<string, ServiceState> };
type RunPayload = {
  live?: boolean;
  runId?: string;
  elapsedMs?: number;
  decision?: string;
  error?: string;
  code?: string;
  gates?: Array<{ name?: string; gate?: string; pass?: boolean; outcome?: string; reason?: string }>;
  receiver?: { receivedCount?: number };
};

const SCENARIOS: Record<ScenarioKey, { label: string; subject: string; proof: string; violation: string; live: boolean }> = {
  "agent-tool-call": { label: "AI agent → tool runner", subject: "agents.tool.invoke", proof: "delegated intent + tool scope", violation: "action falls outside the negotiated communication scope", live: false },
  payments: { label: "Checkout → payment gateway", subject: "payments.authorize", proof: "PCI + sensitive-field boundary", violation: "raw card data enters the message", live: true },
  "customer-data": { label: "Profile service → analytics", subject: "customer.profile.export", proof: "classification + purpose boundary", violation: "restricted customer data crosses the contract", live: false },
  "cross-region": { label: "EU service → processing worker", subject: "processing.customer.event", proof: "runtime region boundary", violation: "message targets a disallowed region", live: false },
  "deployment-event": { label: "CI runner → deploy controller", subject: "deploy.release.request", proof: "environment + intent boundary", violation: "staging-scoped publisher requests production", live: false },
  notifications: { label: "Order service → notifier", subject: "notifications.send", proof: "schema + PII + idempotency", violation: "forbidden recipient data is attached", live: true }
};

const SERVICE_LINKS = {
  sender: "https://sender.pigeonmq.cc",
  broker: "https://broker.pigeonmq.cc",
  receiver: "https://receiver.pigeonmq.cc"
} as const;

export function LiveDemoV2() {
  const [scenario, setScenario] = useState<ScenarioKey>("payments");
  const [mode, setMode] = useState<Mode>("violation");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [result, setResult] = useState<RunPayload | null>(null);
  const [running, setRunning] = useState(false);
  const selected = SCENARIOS[scenario];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => { if (!cancelled) setStatus(payload); })
      .catch(() => { if (!cancelled) setStatus({ ok: false }); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => setResult(null), [scenario, mode]);

  const gates = useMemo(() => {
    if (result?.gates?.length) {
      return result.gates.map((item) => ({ name: item.name || item.gate || "gate", pass: item.pass ?? item.outcome === "pass", reason: item.reason }));
    }
    const failGate = scenario === "cross-region" ? "region" : scenario === "deployment-event" ? "intent" : "data";
    return ["identity", "intent", "schema", "region", "data", "idempotency"].map((name) => ({ name, pass: mode === "allow" || name !== failGate }));
  }, [result, scenario, mode]);

  async function runDemo() {
    if (!selected.live || running) return;
    setRunning(true);
    setResult(null);
    try {
      const response = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario, mode })
      });
      const payload = await response.json();
      setResult(payload);
    } catch (error) {
      setResult({ live: false, error: error instanceof Error ? error.message : "Demo request failed." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <header className="sticky top-0 z-40 border-b rule bg-[color:var(--paper)]/96 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <a href="https://www.pigeonmq.cc" className="flex items-center gap-2.5"><PigeonLogo size={29} /><span className="text-sm font-semibold tracking-[.02em]">PIGEON</span></a>
          <div className="flex items-center gap-4 text-sm text-[color:var(--muted)]"><span className="mono text-xs">LIVE DEMO</span><a href="https://github.com/vishnu-77/pigeon" className="hover:text-[color:var(--ink)]">GitHub</a></div>
        </div>
      </header>

      <section className="border-b rule">
        <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 sm:py-20">
          <p className="kicker mono text-[color:var(--brand)]">Real sender → broker → receiver</p>
          <div className="mt-5 grid gap-10 lg:grid-cols-[1fr_.7fr] lg:items-end">
            <div>
              <h1 className="max-w-[47rem] text-4xl font-semibold tracking-[-.045em] sm:text-6xl">See the decision before delivery.</h1>
              <p className="mt-5 max-w-[45rem] text-base leading-7 text-[color:var(--muted)] sm:text-lg">Choose a broker-backed communication path, send a compliant message or deliberate violation, and inspect the contract decision and receiver outcome.</p>
            </div>
            <ServiceHealth status={status} />
          </div>
        </div>
      </section>

      <section className="border-b rule">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[.78fr_1.22fr]">
          <div>
            <p className="kicker mono text-[color:var(--muted)]">01 · communication path</p>
            <div className="mt-5 grid gap-2">
              {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => {
                const item = SCENARIOS[key];
                return (
                  <button key={key} onClick={() => setScenario(key)} className={`w-full border p-4 text-left transition-colors ${scenario === key ? "border-[color:var(--ink)] bg-[color:var(--paper-soft)]" : "border-[color:var(--line)] hover:border-[color:var(--line-strong)]"}`}>
                    <div className="flex items-center justify-between gap-4"><span className="text-sm font-medium">{item.label}</span><span className={`mono text-[10px] uppercase tracking-[.12em] ${item.live ? "text-[color:var(--allow)]" : "text-[color:var(--muted)]"}`}>{item.live ? "live" : "next"}</span></div>
                    <span className="mt-1 block mono text-xs text-[color:var(--muted)]">{item.subject}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="kicker mono text-[color:var(--muted)]">02 · contract test</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">{selected.label}</h2></div>
              <div className="flex border border-[color:var(--line-strong)] text-sm"><button onClick={() => setMode("allow")} className={`px-4 py-2.5 ${mode === "allow" ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : ""}`}>Allowed</button><button onClick={() => setMode("violation")} className={`border-l rule px-4 py-2.5 ${mode === "violation" ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : ""}`}>Violation</button></div>
            </div>

            <div className="mt-6 contract-card bg-[color:var(--paper-soft)]">
              <div className="grid gap-5 border-b rule p-5 sm:grid-cols-3">
                <Info label="SUBJECT" value={selected.subject} mono />
                <Info label="CONTRACT PROVES" value={selected.proof} />
                <Info label="MESSAGE TEST" value={mode === "allow" ? "compliant message" : selected.violation} />
              </div>

              <div className="p-5">
                <div className="service-flow" aria-label="sender to broker to receiver">
                  <FlowNode label="sender" meta="publisher principal" />
                  <span className="flow-arrow">→</span>
                  <FlowNode label="contract" meta={selected.subject} />
                  <span className="flow-arrow">→</span>
                  <FlowNode label="broker" meta="admission + append" />
                  <span className="flow-arrow">→</span>
                  <FlowNode label="receiver" meta="delivery proof" />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-2 border-y rule py-4 mono text-xs sm:grid-cols-3">
                  {gates.map((gate) => <div key={gate.name} className="flex items-center justify-between gap-2"><span className="text-[color:var(--muted)]">{gate.name}</span>{gate.pass ? <Check size={14} className="text-[color:var(--allow)]" /> : <X size={14} className="text-[color:var(--deny)]" />}</div>)}
                </div>

                {!selected.live && <div className="mt-5 border border-[color:var(--line)] bg-[color:var(--paper)] p-4 text-sm leading-6 text-[color:var(--muted)]">This path demonstrates Pigeon&apos;s intended contract model but is not wired to a live broker subject yet. It cannot be executed from the public demo.</div>}

                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button onClick={runDemo} disabled={!selected.live || running} className="inline-flex h-11 items-center gap-2 bg-[color:var(--ink)] px-5 text-sm font-medium text-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-35">
                    {running ? "Running…" : selected.live ? "Run live message" : "Live scenario coming next"} {!running && selected.live && <ArrowRight size={15} />}
                  </button>
                  {selected.live && <span className="mono text-xs text-[color:var(--muted)]">server-side orchestration · no browser credentials</span>}
                </div>

                {result && <ResultPanel result={result} />}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8">
          <p className="kicker mono text-[color:var(--muted)]">Deployment topology</p>
          <div className="mt-6 grid border border-[color:var(--line)] md:grid-cols-3">
            {([
              ["sender", "Publisher service", "Negotiates a publishing contract and submits only predefined demo messages."],
              ["broker", "Pigeon broker", "Owns contract state, admission decisions, append, audit and quarantine."],
              ["receiver", "Consumer service", "Negotiates its own receive contract and proves whether delivery happened."]
            ] as const).map(([name,title,copy],i)=><a key={name} href={SERVICE_LINKS[name]} target="_blank" rel="noreferrer" className={`p-6 transition-colors hover:bg-[color:var(--paper-soft)] ${i ? "border-t md:border-l md:border-t-0 rule" : ""}`}><span className="mono text-xs text-[color:var(--brand)]">{name}.pigeonmq.cc</span><h3 className="mt-4 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{copy}</p></a>)}
          </div>
        </div>
      </section>
    </main>
  );
}

function ServiceHealth({ status }: { status: StatusPayload | null }) {
  return <div className="border border-[color:var(--line)] bg-[color:var(--paper-soft)] p-4"><div className="flex items-center justify-between"><p className="mono text-xs text-[color:var(--muted)]">SERVICE HEALTH</p><span className={`mono text-[10px] uppercase tracking-[.12em] ${status?.ok ? "text-[color:var(--allow)]" : "text-[color:var(--muted)]"}`}>{status === null ? "checking" : status.ok ? "ready" : "partial"}</span></div><div className="mt-3 grid grid-cols-3 gap-2">{(["sender","broker","receiver"] as const).map((name)=>{const service=status?.services?.[name];return <a key={name} href={SERVICE_LINKS[name]} target="_blank" rel="noreferrer" className="border rule p-3 text-xs hover:bg-[color:var(--paper)]"><span className="block uppercase text-[color:var(--muted)]">{name}</span><span className={`mt-2 block mono ${service?.ok ? "text-[color:var(--allow)]" : "text-[color:var(--quarantine)]"}`}>{status===null ? "CHECK" : service?.ok ? `ONLINE${service.latencyMs ? ` · ${service.latencyMs}ms` : ""}` : "OFFLINE"}</span></a>})}</div></div>;
}

function FlowNode({ label, meta }: { label: string; meta: string }) {
  return <div className="min-w-0 flex-1 border border-[color:var(--line)] bg-[color:var(--paper)] p-3"><span className="mono text-[10px] uppercase tracking-[.12em] text-[color:var(--brand)]">{label}</span><span className="mt-1 block truncate text-xs text-[color:var(--muted)]">{meta}</span></div>;
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><span className="block text-[10px] uppercase tracking-[.11em] text-[color:var(--muted)]">{label}</span><span className={`mt-1.5 block text-sm ${mono ? "mono" : ""}`}>{value}</span></div>;
}

function ResultPanel({ result }: { result: RunPayload }) {
  if (!result.live) return <div className="mt-6 border-t rule pt-5"><p className="mono text-xs text-[color:var(--quarantine)]">LIVE BACKEND NOT READY</p><p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{result.error || "The public backend is not connected yet."}</p></div>;
  const allow = String(result.decision).toLowerCase().includes("allow");
  return <div className="mt-6 border-t rule pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><span className="mono text-xs text-[color:var(--muted)]">RUN {result.runId}</span><span className={`mono text-sm font-semibold ${allow ? "text-[color:var(--allow)]" : "text-[color:var(--quarantine)]"}`}>{String(result.decision || "DECIDED").toUpperCase()}</span></div><div className="mt-3 grid gap-2 text-sm text-[color:var(--muted)] sm:grid-cols-2"><span>Elapsed: {result.elapsedMs ?? "—"} ms</span><span>Receiver count: {result.receiver?.receivedCount ?? "—"}</span></div></div>;
}
