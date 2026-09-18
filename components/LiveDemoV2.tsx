"use client";

import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PigeonLogo } from "@/components/PigeonLogo";

type ScenarioKey = "message" | "payments" | "notifications";
type Mode = "allow" | "violation";

type RunPayload = {
  live?: boolean;
  elapsedMs?: number;
  decision?: string;
  error?: string;
  gates?: Array<{ name?: string; gate?: string; pass?: boolean; outcome?: string }>;
  receiver?: { receivedCount?: number; delivered?: Array<{ data?: { message?: string } }> };
  clientProof?: {
    ciphertext?: string;
    decrypted?: string;
    verified?: boolean;
    algorithm?: string;
  };
};

const SCENARIOS: Record<
  ScenarioKey,
  { label: string; subject: string; description: string; violation: string }
> = {
  message: {
    label: "Encrypted message",
    subject: "demo.message",
    description: "Send a normal message through an encrypted, contract-governed path.",
    violation: "Add a restricted field and verify that delivery is blocked."
  },
  payments: {
    label: "Payment authorisation",
    subject: "payments.authorize",
    description: "Evaluate a payment message against identity, intent and data policy.",
    violation: "Attach prohibited payment data and verify quarantine."
  },
  notifications: {
    label: "Notification delivery",
    subject: "notifications.send",
    description: "Run a notification through schema, data and delivery controls.",
    violation: "Attach a forbidden recipient field and verify quarantine."
  }
};

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const base64 = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptForDemo(plaintext: string) {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)
  );
  return {
    key,
    packed: `pigeon:aes-gcm:v1:${toBase64Url(iv)}:${toBase64Url(encrypted)}`
  };
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
  if (!value) return "Generated";
  if (value.length < 42) return value;
  return `${value.slice(0, 24)}…${value.slice(-12)}`;
}

