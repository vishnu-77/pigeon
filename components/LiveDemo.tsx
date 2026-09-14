"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";

type ScenarioKey = "agent-tool-call" | "payments" | "customer-data" | "cross-region" | "deployment-event" | "notifications";
type Mode = "allow" | "violation";

type ServiceState = { ok: boolean; latencyMs?: number; status?: number };
type StatusPayload = { ok: boolean; services?: Record<string, ServiceState> };
type RunPayload = {
  live?: boolean;
  runId?: string;
  scenario?: string;
  mode?: string;
  elapsedMs?: number;
  decision?: string;
  error?: string;
  code?: string;
  contract?: { id?: string } | string;
  message?: { id?: string; subject?: string };
  gates?: Array<{ name?: string; gate?: string; pass?: boolean; outcome?: string; reason?: string }>;
  sender?: Record<string, unknown>;
  receiver?: Record<string, unknown>;
};

const scenarios: Record<ScenarioKey, { label: string; path: string; proof: string; violation: string }> = {
  "agent-tool-call": {
    label: "AI agent → tool runner",
    path: "agents.tool.invoke",
    proof: "intent + delegated tool scope",
    violation: "agent requests an action outside its communication contract"
  },
  payments: {
    label: "Checkout → payment gateway",
    path: "payments.authorize",
    proof: "PCI + sensitive-field controls",
    violation: "raw card data appears in a governed message"
  },
  "customer-data": {
    label: "Profile service → analytics",
    path: "customer.profile.export",
    proof: "classification + purpose constraints",
    violation: "restricted customer data crosses the permitted contract"
  },
  "cross-region": {
    label: "EU service → processing worker",
    path: "processing.customer.event",
    proof: "runtime region constraints",
    violation: "message targets a region outside the negotiated boundary"
  },
  "deployment-event": {
    label: "CI runner → deploy controller",
    path: "deploy.release.request",
    proof: "environment + intent constraints",
    violation: "a staging-scoped publisher attempts a production action"
  },
  notifications: {
    label: "Order service → notifier",
    path: "notifications.send",
    proof: "schema + PII + idempotency",
    violation: "forbidden recipient data is attached to the notification"
  }
};

