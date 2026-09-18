"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { PigeonLogo } from "@/components/PigeonLogo";

type Draft = {
  subject: string; sender: string; region: string; allowedSender: string;
  allowedRegion: string; forbiddenField: string; requiredField: string; message: string;
};
type PlaygroundPolicy = { allowedSenders: string[]; allowedRegions: string[]; forbiddenFields: string[]; requiredFields: string[] };
type Run = {
  runId: string; decision: "ALLOW" | "DENY" | "QUARANTINE"; elapsedMs: number;
  code: string; reason: string; contract: { id: string } | null;
  receiver: { receivedCount: number; delivered: Array<{ id: string; data: Record<string, unknown> }> };
  quarantineCount: number; audit: Array<{ type: string; time: string; [key: string]: unknown }>;
  execution: string; draft: Draft; number: number; preset: Preset; policy: PlaygroundPolicy; policyText: string;
};

const INITIAL: Draft = {
  subject: "my.message", sender: "my-app", region: "uk", allowedSender: "my-app",
  allowedRegion: "uk", forbiddenField: "password", requiredField: "message",
  message: JSON.stringify({ message: "Hello from Pigeon" }, null, 2)
};
const PRESETS = {
  message: { label: "Your own message", detail: "Start with your idea", draft: INITIAL },
  payments: {
    label: "Payment request", detail: "Optional example",
    draft: { ...INITIAL, subject: "payments.authorize", sender: "checkout", allowedSender: "checkout", forbiddenField: "card.pan", requiredField: "paymentToken", message: JSON.stringify({ orderId: "order_1042", amount: 42.5, currency: "GBP", paymentToken: "tok_demo" }, null, 2) }
  },
  notification: {
    label: "Notification", detail: "Optional example",
    draft: { ...INITIAL, subject: "notifications.send", sender: "worker", allowedSender: "worker", forbiddenField: "customer.email", requiredField: "message", message: JSON.stringify({ message: "Your order is on its way", recipientId: "customer_28" }, null, 2) }
  }
} satisfies Record<string, { label: string; detail: string; draft: Draft }>;
type Preset = keyof typeof PRESETS;
const SENDERS = ["my-app", "worker", "checkout", "unknown-service"];
const REGIONS = [["uk", "United Kingdom"], ["eu", "European Union"], ["us", "United States"]];

function policyFor(draft: Draft): PlaygroundPolicy {
  return { allowedSenders: [draft.allowedSender], allowedRegions: draft.allowedRegion === "any" ? ["uk", "eu", "us"] : [draft.allowedRegion], forbiddenFields: draft.forbiddenField ? [draft.forbiddenField] : [], requiredFields: draft.requiredField ? [draft.requiredField] : [] };
}

function policyJson(draft: Draft) { return JSON.stringify(policyFor(draft), null, 2); }

function parseMessage(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Use a JSON object, for example { \"message\": \"Hello\" }.");
  return parsed;
}

function displayReason(run: Run) {
  if (run.code === "NO_PERMITTED_SUBJECTS") return `${run.draft.sender} cannot send to this subject. Allowed senders: ${run.policy.allowedSenders.join(", ") || "none"}.`;
  if (run.code === "SENSITIVE_FIELD_DENIED") return `${run.reason} Edit the field restriction or remove the field, then rerun.`;
  if (run.code === "REGION_DENIED") return `This message is from ${run.draft.region.toUpperCase()}. Allowed regions: ${run.policy.allowedRegions.join(", ").toUpperCase()}.`;
  if (run.code === "SCHEMA_INVALID") return `${run.reason} Edit the required fields or update the message, then rerun.`;
  return run.reason;
}

function ResultBadge({ run }: { run: Run }) {
  const delivered = run.decision === "ALLOW" && run.receiver.receivedCount > 0;
  return <span className={`pg-badge ${delivered ? "pg-badge-success" : "pg-badge-blocked"}`}>{delivered ? <Check size={12} /> : <X size={12} />}{delivered ? "Delivered" : run.decision === "ALLOW" ? "Not received" : "Blocked"}</span>;
}