export function LiveDemoV2() {
  const [scenario, setScenario] = useState<ScenarioKey>("message");
  const [mode, setMode] = useState<Mode>("allow");
  const [result, setResult] = useState<RunPayload | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("Hello from PigeonMQ");

  const selected = SCENARIOS[scenario];

  useEffect(() => {
    setResult(null);
  }, [scenario, mode]);

  const gates = useMemo(() => {
    if (result?.gates?.length) {
      return result.gates.map((item) => ({
        name: item.name || item.gate || "policy",
        pass: item.pass ?? item.outcome === "pass"
      }));
    }
    return ["identity", "intent", "schema", "region", "data", "idempotency"].map(
      (name) => ({ name, pass: undefined as boolean | undefined })
    );
  }, [result]);

  async function runDemo() {
    if (running) return;

    setRunning(true);
    setResult(null);

    try {
      let key: CryptoKey | null = null;
      let encryptedMessage: string | undefined;
      const plaintext = message.trim().slice(0, 96) || "Hello from PigeonMQ";

      if (scenario === "message") {
        const encrypted = await encryptForDemo(plaintext);
        key = encrypted.key;
        encryptedMessage = encrypted.packed;
      }

      const response = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario, mode, encryptedMessage })
      });

      const payload = (await response.json()) as RunPayload;

      if (scenario === "message" && key && payload.live) {
        const deliveredCiphertext = payload.receiver?.delivered?.[0]?.data?.message;
        let decrypted: string | undefined;

        if (mode === "allow" && deliveredCiphertext) {
          decrypted = await decryptForDemo(key, deliveredCiphertext);
        }

        payload.clientProof = {
          ciphertext: encryptedMessage,
          decrypted,
          verified: Boolean(decrypted && decrypted === plaintext),
          algorithm: "AES-256-GCM"
        };
      }

      if (!payload.live) {
        payload.error = "The live demo is temporarily unavailable. Please try again.";
      }

      setResult(payload);
    } catch {
      setResult({
        live: false,
        error: "The live demo is temporarily unavailable. Please try again."
      });
    } finally {
      setRunning(false);
    }
  }

  const allow = Boolean(result?.live && String(result.decision).toLowerCase().includes("allow"));
  const blocked = Boolean(result?.live && !allow);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-5 px-5 sm:px-10">
          <a href="/" className="flex items-center gap-2.5 rounded" aria-label="PigeonMQ home">
            <PigeonLogo size={34} />
            <span className="text-sm font-semibold tracking-[0.03em] text-ink">PIGEONMQ</span>
          </a>
          <a
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm text-text transition-colors hover:border-line-strong hover:text-ink"
          >
            <ArrowLeft size={14} /> Back
          </a>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1320px] px-5 py-16 sm:px-10 sm:py-24">
            <div className="max-w-[54rem]">
              <p className="font-mono text-[0.8rem] text-accent">LIVE DEMO</p>
              <h1 className="mt-5 font-serif text-[2.9rem] leading-[0.98] tracking-[-0.025em] text-ink sm:text-[4.1rem]">
                Send a message through PigeonMQ.
              </h1>
              <p className="mt-7 max-w-[46rem] text-[1.06rem] leading-[1.7] text-muted">
                See encryption, communication contracts and runtime policy enforcement work together before a message is delivered.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-line">
          <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-16 sm:px-10 sm:py-20 lg:grid-cols-[0.72fr_1.28fr]">
            <aside>
              <p className="font-mono text-[0.76rem] text-muted">01 · choose a message</p>
              <div className="mt-5 grid gap-2">
                {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => {
                  const item = SCENARIOS[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setScenario(key)}
                      className={`w-full rounded-md border p-4 text-left transition-colors ${
                        scenario === key
                          ? "border-line-strong bg-panel text-ink"
                          : "border-line bg-bg-soft text-text hover:border-line-strong"
                      }`}
                    >
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="mt-1.5 block text-xs leading-5 text-muted">{item.description}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.76rem] text-muted">02 · choose an outcome</p>
                  <h2 className="mt-2 font-serif text-[2rem] tracking-[-0.02em] text-ink">
                    {selected.label}
                  </h2>
                </div>

                <div className="flex rounded-md border border-line bg-panel p-0.5 text-sm">
                  <button
                    onClick={() => setMode("allow")}
                    className={`rounded px-4 py-2 ${
                      mode === "allow" ? "bg-navy text-bg" : "text-muted"
                    }`}
                  >
                    Allowed
                  </button>
                  <button
                    onClick={() => setMode("violation")}
                    className={`rounded px-4 py-2 ${
                      mode === "violation" ? "bg-navy text-bg" : "text-muted"
                    }`}
                  >
                    Violation
                  </button>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-lg border border-line-strong bg-panel">
                {scenario === "message" && (
                  <div className="border-b border-line bg-bg-soft p-5">
                    <label
                      htmlFor="demo-message"
                      className="block font-mono text-[0.72rem] uppercase tracking-[0.11em] text-muted"
                    >
                      Message
                    </label>
                    <textarea
                      id="demo-message"
                      value={message}
                      onChange={(event) => setMessage(event.target.value.slice(0, 96))}
                      rows={3}
                      maxLength={96}
                      className="mt-3 w-full resize-none rounded-md border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-line-strong"
                      placeholder="Type a message"
                    />
                    <div className="mt-2 flex justify-end font-mono text-[0.68rem] text-muted">
                      {message.length}/96
                    </div>
                  </div>
                )}

                <div className="p-5 sm:p-6">
                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      ["01", scenario === "message" ? "Encrypt" : "Prepare"],
                      ["02", "Contract"],
                      ["03", "Decide"],
                      ["04", mode === "allow" ? "Deliver" : "Contain"]
                    ].map(([step, label]) => (
                      <div key={step} className="rounded-md border border-line bg-bg p-4">
                        <span className="font-mono text-[10px] tracking-[0.12em] text-accent">{step}</span>
                        <span className="mt-2 block text-sm font-medium text-ink">{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 border-y border-line py-4 font-mono text-xs sm:grid-cols-3">
                    {gates.map((gate) => (
                      <div key={gate.name} className="flex items-center justify-between gap-2">
                        <span className="text-muted">{gate.name}</span>
                        {gate.pass === undefined ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                        ) : gate.pass ? (
                          <Check size={14} className="text-ok" />
                        ) : (
                          <X size={14} className="text-signal" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <button
                      onClick={runDemo}
                      disabled={running}
                      className="inline-flex h-11 items-center gap-2 rounded-md bg-navy px-5 text-sm font-medium text-bg transition-[transform,opacity] enabled:hover:-translate-y-0.5 enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {running ? "Running…" : "Run demo"}
                      {!running && <ArrowRight size={15} />}
                    </button>
                    <span className="font-mono text-xs text-muted">{selected.subject}</span>
                  </div>

                  {result && (
                    <div className="mt-6">
                      {!result.live ? (
                        <div className="rounded-md border border-line bg-bg p-4">
                          <p className="text-sm font-medium text-ink">Demo unavailable</p>
                          <p className="mt-1 text-sm leading-6 text-muted">{result.error}</p>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-lg border border-line-strong bg-term text-term-text">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                            <span className="font-mono text-xs text-term-dim">PIGEON DECISION</span>
                            <span
                              className={`font-mono text-xs font-semibold ${
                                allow ? "text-[#7CC9C8]" : "text-[#E7B25A]"
                              }`}
                            >
                              {String(result.decision || "decided").toUpperCase()}
                            </span>
                          </div>

                          <div className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-3">
                            <Proof
                              label="Policy"
                              value={allow ? "All checks passed" : "Violation contained"}
                            />
                            <Proof
                              label="Delivery"
                              value={allow ? "Confirmed" : "Blocked"}
                            />
                            <Proof
                              label="Time"
                              value={`${result.elapsedMs ?? "—"} ms`}
                            />
                          </div>

                          {scenario === "message" && result.clientProof && (
                            <div className="border-t border-white/10 px-4 py-4">
                              <div className="grid gap-3 sm:grid-cols-3">
                                <Proof label="Encryption" value={result.clientProof.algorithm || "AES-256-GCM"} />
                                <Proof
                                  label="Payload"
                                  value={compactCiphertext(result.clientProof.ciphertext)}
                                  mono
                                />
                                <Proof
                                  label="Verification"
                                  value={
                                    allow
                                      ? result.clientProof.verified
                                        ? "Recovered message matches"
                                        : "Delivery not verified"
                                      : "Message not delivered"
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {blocked && (
                    <p className="mt-4 text-sm leading-6 text-muted">
                      The message was stopped before delivery because it did not satisfy the communication contract.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Proof({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="block font-mono text-[10px] uppercase tracking-[0.11em] text-term-dim">
        {label}
      </span>
      <span className={`mt-1.5 block break-all text-sm text-term-text ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
