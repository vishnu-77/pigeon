"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { PigeonLogo } from "@/components/PigeonLogo";

type ScenarioKey = "message" | "payments" | "notifications";
type Mode = "allow" | "violation";
type ServiceState = { ok: boolean; latencyMs?: number; status?: number };
type StatusPayload = { ok: boolean; services?: Record<string, ServiceState> };
type TimingSet = { contractMs?: number; publishMs?: number; receiveMs?: number; evidenceMs?: number; totalMs?: number; ackMs?: number };
type EncryptedMessage = { algorithm: "AES-256-GCM"; iv: string; ciphertext: string; plaintextBytes: number };
type ReceivedCiphertext = { messageId?: string; algorithm?: string; iv?: string; ciphertext?: string; plaintextBytes?: number; acked?: boolean };
type RunPayload = {
  live?: boolean;
  runId?: string;
  elapsedMs?: number;
  decision?: string;
  error?: string;
  code?: string;
  contract?: { id?: string; expiresAt?: string };
  message?: { id?: string; subject?: string; preview?: string };
  encryption?: EncryptedMessage;
  gates?: Array<{ name?: string; gate?: string; pass?: boolean; outcome?: string; reason?: string }>;
  sender?: { timings?: TimingSet };
  receiver?: { receivedCount?: number; proof?: string; timings?: TimingSet; received?: ReceivedCiphertext | null };
  audit?: unknown[];
  quarantine?: unknown[];
};
type JourneyState = {
  plaintext: string;
  encrypted?: EncryptedMessage;
  receivedCiphertext?: string;
  decrypted?: string;
  verified?: boolean;
  blocked?: boolean;
  error?: string;
};

