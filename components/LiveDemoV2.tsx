"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { PigeonLogo } from "@/components/PigeonLogo";

type ScenarioKey = "message" | "payments" | "notifications";
type Mode = "allow" | "violation";
type ServiceState = { ok: boolean; latencyMs?: number; status?: number };
type StatusPayload = { ok: boolean; services?: Record<string, ServiceState> };
type TimingSet = { contractMs?: number; publishMs?: number; receiveMs?: number; evidenceMs?: number; totalMs?: number };
type RunPayload = {
  live?: boolean;
  runId?: string;
  elapsedMs?: number;
  decision?: string;
  error?: string;
  code?: string;
  contract?: { id?: string; expiresAt?: string };
  message?: { id?: string; subject?: string; preview?: string };
  gates?: Array<{ name?: string; gate?: string; pass?: boolean; outcome?: string; reason?: string }>;
  sender?: { timings?: TimingSet };
  receiver?: { receivedCount?: number; proof?: string; timings?: TimingSet };
  audit?: unknown[];
  quarantine?: unknown[];
  transport?: { sender?: string; receiver?: string };
};

const SCENARIOS: Record<ScenarioKey, { label: string; subject: string; description: string }> = {
  message: {
    label: "Your message",
    subject: "demo.message",
    description: "Type any short message and send it through a real Pigeon sender, broker and receiver."
  },
  notifications: {
    label: "Service → service",
    subject: "notifications.send",
    description: "Order-service communication governed by schema, PII, region and idempotency policy."
  },
  payments: {
    label: "Transaction → gateway",
    subject: "payments.authorize",
    description: "Payment-authorisation communication governed by PCI data constraints and tokenisation policy."
  }
};

const SERVICE_LINKS = {
  sender: "https://sender.pigeonmq.cc",
  broker: "https://broker.pigeonmq.cc",
  receiver: "https://receiver.pigeonmq.cc"
} as const;