export function LiveDemo() {
  const [scenario, setScenario] = useState<ScenarioKey>("agent-tool-call");
  const [mode, setMode] = useState<Mode>("violation");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [result, setResult] = useState<RunPayload | null>(null);
  const [running, setRunning] = useState(false);

  const selected = scenarios[scenario];
  const services = status?.services || {};
  const allOnline = Boolean(status?.ok);

  useEffect(() => {
    fetch("/api/demo/status", { cache: "no-store" })
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus({ ok: false }));
  }, []);

  useEffect(() => setResult(null), [scenario, mode]);

  const gates = useMemo(() => {
    if (result?.gates?.length) {
      return result.gates.map((entry) => ({
        name: entry.name || entry.gate || "gate",
        pass: entry.pass ?? entry.outcome === "pass",
        reason: entry.reason
      }));
    }
    const failGate = scenario === "cross-region" ? "region" : scenario === "deployment-event" ? "intent" : "data";
    return ["identity", "intent", "schema", "region", "data", "idempotency"].map((name) => ({
      name,
      pass: mode === "allow" || name !== failGate
    }));
  }, [result, scenario, mode]);

  async function runDemo() {
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
      <header className="border-b rule">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 sm:px-8">
          <a href="https://pigeonmq.cc" className="font-semibold tracking-[-0.02em]">PIGEON</a>
          <div className="flex items-center gap-4 text-sm text-[color:var(--muted)]">
            <span className="mono text-xs">LIVE DEMO</span>
            <a className="hover:text-[color:var(--ink)]" href="https://github.com/vishnu-77/pigeon">GitHub</a>
          </div>
        </div>
      </header>

      <section className="border-b rule">
        <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-8 sm:py-20">
          <p className="kicker mono text-[color:var(--brand)]">Sender → contract → broker → receiver</p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_.65fr] lg:items-end">
            <div>
              <h1 className="max-w-[48rem] text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">Run a real communication contract.</h1>
              <p className="mt-5 max-w-[46rem] text-base leading-7 text-[color:var(--muted)] sm:text-lg">
                Pick a system interaction, send an allowed message or a deliberate violation, and watch Pigeon decide before the receiver sees it.
              </p>
            </div>
            <div className="border border-[color:var(--line)] bg-[color:var(--paper-soft)] p-4">
              <p className="mono text-xs text-[color:var(--muted)]">SERVICE HEALTH</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {(["sender", "broker", "receiver"] as const).map((name) => {
                  const service = services[name];
                  return (
                    <a key={name} href={`https://${name}.pigeonmq.cc`} target="_blank" rel="noreferrer" className="border rule p-3 hover:bg-[color:var(--paper)]">
                      <span className="block uppercase text-[color:var(--muted)]">{name}</span>
                      <span className={`mt-2 block mono ${service?.ok ? "text-[color:var(--allow)]" : "text-[color:var(--quarantine)]"}`}>
                        {status === null ? "CHECKING" : service?.ok ? `ONLINE${service.latencyMs ? ` · ${service.latencyMs}ms` : ""}` : "OFFLINE"}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b rule">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="kicker mono text-[color:var(--muted)]">1 · Choose a communication path</p>
            <div className="mt-5 grid gap-2">
              {(Object.keys(scenarios) as ScenarioKey[]).map((key) => {
                const item = scenarios[key];
                const active = key === scenario;
                return (
                  <button key={key} type="button" onClick={() => setScenario(key)} className={`border p-4 text-left transition-colors ${active ? "border-[color:var(--ink)] bg-[color:var(--paper-soft)]" : "border-[color:var(--line)] hover:border-[color:var(--line-strong)]"}`}>
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="mt-1 block mono text-xs text-[color:var(--muted)]">{item.path}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="kicker mono text-[color:var(--muted)]">2 · Choose the message</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{selected.label}</h2>
              </div>
              <div className="flex border border-[color:var(--line-strong)] text-sm">
                <button type="button" onClick={() => setMode("allow")} className={`px-4 py-2.5 ${mode === "allow" ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : ""}`}>Allowed</button>
                <button type="button" onClick={() => setMode("violation")} className={`border-l rule px-4 py-2.5 ${mode === "violation" ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : ""}`}>Violation</button>
              </div>
            </div>

            <div className="mt-6 border border-[color:var(--line)] bg-[color:var(--paper-soft)]">
              <div className="border-b rule p-5">
                <p className="mono text-xs text-[color:var(--muted)]">COMMUNICATION CONTRACT</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div><span className="block text-xs text-[color:var(--muted)]">SUBJECT</span><code className="mt-1 block text-sm">{selected.path}</code></div>
                  <div><span className="block text-xs text-[color:var(--muted)]">PROVES</span><span className="mt-1 block text-sm">{selected.proof}</span></div>
                  <div><span className="block text-xs text-[color:var(--muted)]">TEST</span><span className="mt-1 block text-sm">{mode === "allow" ? "compliant message" : selected.violation}</span></div>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {gates.map((gate) => (
                    <div key={gate.name} className="flex items-center justify-between border-b rule py-2 mono text-xs">
                      <span className="text-[color:var(--muted)]">{gate.name}</span>
                      {gate.pass ? <Check size={14} className="text-[color:var(--allow)]" /> : <X size={14} className="text-[color:var(--deny)]" />}
                    </div>
                  ))}
                </div>

                <button type="button" onClick={runDemo} disabled={running} className="mt-7 inline-flex h-11 items-center gap-2 bg-[color:var(--ink)] px-5 text-sm font-medium text-[color:var(--paper)] disabled:opacity-50">
                  {running ? "Running…" : allOnline ? "Run live message" : "Try live message"} {!running && <ArrowRight size={15} />}
                </button>

                {result && (
                  <div className="mt-6 border-t rule pt-5">
                    {result.live ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="mono text-xs text-[color:var(--muted)]">RUN {result.runId}</span>
                          <span className={`mono text-sm font-semibold ${String(result.decision).toLowerCase().includes("allow") ? "text-[color:var(--allow)]" : "text-[color:var(--quarantine)]"}`}>{String(result.decision || "DECIDED").toUpperCase()}</span>
                        </div>
                        <p className="mt-3 text-sm text-[color:var(--muted)]">Executed by the deployed sender, Pigeon broker and receiver in {result.elapsedMs ?? "—"} ms.</p>
                      </>
                    ) : (
                      <>
                        <p className="mono text-xs text-[color:var(--quarantine)]">LIVE BACKEND NOT READY</p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{result.error || "The public backend is not connected yet."}</p>
                        {result.code === "BACKEND_SCENARIO_NOT_DEPLOYED" && <p className="mt-2 text-sm text-[color:var(--muted)]">This guard prevents the older payments-only demo from being presented as another scenario.</p>}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8">
          <p className="kicker mono text-[color:var(--muted)]">Deployment topology</p>
          <div className="mt-6 grid border border-[color:var(--line)] md:grid-cols-3">
            {[
              ["sender.pigeonmq.cc", "Publisher service", "Negotiates a publishing contract and submits the selected demo message."],
              ["broker.pigeonmq.cc", "Pigeon broker", "Authenticates, enforces the communication contract, appends or quarantines."],
              ["receiver.pigeonmq.cc", "Consumer service", "Negotiates its own receive contract and proves whether delivery occurred."]
            ].map(([host, title, copy], index) => (
              <a key={host} href={`https://${host}`} target="_blank" rel="noreferrer" className={`p-6 hover:bg-[color:var(--paper-soft)] ${index ? "border-t rule md:border-l md:border-t-0" : ""}`}>
                <span className="mono text-xs text-[color:var(--brand)]">{host}</span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{copy}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