const SCENARIOS: Record<ScenarioKey, { label: string; subject: string; description: string }> = {
  message: {
    label: "Your message",
    subject: "demo.message",
    description: "Type any short message. Your browser encrypts it before it enters the live Pigeon sender, broker and receiver path."
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

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function serviceLabel(status: StatusPayload | null, name: string) {
  if (status === null) return "CHECKING";
  return status.services?.[name]?.ok ? "LIVE" : "OFFLINE";
}

export function LiveDemoV2() {
  const [scenario, setScenario] = useState<ScenarioKey>("message");
  const [mode, setMode] = useState<Mode>("allow");
  const [message, setMessage] = useState("Hello from Pigeon");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [result, setResult] = useState<RunPayload | null>(null);
  const [journey, setJourney] = useState<JourneyState | null>(null);
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

  useEffect(() => {
    setResult(null);
    setJourney(null);
  }, [scenario, mode]);

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
    setJourney(null);
    try {
      let requestBody: Record<string, unknown> = { scenario, mode, message };
      let messageKey: CryptoKey | null = null;
      let encrypted: EncryptedMessage | undefined;

      if (scenario === "message") {
        const plaintext = message.slice(0, 280);
        if (!plaintext.trim()) throw new Error("Type a message before sending it.");
        const plaintextBytes = new TextEncoder().encode(plaintext);
        messageKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, messageKey, plaintextBytes));
        encrypted = {
          algorithm: "AES-256-GCM",
          iv: bytesToBase64Url(iv),
          ciphertext: bytesToBase64Url(ciphertext),
          plaintextBytes: plaintextBytes.byteLength
        };
        setJourney({ plaintext, encrypted });
        requestBody = { scenario, mode, encrypted };
      }

      const response = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      const payload: RunPayload = await response.json();
      setResult(payload);

      if (scenario === "message" && encrypted) {
        if (!response.ok || !payload.live) {
          setJourney((current) => current ? { ...current, error: payload.error || "The encrypted message run failed." } : current);
        } else if (String(payload.decision).toLowerCase().includes("deny")) {
          setJourney((current) => current ? { ...current, blocked: true } : current);
        } else {
          const received = payload.receiver?.received;
          if (!messageKey || !received?.ciphertext || !received.iv || received.algorithm !== "AES-256-GCM") {
            throw new Error("The receiver did not return verifiable ciphertext evidence.");
          }
          if (received.ciphertext !== encrypted.ciphertext || received.iv !== encrypted.iv) {
            throw new Error("The ciphertext returned by the receiver does not match what the sender encrypted.");
          }
          const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: base64UrlToBytes(received.iv) },
            messageKey,
            base64UrlToBytes(received.ciphertext)
          );
          const decrypted = new TextDecoder().decode(decryptedBuffer);
          const verified = decrypted === message.slice(0, 280) && received.acked === true;
          setJourney((current) => current ? {
            ...current,
            receivedCiphertext: received.ciphertext,
            decrypted,
            verified
          } : current);
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Demo request failed.";
      setResult((current) => current ?? { live: false, error: detail });
      setJourney((current) => current ? { ...current, error: detail } : scenario === "message" ? { plaintext: message, error: detail } : null);
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
              <p className="mt-5 max-w-[47rem] text-base leading-7 text-[color:var(--muted)] sm:text-lg">For a normal message, encryption happens in your browser first. Pigeon then governs and delivers ciphertext, the receiver acknowledges it, and this browser decrypts the returned payload.</p>
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
              <p className="mono text-xs text-[color:var(--muted)]">LIVE COMPONENTS</p>
              <div className="mt-3 grid gap-2 mono text-xs">
                <StatusRow label="sender" value={serviceLabel(status, "sender")} />
                <StatusRow label="broker" value={serviceLabel(status, "broker")} />
                <StatusRow label="receiver" value={serviceLabel(status, "receiver")} />
              </div>
              <p className="mt-3 text-xs leading-5 text-[color:var(--muted)]">Backend service addresses are intentionally kept out of the demo UI; only their live state is shown.</p>
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
                <div className="flex items-center justify-between gap-4">
                  <label className="mono text-xs text-[color:var(--muted)]" htmlFor="message">MESSAGE DATA</label>
                  <span className="mono text-[10px] text-[color:var(--allow)]">AES-256-GCM · KEY STAYS IN THIS TAB</span>
                </div>
                <textarea id="message" value={message} onChange={(event) => setMessage(event.target.value.slice(0, 280))} className="mt-2 min-h-28 w-full resize-none border border-[color:var(--line-strong)] bg-[color:var(--paper-soft)] p-4 outline-none focus:border-[color:var(--ink)]" />
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y rule py-4">
              <div className="flex border border-[color:var(--line-strong)] text-sm">
                <button type="button" onClick={() => setMode("allow")} className={`px-4 py-2.5 ${mode === "allow" ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : ""}`}>Compliant</button>
                <button type="button" onClick={() => setMode("violation")} className={`border-l rule px-4 py-2.5 ${mode === "violation" ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : ""}`}>Policy violation</button>
              </div>
              <button type="button" onClick={runDemo} disabled={running || (scenario === "message" && !message.trim())} className="inline-flex items-center gap-2 border-b border-[color:var(--ink)] pb-1 text-sm font-medium disabled:opacity-45">
                {running ? "Running…" : "Send through Pigeon"} {!running && <ArrowRight size={14} />}
              </button>
            </div>

            {scenario === "message" && <MessageJourneyPanel journey={journey} result={result} running={running} />}

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
    </main>
  );
}

