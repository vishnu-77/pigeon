"use client";

import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PigeonLogo } from "@/components/PigeonLogo";

type ScenarioKey = "message" | "payments";
type Mode = "allow" | "violation";

type RunPayload = {
  live?: boolean;
  elapsedMs?: number;
  decision?: string;
  error?: string;
  gates?: Array<{ name?: string; pass?: boolean }>;
  receiver?: { receivedCount?: number; delivered?: Array<{ data?: { message?: string } }> };
  clientProof?: { ciphertext?: string; decrypted?: string; verified?: boolean; algorithm?: string };
};

const SCENARIOS: Record<ScenarioKey, { label: string; subject: string; description: string; violation: string }> = {
  message: {
    label: "Encrypted message",
    subject: "demo.message",
    description: "Send a normal message through an encrypted, contract-governed path.",
    violation: "Attach a restricted field and confirm delivery is blocked."
  },
  payments: {
    label: "Payment authorisation",
    subject: "payments.authorize",
    description: "Evaluate a payment message against identity, intent and data policy.",
    violation: "Attach prohibited card data and confirm quarantine."
  }
};

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
  return { key, packed: `pigeon:aes-gcm:v1:${toBase64Url(iv)}:${toBase64Url(encrypted)}` };
}

async function decryptForDemo(key: CryptoKey, packed: string) {
  const parts = packed.split(":");
  if (parts.length !== 5 || parts.slice(0, 3).join(":") !== "pigeon:aes-gcm:v1") {
    throw new Error("Invalid encrypted payload.");
  }
  const iv = fromBase64Url(parts[3]);
  const ciphertext = fromBase64Url(parts[4]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

function compactCiphertext(value?: string) {
  if (!value) return "generated client-side";
  if (value.length < 42) return value;
  return `${value.slice(0, 24)}…${value.slice(-12)}`;
}

export function LiveDemoV2() {
  const [scenario, setScenario] = useState<ScenarioKey>("message");
  const [mode, setMode] = useState<Mode>("allow");
  const [message, setMessage] = useState("Hello from Pigeon");
  const [result, setResult] = useState<RunPayload | null>(null);
  const [running, setRunning] = useState(false);
  const selected = SCENARIOS[scenario];

  useEffect(() => setResult(null), [scenario, mode]);

  const gates = useMemo(() => {
    if (result?.gates?.length) {
      return result.gates.map((item) => ({ name: item.name || "gate", pass: Boolean(item.pass) }));
    }
    return ["identity", "intent", "schema", "region", "data", "idempotency"].map((name) => ({ name, pass: mode === "allow" || name !== "data" }));
  }, [result, mode]);

  async function runDemo() {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      let key: CryptoKey | null = null;
      let encryptedMessage: string | undefined;
      const plaintext = message.trim().slice(0, 96) || "Hello from Pigeon";

      if (scenario === "message") {
        const encrypted = await encryptForDemo(plaintext);
        key = encrypted.key;
        encryptedMessage = encrypted.packed;
      }

      const response = await fetch("/api/demo/public-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario, mode, encryptedMessage })
      });
      const payload = (await response.json()) as RunPayload;

      if (scenario === "message" && key && payload.live) {
        const deliveredCiphertext = payload.receiver?.delivered?.[0]?.data?.message;
        let decrypted: string | undefined;
        if (mode === "allow" && deliveredCiphertext) decrypted = await decryptForDemo(key, deliveredCiphertext);
        payload.clientProof = {
          ciphertext: encryptedMessage,
          decrypted,
          verified: Boolean(decrypted && decrypted === plaintext),
          algorithm: "AES-256-GCM"
        };
      }

      if (!payload.live) payload.error = payload.error || "The live demo is temporarily unavailable. Please try again.";
      setResult(payload);
    } catch {
      setResult({ live: false, error: "The live demo is temporarily unavailable. Please try again." });
    } finally {
      setRunning(false);
    }
  }

  const allow = Boolean(result?.live && String(result.decision).toLowerCase().includes("allow"));

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-5 px-5 sm:px-10">
          <a href="https://www.pigeonmq.cc" className="flex items-center gap-2.5 rounded" aria-label="Pigeon home">
            <PigeonLogo size={30} />
            <span className="text-sm font-semibold tracking-[0.03em] text-ink">PIGEON</span>
          </a>
          <a href="https://www.pigeonmq.cc" className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm text-text transition-colors hover:border-line-strong hover:text-ink">
            <ArrowLeft size={14} /> Back
          </a>
        </nav>
      </header>

      <main>
        <section className="border-b border-line">
          <div className="mx-auto max-w-[1320px] px-5 py-14 sm:px-10 sm:py-20">
            <p className="font-mono text-[0.78rem] text-accent">Live demo</p>
            <h1 className="mt-4 max-w-[42rem] font-serif text-[2.55rem] leading-[1.05] tracking-[-0.02em] text-ink sm:text-[3.35rem]">Send a message through Pigeon.</h1>
            <p className="mt-5 max-w-[46rem] text-[1.02rem] leading-8 text-muted">Type a message, choose an allowed or violating run, and inspect the broker&apos;s decision before delivery.</p>
          </div>
        </section>

        <section>
          <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-14 sm:px-10 sm:py-16 lg:grid-cols-[0.6fr_1.4fr]">
            <aside>
              <p className="font-mono text-[0.74rem] text-muted">01 · choose a path</p>
              <div className="mt-4 grid gap-2">
                {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => {
                  const item = SCENARIOS[key];
                  return (
                    <button key={key} onClick={() => setScenario(key)} className={`w-full rounded-md border p-4 text-left transition-colors ${scenario === key ? "border-line-strong bg-panel text-ink" : "border-line bg-bg-soft text-text hover:border-line-strong"}`}>
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="mt-1.5 block text-xs leading-5 text-muted">{item.description}</span>
                      <span className="mt-2 block font-mono text-[10px] text-accent">{item.subject}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.74rem] text-muted">02 · choose an outcome</p>
                  <h2 className="mt-2 font-serif text-[1.9rem] tracking-[-0.02em] text-ink">{selected.label}</h2>
                </div>
                <div className="flex rounded-md border border-line bg-panel p-0.5 text-sm">
                  <button onClick={() => setMode("allow")} className={`rounded px-4 py-2 ${mode === "allow" ? "bg-ink text-bg" : "text-muted"}`}>Allowed</button>
                  <button onClick={() => setMode("violation")} className={`rounded px-4 py-2 ${mode === "violation" ? "bg-ink text-bg" : "text-muted"}`}>Violation</button>
                </div>
              </div>
              {mode === "violation" && <p className="mt-2 text-sm text-muted">{selected.violation}</p>}

              <div className="mt-6 overflow-hidden rounded-lg border border-line-strong bg-panel">
                {scenario === "message" && (
                  <div className="border-b border-line bg-bg-soft p-5">
                    <label htmlFor="demo-message" className="block font-mono text-[0.7rem] uppercase tracking-[0.11em] text-muted">Message</label>
                    <textarea
                      id="demo-message"
                      value={message}
                      onChange={(event) => setMessage(event.target.value.slice(0, 96))}
                      rows={3}
                      maxLength={96}
                      className="mt-3 w-full resize-none rounded-md border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-line-strong"
                      placeholder="Type a message"
                    />
                    <div className="mt-2 flex justify-end font-mono text-[0.68rem] text-muted">{message.length}/96</div>
                  </div>
                )}

                <div className="p-5 sm:p-6">
                  <div className="docs-table-wrap">
                    <table>
                      <thead>
                        <tr><th>Gate</th><th>Result</th></tr>
                      </thead>
                      <tbody>
                        {gates.map((gate) => (
                          <tr key={gate.name}>
                            <td className="font-mono">{gate.name}</td>
                            <td>{gate.pass ? <Check size={14} className="text-ok" /> : <X size={14} className="text-signal" />}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <button onClick={runDemo} disabled={running} className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-sm font-medium text-bg transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35">
                      {running ? "Running…" : "Run demo"} {!running && <ArrowRight size={15} />}
                    </button>
                    <span className="font-mono text-xs text-muted">server-side orchestration · no browser credentials</span>
                  </div>

                  {result && <ResultPanel result={result} scenario={scenario} allow={allow} />}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Proof({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="block font-mono text-[10px] uppercase tracking-[0.11em] text-term-dim">{label}</span>
      <span className={`mt-1.5 block break-all text-sm text-term-text ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function ResultPanel({ result, scenario, allow }: { result: RunPayload; scenario: ScenarioKey; allow: boolean }) {
  if (!result.live) {
    return (
      <div className="mt-6 rounded-md border border-line bg-bg p-4">
        <p className="text-sm font-medium text-ink">Demo unavailable</p>
        <p className="mt-1 text-sm leading-6 text-muted">{result.error}</p>
      </div>
    );
  }
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-line-strong bg-term text-term-text">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <span className="font-mono text-xs text-term-dim">PIGEON DECISION</span>
        <span className={`font-mono text-xs font-semibold ${allow ? "text-[#7CC9C8]" : "text-[#E7B25A]"}`}>{String(result.decision || "decided").toUpperCase()}</span>
      </div>

      <div className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-3">
        <Proof label="Policy" value={allow ? "All checks passed" : "Violation contained"} />
        <Proof label="Delivery" value={allow ? "Confirmed" : "Blocked"} />
        <Proof label="Time" value={`${result.elapsedMs ?? "—"} ms`} />
      </div>

      {scenario === "message" && result.clientProof && (
        <div className="border-t border-white/10 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Proof label="Encryption" value={result.clientProof.algorithm || "AES-256-GCM"} />
            <Proof label="Payload" value={compactCiphertext(result.clientProof.ciphertext)} mono />
            <Proof
              label="Verification"
              value={allow ? (result.clientProof.verified ? "Recovered message matches" : "Delivery not verified") : "Message not delivered"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
