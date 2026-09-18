"use client";

import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PigeonLogo } from "@/components/PigeonLogo";

type ScenarioKey = "message" | "agent-tool-call" | "payments" | "customer-data" | "cross-region" | "deployment-event" | "notifications";
type Mode = "allow" | "violation";
type ServiceState = { ok: boolean; configured?: boolean; latencyMs?: number; status?: number };
type StatusPayload = { ok: boolean; environment?: string; services?: Record<string, ServiceState> };
type RunPayload = {
  live?: boolean;
  runId?: string;
  elapsedMs?: number;
  decision?: string;
  error?: string;
  code?: string;
  gates?: Array<{ name?: string; gate?: string; pass?: boolean; outcome?: string; reason?: string }>;
  receiver?: { receivedCount?: number; delivered?: Array<{ data?: { message?: string } }> };
  clientProof?: { plaintext?: string; ciphertext?: string; decrypted?: string; algorithm?: string };
};

const SCENARIOS: Record<ScenarioKey, { label: string; subject: string; proof: string; violation: string; live: boolean }> = {
  message: { label: "Encrypted message", subject: "demo.message", proof: "contract + encrypted payload", violation: "restricted field added outside the encrypted payload", live: true },
  "agent-tool-call": { label: "AI agent → tool runner", subject: "agents.tool.invoke", proof: "delegated intent + tool scope", violation: "action falls outside the negotiated communication scope", live: false },
  payments: { label: "Checkout → payment gateway", subject: "payments.authorize", proof: "PCI + sensitive-field boundary", violation: "raw card data enters the message", live: true },
  "customer-data": { label: "Profile service → analytics", subject: "customer.profile.export", proof: "classification + purpose boundary", violation: "restricted customer data crosses the contract", live: false },
  "cross-region": { label: "EU service → processing worker", subject: "processing.customer.event", proof: "runtime region boundary", violation: "message targets a disallowed region", live: false },
  "deployment-event": { label: "CI runner → deploy controller", subject: "deploy.release.request", proof: "environment + intent boundary", violation: "staging-scoped publisher requests production", live: false },
  notifications: { label: "Order service → notifier", subject: "notifications.send", proof: "schema + PII + idempotency", violation: "forbidden recipient data is attached", live: true },
};

function stateLabel(status: StatusPayload | null, service?: ServiceState) {
  if (status === null) return "CHECK";
  if (service?.ok) return "LIVE";
  if (service?.configured === false) return "UNCONFIGURED";
  return "OFFLINE";
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptForDemo(plaintext: string) {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded));
  const packed = `pigeon:aes-gcm:v1:${toBase64Url(iv)}:${toBase64Url(encrypted)}`;
  return { key, packed };
}