export function LiveDemoV2() {
  const [scenario, setScenario] = useState<ScenarioKey>("message");
  const [mode, setMode] = useState<Mode>("allow");
  const [message, setMessage] = useState("Hello from Pigeon");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [result, setResult] = useState<RunPayload | null>(null);
  const [running, setRunning] = useState(false);
  const selected = SCENARIOS[scenario];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("message");
    if (initial) setMessage(initial.slice(0, 280));

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
      return result.gates.map((item) => ({
        name: item.name || item.gate || "gate",
        pass: item.pass ?? item.outcome === "pass",
        reason: item.reason
      }));
    }
    return ["identity", "intent", "schema", "region", "data", "idempotency"].map((name) => ({
      name,
      pass: mode === "allow" || name !== "data"
    }));
  }, [result, mode]);

  async function runDemo() {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      const response = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario, mode, message })
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
          <p className="kicker mono text-[color:var(--brand)]">Sender → contract → broker → receiver</p>
          <div className="mt-5 grid gap-10 lg:grid-cols-[1fr_.7fr] lg:items-end">
            <div>
              <h1 className="max-w-[49rem] text-4xl font-semibold tracking-[-.045em] sm:text-6xl">Send a message. See what Pigeon decides.</h1>
              <p className="mt-5 max-w-[47rem] text-base leading-7 text-[color:var(--muted)] sm:text-lg">The public demo runs a sender, negotiates a communication contract, publishes through the broker, then checks the receiver and audit evidence.</p>
            </div>
            <ServiceHealth status={status} />
          </div>
        </div>
      </section>

      <section className="border-b rule">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[.72fr_1.28fr]">
          <aside>
            <p className="kicker mono text-[color:var(--muted)]">01 · Choose a live path</p>
            <div className="mt-5 grid gap-2">
              {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => {
                const item = SCENARIOS[key];
                return (
                  <button key={key} type="button" onClick={() => setScenario(key)} className={`w-full border p-4 text-left ${scenario === key ? "border-[color:var(--ink)] bg-[color:var(--paper-soft)]" : "border-[color:var(--line)] hover:border-[color:var(--line-strong)]"}`}>
                    <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{item.label}</span><span className="mono text-[10px] text-[color:var(--allow)]">LIVE</span></div>
                    <span className="mt-1 block mono text-xs text-[color:var(--muted)]">{item.subject}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-7 border border-[color:var(--line)] p-4">
              <p className="mono text-xs text-[color:var(--muted)]">TRANSPORT</p>
              <div className="mt-3 grid gap-2 mono text-xs">
                <StatusRow label="website → sender" value="HTTPS" />
                <StatusRow label="sender → broker" value="HTTPS" />
                <StatusRow label="broker → receiver" value="HTTPS" />
              </div>
              <p className="mt-3 text-xs leading-5 text-[color:var(--muted)]">Transport security is provided by the deployed HTTPS services; message policy remains a broker concern.</p>
            </div>
          </aside>

          <div>
            <div>
              <p className="kicker mono text-[color:var(--muted)]">02 · Message + contract test</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">{selected.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{selected.description}</p>
            </div>

            {scenario === "message" && (
              <div className="mt-6">
                <label className="mono text-xs text-[color:var(--muted)]" htmlFor="message">MESSAGE DATA</label>
                <textarea id="message" value={message} onChange={(event) => setMessage(event.target.value.slice(0, 280))} className="mt-2 min-h-28 w-full resize-none border border-[color:var(--line-strong)] bg-[color:var(--paper-soft)] p-4 outline-none focus:border-[color:var(--ink)]" />
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y rule py-4">
              <div className="flex border border-[color:var(--line-strong)] text-sm">
                <button type="button" onClick={() => setMode("allow")} className={`px-4 py-2.5 ${mode === "allow" ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : ""}`}>Compliant</button>
                <button type="button" onClick={() => setMode("violation")} className={`border-l rule px-4 py-2.5 ${mode === "violation" ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : ""}`}>Policy violation</button>
              </div>
              <button type="button" onClick={runDemo} disabled={running} className="inline-flex items-center gap-2 border-b border-[color:var(--ink)] pb-1 text-sm font-medium disabled:opacity-45">
                {running ? "Running…" : "Send through Pigeon"} {!running && <ArrowRight size={14} />}
              </button>
            </div>

            <div className="mt-6 border border-[color:var(--line-strong)] bg-[color:var(--paper-soft)]">
              <div className="grid gap-px bg-[color:var(--line)] sm:grid-cols-4">
                <Stage label="01 PRINCIPAL" value={scenario === "message" ? "demo-producer" : scenario === "notifications" ? "orders-api" : "checkout-api"} />
                <Stage label="02 CONTRACT" value={result?.contract?.id || "negotiated at run"} />
                <Stage label="03 SUBJECT" value={selected.subject} />
                <Stage label="04 DECISION" value={result?.decision ? String(result.decision).toUpperCase() : "broker evaluates"} />
              </div>

              <div className="p-5">
                <p className="mono text-xs text-[color:var(--muted)]">ADMISSION</p>
                <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 border-y rule py-4 mono text-xs sm:grid-cols-3">
                  {gates.map((gate) => (
                    <div key={gate.name} className="flex items-center justify-between gap-2">
                      <span className="text-[color:var(--muted)]">{gate.name}</span>
                      {gate.pass ? <Check size={14} className="text-[color:var(--allow)]" /> : <X size={14} className="text-[color:var(--deny)]" />}
                    </div>
                  ))}
                </div>

                {result && <ResultPanel result={result} />}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b rule">
        <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr]">
            <div>
              <p className="kicker mono text-[color:var(--brand)]">Performance</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.035em]">Separate broker work from network time.</h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">Each run exposes sender contract and publish timings, receiver timing, and total hosted latency. The repository benchmark separately measures enforcement overhead on the broker path.</p>
            </div>
            <div className="grid gap-px border border-[color:var(--line)] bg-[color:var(--line)] sm:grid-cols-4">
              <Metric label="benchmark" value="50k runs" />
              <Metric label="latency unit" value="µs/op" />
              <Metric label="throughput" value="ops/s" />
              <Metric label="scope" value="governance" />
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8">
          <p className="kicker mono text-[color:var(--muted)]">Public demo services</p>
          <div className="mt-6 grid border border-[color:var(--line)] md:grid-cols-3">
            {([
              ["sender", "Publisher", "Negotiates a publishing contract and submits the selected message."],
              ["broker", "Pigeon broker", "Owns contract state, admission decisions, append, audit and quarantine."],
              ["receiver", "Consumer", "Negotiates a receive contract and proves whether delivery occurred."]
            ] as const).map(([name,title,copy],i)=><a key={name} href={SERVICE_LINKS[name]} target="_blank" rel="noreferrer" className={`p-6 hover:bg-[color:var(--paper-soft)] ${i ? "border-t md:border-l md:border-t-0 rule" : ""}`}><span className="mono text-xs text-[color:var(--brand)]">{name}.pigeonmq.cc</span><h3 className="mt-4 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{copy}</p></a>)}
          </div>
        </div>
      </section>
    </main>
  );
}

function ServiceHealth({ status }: { status: StatusPayload | null }) {
  return <div className="border border-[color:var(--line)] bg-[color:var(--paper-soft)] p-4"><div className="flex items-center justify-between"><p className="mono text-xs text-[color:var(--muted)]">SERVICE HEALTH</p><span className={`mono text-[10px] ${status?.ok ? "text-[color:var(--allow)]" : "text-[color:var(--muted)]"}`}>{status === null ? "CHECKING" : status.ok ? "READY" : "PARTIAL"}</span></div><div className="mt-3 grid grid-cols-3 gap-2">{(["sender","broker","receiver"] as const).map((name)=>{const service=status?.services?.[name];return <a key={name} href={SERVICE_LINKS[name]} target="_blank" rel="noreferrer" className="border rule p-3 text-xs hover:bg-[color:var(--paper)]"><span className="block uppercase text-[color:var(--muted)]">{name}</span><span className={`mt-2 block mono ${service?.ok ? "text-[color:var(--allow)]" : "text-[color:var(--quarantine)]"}`}>{status===null ? "CHECK" : service?.ok ? `ONLINE${service.latencyMs !== undefined ? ` · ${service.latencyMs}ms` : ""}` : "OFFLINE"}</span></a>})}</div></div>;
}

function Stage({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-[color:var(--paper-soft)] p-4"><span className="mono text-[10px] text-[color:var(--muted)]">{label}</span><strong className="mt-2 block truncate mono text-xs font-medium">{value}</strong></div>;
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b rule pb-2"><span className="text-[color:var(--muted)]">{label}</span><span className="text-[color:var(--allow)]">{value}</span></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[color:var(--paper)] p-4"><span className="mono text-[10px] text-[color:var(--muted)]">{label}</span><strong className="mt-2 block text-lg font-semibold">{value}</strong></div>;
}

function Timing({ label, value }: { label: string; value?: number }) {
  return <div className="border-b rule pb-2"><span className="block mono text-[10px] text-[color:var(--muted)]">{label}</span><strong className="mt-1 block mono text-sm font-medium">{value === undefined ? "—" : `${value} ms`}</strong></div>;
}

function ResultPanel({ result }: { result: RunPayload }) {
  if (!result.live) {
    return <div className="mt-5"><p className="mono text-xs text-[color:var(--quarantine)]">BACKEND NOT READY</p><p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{result.error || "The public backend is not connected yet."}</p></div>;
  }

  const allow = String(result.decision).toLowerCase().includes("allow");
  const senderTimings = result.sender?.timings || {};
  const receiverTimings = result.receiver?.timings || {};

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="mono text-xs text-[color:var(--muted)]">RUN {result.runId}</span>
        <span className={`mono text-sm font-semibold ${allow ? "text-[color:var(--allow)]" : "text-[color:var(--quarantine)]"}`}>{String(result.decision || "DECIDED").toUpperCase()}</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="border border-[color:var(--line)] bg-[color:var(--paper)] p-4">
          <p className="mono text-xs text-[color:var(--muted)]">DELIVERY</p>
          <p className="mt-3 text-sm">receiver count <strong>{result.receiver?.receivedCount ?? 0}</strong></p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">audit events: {result.audit?.length ?? 0} · quarantine records: {result.quarantine?.length ?? 0}</p>
          {result.message?.preview && <p className="mt-3 border-t rule pt-3 text-sm leading-6">“{result.message.preview}”</p>}
        </div>
        <div className="border border-[color:var(--line)] bg-[color:var(--paper)] p-4">
          <p className="mono text-xs text-[color:var(--muted)]">LIVE TIMINGS</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Timing label="contract" value={senderTimings.contractMs} />
            <Timing label="publish" value={senderTimings.publishMs} />
            <Timing label="receive" value={receiverTimings.receiveMs} />
            <Timing label="end-to-end" value={result.elapsedMs} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-[color:var(--muted)]">Hosted latency includes service and network time. Broker benchmark figures are reported separately so they are not conflated with end-to-end latency.</p>
    </div>
  );
}