function MessageJourneyPanel({ journey, result, running }: { journey: JourneyState | null; result: RunPayload | null; running: boolean }) {
  const decision = String(result?.decision || "").toLowerCase();
  const ciphertext = journey?.encrypted?.ciphertext;
  const receiverText = journey?.blocked
    ? "Nothing delivered"
    : journey?.verified
      ? journey.decrypted || "Decrypted"
      : journey?.error
        ? "Run incomplete"
        : running
          ? "Waiting for delivery"
          : "Waiting for a message";

  return (
    <div className="mt-6 border border-[color:var(--line-strong)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b rule px-4 py-3">
        <span className="mono text-xs text-[color:var(--muted)]">MESSAGE JOURNEY</span>
        <span className="mono text-[10px] text-[color:var(--muted)]">PLAINTEXT → CIPHERTEXT → POLICY → CIPHERTEXT → PLAINTEXT</span>
      </div>
      <div className="grid gap-px bg-[color:var(--line)] md:grid-cols-4">
        <JourneyCell label="01 SENDER" state={journey ? "ENCRYPTED LOCALLY" : "READY"}>
          <span className="break-words text-sm">{journey?.plaintext || "Type a message above"}</span>
        </JourneyCell>
        <JourneyCell label="02 ENCRYPTED" state={journey?.encrypted ? "AES-256-GCM" : "WAITING"}>
          <span className="break-all mono text-[11px] text-[color:var(--muted)]">{ciphertext ? `${ciphertext.slice(0, 64)}${ciphertext.length > 64 ? "…" : ""}` : "Ciphertext appears here"}</span>
        </JourneyCell>
        <JourneyCell label="03 PIGEON" state={decision ? decision.toUpperCase() : running ? "CHECKING" : "WAITING"}>
          <span className="text-sm text-[color:var(--muted)]">{journey?.blocked ? "Policy stopped the encrypted message." : journey?.encrypted ? "Broker governs ciphertext only." : "Contract and policy are evaluated at send."}</span>
        </JourneyCell>
        <JourneyCell label="04 RECEIVER" state={journey?.verified ? "DECRYPTED + ACKED" : journey?.blocked ? "NOT DELIVERED" : running ? "RECEIVING" : "WAITING"}>
          <span className={`break-words text-sm ${journey?.verified ? "text-[color:var(--allow)]" : "text-[color:var(--muted)]"}`}>{receiverText}</span>
        </JourneyCell>
      </div>
      {journey?.encrypted && (
        <div className="grid gap-2 border-t rule px-4 py-3 mono text-[10px] text-[color:var(--muted)] sm:grid-cols-3">
          <span>key: non-exportable · browser only</span>
          <span>iv: {journey.encrypted.iv}</span>
          <span>{journey.verified ? "integrity: verified" : journey.blocked ? "delivery: blocked" : journey.error ? `error: ${journey.error}` : "integrity: pending"}</span>
        </div>
      )}
    </div>
  );
}

function JourneyCell({ label, state, children }: { label: string; state: string; children: React.ReactNode }) {
  return (
    <div className="min-h-36 bg-[color:var(--paper-soft)] p-4">
      <span className="mono text-[10px] text-[color:var(--muted)]">{label}</span>
      <strong className="mt-2 block mono text-[10px] font-medium text-[color:var(--brand)]">{state}</strong>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function ServiceHealth({ status }: { status: StatusPayload | null }) {
  return (
    <div className="border border-[color:var(--line)] bg-[color:var(--paper-soft)] p-4">
      <div className="flex items-center justify-between">
        <p className="mono text-xs text-[color:var(--muted)]">SYSTEM STATUS</p>
        <span className={`mono text-[10px] ${status?.ok ? "text-[color:var(--allow)]" : "text-[color:var(--muted)]"}`}>{status === null ? "CHECKING" : status.ok ? "LIVE" : "PARTIAL"}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(["sender", "broker", "receiver"] as const).map((name) => {
          const value = serviceLabel(status, name);
          return (
            <div key={name} className="border rule p-3 text-xs">
              <span className="block uppercase text-[color:var(--muted)]">{name}</span>
              <span className={`mt-2 block mono ${value === "LIVE" ? "text-[color:var(--allow)]" : value === "OFFLINE" ? "text-[color:var(--quarantine)]" : "text-[color:var(--muted)]"}`}>{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stage({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-[color:var(--paper-soft)] p-4"><span className="mono text-[10px] text-[color:var(--muted)]">{label}</span><strong className="mt-2 block truncate mono text-xs font-medium">{value}</strong></div>;
}

function StatusRow({ label, value }: { label: string; value: string }) {
  const live = value === "LIVE";
  return <div className="flex items-center justify-between border-b rule pb-2"><span className="text-[color:var(--muted)]">{label}</span><span className={live ? "text-[color:var(--allow)]" : "text-[color:var(--muted)]"}>{value}</span></div>;
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
          {result.message?.preview && <p className="mt-3 break-all border-t rule pt-3 mono text-[11px] leading-6 text-[color:var(--muted)]">{result.message.preview}</p>}
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