async function decryptForDemo(key: CryptoKey, packed: string) {
  const parts = packed.split(":");
  if (parts.length !== 5 || parts.slice(0, 3).join(":") !== "pigeon:aes-gcm:v1") throw new Error("Invalid encrypted payload.");
  const iv = fromBase64Url(parts[3]);
  const ciphertext = fromBase64Url(parts[4]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

export function LiveDemoV2() {
  const [scenario, setScenario] = useState<ScenarioKey>("message");
  const [mode, setMode] = useState<Mode>("allow");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [result, setResult] = useState<RunPayload | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("Hello from PigeonMQ");
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
      let key: CryptoKey | null = null;
      let encryptedMessage: string | undefined;
      if (scenario === "message") {
        const plaintext = message.trim().slice(0, 96) || "Hello from PigeonMQ";
        const encrypted = await encryptForDemo(plaintext);
        key = encrypted.key;
        encryptedMessage = encrypted.packed;
      }

      const response = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario, mode, encryptedMessage }),
      });
      const payload = (await response.json()) as RunPayload;

      if (scenario === "message" && key && payload.live) {
        const deliveredCiphertext = payload.receiver?.delivered?.[0]?.data?.message;
        let decrypted: string | undefined;
        if (mode === "allow" && deliveredCiphertext) {
          decrypted = await decryptForDemo(key, deliveredCiphertext);
        }
        payload.clientProof = {
          plaintext: message.trim().slice(0, 96) || "Hello from PigeonMQ",
          ciphertext: encryptedMessage,
          decrypted,
          algorithm: "AES-256-GCM",
        };
      }

      setResult(payload);
    } catch (error) {
      setResult({ live: false, error: error instanceof Error ? error.message : "Demo request failed." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-5 px-5 sm:px-10">
          <a href="/" className="flex items-center gap-2.5 rounded" aria-label="PigeonMQ home">
            <PigeonLogo size={34} />
            <span className="text-sm font-semibold tracking-[0.03em] text-ink">PIGEONMQ</span>
          </a>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted sm:inline">Live communication lab</span>
            <a href="/" className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm text-text transition-colors hover:border-line-strong hover:text-ink">
              <ArrowLeft size={14} /> Back
            </a>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1320px] gap-12 px-5 py-16 sm:px-10 sm:py-24 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
            <div className="max-w-[48rem]">
              <p className="font-mono text-[0.8rem] text-accent">Browser → sender → contract → broker → receiver → browser</p>
              <h1 className="mt-5 font-serif text-[2.9rem] leading-[0.98] tracking-[-0.025em] text-ink sm:text-[4.1rem]">Send a message. See what the broker actually receives.</h1>
              <p className="mt-7 max-w-[45rem] text-[1.06rem] leading-[1.7] text-muted">Type a normal message. The browser encrypts it with AES-256-GCM before the sender sees it, the ciphertext travels through PigeonMQ, and an allowed delivery is decrypted back in this browser after receiver proof.</p>
            </div>
            <ServiceHealth status={status} scenario={scenario} />
          </div>
        </section>

        <section className="border-b border-line">
          <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-16 sm:px-10 sm:py-20 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="font-mono text-[0.76rem] text-muted">01 · messaging path</p>
              <div className="mt-5 grid gap-2">
                {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => {
                  const item = SCENARIOS[key];
                  return (
                    <button key={key} onClick={() => setScenario(key)} className={`w-full rounded-md border p-4 text-left transition-colors ${scenario === key ? "border-line-strong bg-panel text-ink" : "border-line bg-bg-soft text-text hover:border-line-strong"}`}>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${item.live ? "text-ok" : "text-muted"}`}>{item.live ? "live" : "next"}</span>
                      </div>
                      <span className="mt-1.5 block font-mono text-xs text-muted">{item.subject}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.76rem] text-muted">02 · contract test</p>
                  <h2 className="mt-2 font-serif text-[2rem] tracking-[-0.02em] text-ink">{selected.label}</h2>
                </div>
                <div className="flex rounded-md border border-line bg-panel p-0.5 text-sm">
                  <button onClick={() => setMode("allow")} className={`rounded px-4 py-2 ${mode === "allow" ? "bg-ink text-bg" : "text-muted"}`}>Allowed</button>
                  <button onClick={() => setMode("violation")} className={`rounded px-4 py-2 ${mode === "violation" ? "bg-ink text-bg" : "text-muted"}`}>Violation</button>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-lg border border-line-strong bg-panel">
                <div className="grid gap-5 border-b border-line p-5 sm:grid-cols-3">
                  <Info label="SUBJECT" value={selected.subject} mono />
                  <Info label="CONTRACT PROVES" value={selected.proof} />
                  <Info label="MESSAGE TEST" value={mode === "allow" ? "compliant message" : selected.violation} />
                </div>

                {scenario === "message" && (
                  <div className="border-b border-line bg-bg-soft p-5">
                    <label htmlFor="demo-message" className="block font-mono text-[0.72rem] uppercase tracking-[0.11em] text-muted">Your message</label>
                    <textarea
                      id="demo-message"
                      value={message}
                      onChange={(event) => setMessage(event.target.value.slice(0, 96))}
                      rows={3}
                      maxLength={96}
                      className="mt-3 w-full resize-none rounded-md border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-line-strong"
                      placeholder="Type a message to send through PigeonMQ"
                    />
                    <div className="mt-2 flex flex-wrap justify-between gap-2 font-mono text-[0.68rem] text-muted">
                      <span>plaintext stays in this browser · AES-256-GCM</span>
                      <span>{message.length}/96</span>
                    </div>
                  </div>
                )}

                <div className="p-5 sm:p-6">
                  <div className="service-flow" aria-label="sender to broker to receiver">
                    <FlowNode label={scenario === "message" ? "browser" : "sender"} meta={scenario === "message" ? "encrypt plaintext" : "publisher principal"} />
                    {scenario === "message" && <span className="flow-arrow">→</span>}
                    {scenario === "message" && <FlowNode label="sender" meta="ciphertext only" />}
                    <span className="flow-arrow">→</span>
                    <FlowNode label="contract" meta={selected.subject} />
                    <span className="flow-arrow">→</span>
                    <FlowNode label="broker" meta="admission + append" />
                    <span className="flow-arrow">→</span>
                    <FlowNode label="receiver" meta="delivery proof" />
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 border-y border-line py-4 font-mono text-xs sm:grid-cols-3">
                    {gates.map((gate) => (
                      <div key={gate.name} className="flex items-center justify-between gap-2">
                        <span className="text-muted">{gate.name}</span>
                        {gate.pass ? <Check size={14} className="text-ok" /> : <X size={14} className="text-signal" />}
                      </div>
                    ))}
                  </div>

                  {!selected.live && <div className="mt-5 rounded-md border border-line bg-bg p-4 text-sm leading-6 text-muted">This path demonstrates the contract model but is not wired to a broker-backed subject in this demo yet.</div>}

                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <button onClick={runDemo} disabled={!selected.live || running} className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-sm font-medium text-bg transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35">
                      {running ? "Running…" : selected.live ? "Run live message" : "Scenario coming next"} {!running && selected.live && <ArrowRight size={15} />}
                    </button>
                    {selected.live && <span className="font-mono text-xs text-muted">{scenario === "message" ? "encryption key remains browser-side" : "server-side orchestration · no browser credentials"}</span>}
                  </div>

                  {result && <ResultPanel result={result} />}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-10 sm:py-20">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="font-mono text-[0.76rem] text-muted">Deployment topology</p>
              {status?.environment && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{status.environment}</span>}
            </div>
            <div className="mt-6 grid overflow-hidden rounded-lg border border-line md:grid-cols-3">
              {([
                ["sender", "Publisher service", "Negotiates a publishing contract and submits predefined demo messages."],
                ["broker", "Pigeon broker", "Owns contract state, admission decisions, append, audit and quarantine."],
                ["receiver", "Consumer service", "Negotiates its own receive contract and proves whether delivery happened."],
              ] as const).map(([name, title, copy], index) => {
                const service = status?.services?.[name];
                const label = stateLabel(status, service);
                return (
                  <article key={name} className={`bg-panel p-6 ${index ? "border-t border-line md:border-l md:border-t-0" : ""}`}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-mono text-xs text-accent">{name}</span>
                      <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${service?.ok ? "text-ok" : "text-muted"}`}>{label}</span>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ServiceHealth({ status, scenario }: { status: StatusPayload | null; scenario: ScenarioKey }) {
  if (scenario === "message") {
    const broker = status?.services?.broker;
    return (
      <div className="rounded-lg border border-line bg-panel p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs text-muted">ENCRYPTED MESSAGE PATH</p>
          <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${broker?.ok ? "text-ok" : "text-muted"}`}>{status === null ? "checking" : broker?.ok ? "ready" : "broker check"}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-md border border-line bg-bg px-3 py-3 text-xs"><span className="block uppercase text-muted">browser</span><span className="mt-2 block font-mono text-ok">READY</span></div>
          <div className="rounded-md border border-line bg-bg px-3 py-3 text-xs"><span className="block uppercase text-muted">broker</span><span className={`mt-2 block font-mono ${broker?.ok ? "text-ok" : "text-signal"}`}>{stateLabel(status, broker)}</span></div>
          <div className="rounded-md border border-line bg-bg px-3 py-3 text-xs"><span className="block uppercase text-muted">decrypt</span><span className="mt-2 block font-mono text-ok">READY</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-muted">SERVICE HEALTH</p>
        <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${status?.ok ? "text-ok" : "text-muted"}`}>{status === null ? "checking" : status.ok ? "ready" : "partial"}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(["sender", "broker", "receiver"] as const).map((name) => {
          const service = status?.services?.[name];
          return (
            <div key={name} className="rounded-md border border-line bg-bg px-3 py-3 text-xs">
              <span className="block uppercase text-muted">{name}</span>
              <span className={`mt-2 block font-mono ${service?.ok ? "text-ok" : "text-signal"}`}>{stateLabel(status, service)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowNode({ label, meta }: { label: string; meta: string }) {
  return <div className="min-w-0 flex-1 rounded-md border border-line bg-bg p-3"><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">{label}</span><span className="mt-1 block truncate text-xs text-muted">{meta}</span></div>;
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><span className="block text-[10px] uppercase tracking-[0.11em] text-muted">{label}</span><span className={`mt-1.5 block text-sm text-ink ${mono ? "font-mono" : ""}`}>{value}</span></div>;
}

function ResultPanel({ result }: { result: RunPayload }) {
  if (!result.live) {
    return <div className="mt-6 border-t border-line pt-5"><p className="font-mono text-xs text-signal">BACKEND NOT READY</p><p className="mt-2 text-sm leading-6 text-muted">{result.error || "The demo backend is not connected in this environment."}</p></div>;
  }
  const allow = String(result.decision).toLowerCase().includes("allow");
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-line-strong bg-term text-term-text">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <span className="font-mono text-xs text-term-dim">RUN {result.runId}</span>
        <span className={`font-mono text-xs font-semibold ${allow ? "text-[#7CC9C8]" : "text-[#E7B25A]"}`}>{String(result.decision || "DECIDED").toUpperCase()}</span>
      </div>
      <div className="grid gap-3 px-4 py-4 font-mono text-xs sm:grid-cols-3">
        <span><span className="text-term-dim">elapsed</span><br />{result.elapsedMs ?? "—"} ms</span>
        <span><span className="text-term-dim">receiver</span><br />{result.receiver?.receivedCount ?? 0} received</span>
        <span><span className="text-term-dim">evidence</span><br />{allow ? "delivery + ack" : "quarantine"}</span>
      </div>
      {result.clientProof && (
        <div className="border-t border-white/10 px-4 py-4 font-mono text-xs">
          <div className="grid gap-3">
            <p><span className="text-term-dim">plaintext/browser</span><br /><span className="text-term-text">{result.clientProof.plaintext}</span></p>
            <p className="break-all"><span className="text-term-dim">ciphertext/path</span><br /><span className="text-term-text/80">{result.clientProof.ciphertext}</span></p>
            <p><span className="text-term-dim">receiver/browser decrypt</span><br /><span className={result.clientProof.decrypted === result.clientProof.plaintext ? "text-[#7CC9C8]" : "text-term-text"}>{result.clientProof.decrypted || (allow ? "not observed" : "not delivered")}</span></p>
          </div>
        </div>
      )}
    </div>
  );
}