export function DemoPlayground() {
  const [draft, setDraft] = useState<Draft>(INITIAL);
  const [policyText, setPolicyText] = useState(() => policyJson(INITIAL));
  const [preset, setPreset] = useState<Preset>("message");
  const [result, setResult] = useState<Run | null>(null);
  const [history, setHistory] = useState<Run[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef<AbortController | null>(null);
  const runNumber = useRef(0);
  useEffect(() => () => inFlight.current?.abort(), []);

  function edit(patch: Partial<Draft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setResult(null);
    setError("");
  }

  function choosePreset(key: Preset) {
    if (inFlight.current) return;
    setPreset(key); setDraft({ ...PRESETS[key].draft }); setPolicyText(policyJson(PRESETS[key].draft)); setResult(null); setError("");
  }

  function editPolicy(text: string) { setPolicyText(text); setResult(null); setError(""); }

  function changePolicy(patch: Partial<PlaygroundPolicy>) {
    try { editPolicy(JSON.stringify({ ...parseMessage(policyText), ...patch }, null, 2)); }
    catch { setError("Fix the policy JSON before applying a suggested change."); }
  }

  function addBlockedField() {
    try {
      const payload = parseMessage(draft.message);
      const policy = parseMessage(policyText);
      const field = Array.isArray(policy.forbiddenFields) ? policy.forbiddenFields[0] : null;
      if (typeof field !== "string" || !field || !/^[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*$/.test(field) || field.split(".").some((part) => ["__proto__", "constructor", "prototype"].includes(part))) {
        setError("Choose a blocked field in Pigeon’s rules first, such as password or card.pan."); return;
      }
      const parts = field.split(".");
      let parent = payload;
      for (const part of parts.slice(0, -1)) {
        if (!parent[part] || typeof parent[part] !== "object" || Array.isArray(parent[part])) parent[part] = {};
        parent = parent[part] as Record<string, unknown>;
      }
      const leaf = parts[parts.length - 1];
      if (Object.hasOwn(parent, leaf)) delete parent[leaf];
      else parent[leaf] = "demo-only-value";
      edit({ message: JSON.stringify(payload, null, 2) });
    } catch { setError("Fix the JSON message before adding a field."); }
  }

  async function sendMessage() {
    if (inFlight.current) return;
    let payload: Record<string, unknown>;
    try { payload = parseMessage(draft.message); }
    catch (caught) { setError(caught instanceof SyntaxError ? "Your JSON needs a small fix. Check quotation marks, commas and closing brackets." : (caught as Error).message); return; }
    let policy: Record<string, unknown>;
    try { policy = parseMessage(policyText); }
    catch { setError("Policy must be valid JSON. Check its arrays, quotation marks and commas."); return; }
    const controller = new AbortController();
    inFlight.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    const snapshot = { ...draft };
    setRunning(true); setResult(null); setError("");
    try {
      const response = await fetch("/api/demo/playground/", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...snapshot, message: undefined, payload, policy }), signal: controller.signal
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "This run could not complete. Please try again.");
      const completed: Run = { ...body, draft: snapshot, preset, policyText, number: ++runNumber.current };
      setResult(completed); setHistory((previous) => [completed, ...previous].slice(0, 8));
    } catch (caught) {
      setError(controller.signal.aborted ? "This run took too long. Your draft is saved here; try sending again." : caught instanceof Error ? caught.message : "The playground could not be reached. Please try again.");
    } finally {
      clearTimeout(timeout); inFlight.current = null; setRunning(false);
    }
  }

  const delivered = result?.receiver.delivered[0];
  const blocked = result && result.decision !== "ALLOW";
  const previous = result && history.find((run) => run.number < result.number && run.draft.message === result.draft.message && run.draft.subject === result.draft.subject && run.draft.sender === result.draft.sender && run.draft.region === result.draft.region && JSON.stringify(run.policy) !== JSON.stringify(result.policy));
  const changedRules = result && previous ? (Object.keys(result.policy) as Array<keyof PlaygroundPolicy>).filter((key) => JSON.stringify(previous.policy[key]) !== JSON.stringify(result.policy[key])) : [];

  return (
    <div className="pg-page">
      <header className="pg-header">
        <nav className="site-navigation pg-nav" aria-label="Playground navigation">
          <a href="/" className="pg-brand" aria-label="Pigeon home"><PigeonLogo size={30} /><span>PIGEON</span><span className="pg-nav-divider" /><span className="pg-nav-section">Playground</span></a>
          <div className="pg-nav-links"><a href="/" className="pg-home-link"><ArrowLeft size={14} /> Back to home</a><a href="https://github.com/vishnu-77/pigeon" target="_blank" rel="noreferrer">View source <span aria-hidden="true">↗</span></a></div>
        </nav>
      </header>

      <main className="pg-shell">
        <section className="pg-intro" aria-labelledby="playground-title">
          <div>
            <p className="pg-eyebrow"><span className="pg-dot" /> THE PIGEON PLAYGROUND</p>
            <h1 id="playground-title">Edit the policy.<br /><em>Watch the decision change.</em></h1>
            <p className="pg-intro-copy">Keep the message. Change who can send it, where it can go, or what it can contain.<br className="pg-desktop-break" /> Run it again and compare the broker’s decision with the previous run.</p>
          </div>
          <aside className="pg-intro-note"><span className="pg-note-number">01 — 02 — 03</span><p>One message.<br />A few rules.<br /><strong>A decision you can inspect.</strong></p><span className="pg-note-caption">Real Pigeon engine · isolated per run</span></aside>
        </section>

        <section className="pg-preset-bar" aria-label="Starting examples">
          <span className="pg-preset-label">Start with</span>
          <div className="pg-presets">{(Object.keys(PRESETS) as Preset[]).map((key) => <button key={key} type="button" disabled={running} aria-pressed={preset === key} className={`pg-preset ${preset === key ? "is-active" : ""}`} onClick={() => choosePreset(key)}>{key === "message" ? <span aria-hidden="true">✳</span> : <span className="pg-preset-square" aria-hidden="true" />}{PRESETS[key].label}</button>)}</div>
          <span className="pg-preset-hint">Examples are starting points. Make them yours.</span>
        </section>

        <div className="pg-workspace" aria-busy={running}>
          <section className="pg-card pg-sender" aria-labelledby="sender-heading">
            <div className="pg-card-heading"><div><p className="pg-step">01 / COMPOSE</p><h2 id="sender-heading">Sender</h2></div><span className="pg-direction" aria-hidden="true"><ArrowRight size={20} /></span></div>
            <fieldset disabled={running} className="pg-fields">
              <legend className="pg-sr-only">Message configuration</legend>
              <label className="pg-label" htmlFor="pg-subject">Subject <span>The destination for your message</span></label>
              <input id="pg-subject" value={draft.subject} maxLength={80} onChange={(e) => edit({ subject: e.target.value })} spellCheck={false} className="pg-input pg-mono" />
              <div className="pg-two-fields"><div><label className="pg-label" htmlFor="pg-sender">Send as</label><select id="pg-sender" className="pg-input" value={draft.sender} onChange={(e) => edit({ sender: e.target.value })}>{SENDERS.map((sender) => <option key={sender}>{sender}</option>)}</select></div><div><label className="pg-label" htmlFor="pg-region">From region</label><select id="pg-region" className="pg-input" value={draft.region} onChange={(e) => edit({ region: e.target.value })}>{REGIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
              <div className="pg-editor-label"><label className="pg-label" htmlFor="pg-message">Your message</label><span className="pg-mono">JSON</span></div>
              <div className="pg-editor"><div className="pg-line-numbers" aria-hidden="true">{draft.message.split("\n").map((_, i) => <span key={i}>{i + 1}</span>)}</div><textarea id="pg-message" value={draft.message} onChange={(e) => edit({ message: e.target.value })} spellCheck={false} aria-describedby={error ? "pg-error" : "pg-json-help"} aria-invalid={Boolean(error)} maxLength={4096} /></div>
              <div id="pg-json-help" className="pg-editor-footer"><span>Edit any value above</span><span>{draft.message.length.toLocaleString()} / 4,096</span></div>
              <button className="pg-test-field" type="button" onClick={addBlockedField}>＋ Add / remove blocked field <span aria-hidden="true">↗</span></button>
              <button type="button" className="pg-send" onClick={sendMessage}>{running ? "Checking your message…" : "Send message"}{running ? <span className="pg-spinner" /> : <ArrowRight size={17} />}</button>
            </fieldset>
            <p className="pg-card-footnote">Your draft stays here. Every send starts a fresh run.</p>
          </section>

          <section className="pg-card pg-broker" aria-labelledby="broker-heading">
            <div className="pg-card-heading"><div><p className="pg-step">02 / GOVERN</p><h2 id="broker-heading"><PigeonLogo size={26} /> Pigeon</h2></div><span className="pg-broker-label">THE CONTRACT</span></div>
            <p className="pg-broker-copy">Edit this policy, then run your message again.<br />Every value below changes what Pigeon enforces.</p>
            <fieldset className="pg-fields pg-policy-fields" disabled={running}>
              <legend className="pg-sr-only">Communication rules</legend>
              <label className="pg-policy-file" htmlFor="pg-policy"><span>policy.json</span><span>EDITABLE</span></label>
              <textarea id="pg-policy" className="pg-policy-editor" value={policyText} onChange={(e) => editPolicy(e.target.value)} maxLength={3000} spellCheck={false} aria-describedby="pg-policy-help" />
              <p id="pg-policy-help" className="pg-policy-help">Lists accept multiple values. Use [] to remove a field constraint. These playground rules compile into a Pigeon subject policy.</p>
              <div className="pg-policy-actions"><button type="button" onClick={() => changePolicy({ allowedSenders: [] })}>Deny all senders</button><button type="button" onClick={() => changePolicy({ allowedSenders: [draft.sender] })}>Allow this sender</button><button type="button" onClick={() => changePolicy({ forbiddenFields: [] })}>Clear blocked fields</button></div>
              <button type="button" className="pg-policy-run" onClick={sendMessage}>{running ? "Evaluating…" : "Run with this policy"}<ArrowRight size={14} /></button>
            </fieldset>
            <div className={`pg-decision ${result ? blocked ? "is-blocked" : "is-allowed" : ""}`} aria-live="polite"><span className="pg-decision-label">BROKER DECISION</span><strong>{running ? "Evaluating…" : result ? result.decision : "Waiting for a message"}</strong><p>{result ? displayReason(result) : "A decision appears only after you send."}</p></div>
          </section>

          <section className="pg-card pg-receiver" aria-labelledby="receiver-heading">
            <div className="pg-card-heading"><div><p className="pg-step">03 / RECEIVE</p><h2 id="receiver-heading">Receiver</h2></div><span className="pg-inbox-count">{result?.receiver.receivedCount ?? 0} received</span></div>
            <div className="pg-receiver-content" aria-live="polite">
              {result ? <>
                <ResultBadge run={result} />
                <h3>{delivered ? "Made it through." : "Nothing crossed the boundary."}</h3>
                <p className="pg-receiver-description">{delivered ? "This is the message the receiver actually read." : "The receiver was checked. Its inbox is empty for this run."}</p>
                {delivered ? <pre className="pg-received-json"><code>{JSON.stringify(delivered.data, null, 2)}</code></pre> : <div className="pg-empty-blocked"><X size={24} /><span>No message delivered</span></div>}
                <dl className="pg-receipt"><div><dt>Contract</dt><dd>{result.contract ? "Issued" : "Not granted"}</dd></div><div><dt>Receiver read</dt><dd>{result.receiver.receivedCount} message{result.receiver.receivedCount === 1 ? "" : "s"}</dd></div><div><dt>Quarantine</dt><dd>{result.quarantineCount ? "Evidence recorded" : "No records"}</dd></div><div><dt>Engine time</dt><dd>{result.elapsedMs} ms</dd></div></dl>
              </> : <div className="pg-empty"><div className="pg-inbox-art" aria-hidden="true"><span /><span /><span /></div><h3>{running ? "Waiting on Pigeon…" : "Your message lands here."}</h3><p>{running ? "The broker is evaluating your message against the rules you chose." : "Send a message to see what reaches the other side."}</p><span className="pg-empty-caption">ONLY ACCEPTED MESSAGES ARRIVE</span></div>}
            </div>
            <div className="pg-receiver-note"><span className="pg-dot" /><p>Private to this run.<br /><span>No other visitor can receive your message.</span></p></div>
          </section>
        </div>

        {error && <div className="pg-error" id="pg-error" role="alert"><X size={18} /><div><strong>This run could not complete.</strong><p>{error}</p><span>Your draft and previous runs are still here.</span></div></div>}

        {result && previous && <section className="pg-comparison" aria-label="Policy change comparison"><div><span className="pg-step">SAME MESSAGE · DIFFERENT POLICY</span><h2>{previous.decision} <span aria-hidden="true">→</span> {result.decision}</h2><p>The message, sender, subject and region stayed the same.</p></div><div>{changedRules.map((key) => <p key={key}><strong>{key}</strong><code>{JSON.stringify(previous.policy[key])} → {JSON.stringify(result.policy[key])}</code></p>)}</div></section>}

        <section className="pg-next-step"><span className="pg-tip-mark" aria-hidden="true">↳</span><p><strong>Try changing one thing.</strong> Add a blocked field, switch the sender, or send from another region. Watch what changes at the receiver.</p></section>

        <section className="pg-history" aria-labelledby="history-heading">
          <div className="pg-history-header"><div><p className="pg-step">THE EVIDENCE</p><h2 id="history-heading">Your experiments <span>{history.length.toString().padStart(2, "0")}</span></h2></div><button type="button" disabled={running} className="pg-reset" onClick={() => { choosePreset("message"); setHistory([]); runNumber.current = 0; }}><RotateCcw size={13} /> Start fresh</button></div>
          {history.length ? <div className="pg-history-list">{history.map((run) => <button type="button" key={run.runId} disabled={running} aria-pressed={result?.runId === run.runId} className={`pg-history-row ${result?.runId === run.runId ? "is-selected" : ""}`} onClick={() => { setDraft(run.draft); setPolicyText(run.policyText); setResult(run); setPreset(run.preset); setError(""); }}><span className="pg-run-number">{run.number.toString().padStart(2, "0")}</span><span className="pg-run-subject">{run.draft.subject}<small>{run.draft.sender} · {run.draft.region.toUpperCase()}</small></span><span className="pg-run-reason">{run.decision === "ALLOW" ? "Accepted and received" : displayReason(run)}</span><ResultBadge run={run} /><span className="pg-run-time">{run.elapsedMs} ms</span><ArrowRight size={14} /></button>)}</div> : <div className="pg-history-empty"><span className="pg-history-dash">—</span><p>Your first experiment starts with a message.<span>Results will stay here so you can compare what changed.</span></p><span className="pg-history-meta">LAST 8 RUNS · THIS TAB ONLY</span></div>}
          {result && <details className="pg-inspect"><summary>Inspect this run <span>Request, contract & broker audit</span></summary><div className="pg-inspect-grid"><div><h3>Request & rules</h3><pre>{JSON.stringify({ subject: result.draft.subject, sender: result.draft.sender, region: result.draft.region, payload: JSON.parse(result.draft.message), policy: result.policy }, null, 2)}</pre></div><div><h3>Broker evidence</h3><pre>{JSON.stringify({ runId: result.runId, decision: result.decision, code: result.code, contract: result.contract, audit: result.audit }, null, 2)}</pre></div></div></details>}
        </section>

        <footer className="pg-footer"><span>PIGEON <span className="pg-footer-divider">/</span> Every message runs under a contract.</span><p>Isolated playground · real policy enforcement · no persistent storage</p></footer>
      </main>
    </div>
  );
}
