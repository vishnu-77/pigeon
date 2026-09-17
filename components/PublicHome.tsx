"use client";

import { useState } from "react";
import { PublicNav } from "@/components/PublicNav";
import { PigeonLogo } from "@/components/PigeonLogo";

const capabilities = [
  ["Communication contracts", "Authenticate a principal, request subjects and operations, and receive a short-lived contract defining the session's communication authority."],
  ["Per-message admission", "Evaluate identity, intent, schema, region, classification, sensitive data and idempotency before append or delivery."],
  ["Delivery and replay", "Publish, receive, acknowledge and replay through the same contract-bound protocol."],
  ["Decision evidence", "Allow, deny or quarantine with typed broker decisions and inspectable audit evidence."],
] as const;

const concepts = [
  ["Principal", "Authenticated caller identity resolved by the broker."],
  ["Subject", "Named communication channel with broker policy."],
  ["Contract", "Short-lived authority binding principal, subjects and operations."],
  ["Envelope", "Governed message plus intent, region, classification and idempotency context."],
  ["Admission", "Ordered checks performed before a message proceeds."],
  ["Decision", "Allow, deny or quarantine with evidence."],
] as const;

const useCases = [
  ["Service messaging", "orders.created"],
  ["Async workers", "jobs.process"],
  ["Agent → tool", "agents.tool.invoke"],
  ["Regional flows", "customer.profile.export"],
  ["Operational events", "deploy.release.request"],
  ["Domain messaging", "notifications.send"],
] as const;

export function PublicHome() {
  const [copied, setCopied] = useState(false);

  async function copyInstall() {
    try {
      await navigator.clipboard.writeText("npm install pigeonmq");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <PublicNav />

      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1320px] gap-14 px-5 pb-20 pt-16 sm:px-10 sm:pb-28 sm:pt-24 lg:grid-cols-[minmax(0,1fr)_500px] lg:items-center">
            <div className="max-w-[46rem]">
              <div className="hero-enter hero-enter-1 flex items-center gap-5">
                <div className="hero-pigeon pigeon-idle" aria-hidden="true"><PigeonLogo size={148} /></div>
                <div>
                  <p className="font-mono text-[0.8rem] text-accent">Open-source message broker</p>
                  <p className="mt-1 text-sm text-muted">Pigeon Protocol v1 · Apache-2.0</p>
                </div>
              </div>

              <h1 className="hero-enter hero-enter-2 mt-7 font-serif text-[3rem] leading-[0.98] tracking-[-0.03em] text-ink sm:text-[4.35rem]">
                Contract-native messaging.
              </h1>
              <p className="hero-enter hero-enter-3 mt-7 max-w-[43rem] text-[1.1rem] leading-[1.72] text-muted">
                PigeonMQ is an open-source message broker where authenticated services negotiate short-lived communication contracts and every governed message is evaluated against broker policy before delivery.
              </p>

              <div className="hero-enter hero-enter-4 mt-8 flex max-w-[30rem] items-center gap-3 rounded-md border border-white/10 bg-term py-2 pl-4 pr-2 font-mono text-[0.9rem] text-term-text">
                <span className="select-none text-term-dim">$</span>
                <code className="flex-1 truncate">npm install pigeonmq</code>
                <button type="button" onClick={copyInstall} className="h-8 rounded border border-white/10 px-3 text-xs text-term-dim transition-colors hover:bg-white/[0.06] hover:text-term-text" aria-label="Copy install command">
                  {copied ? "copied" : "copy"}
                </button>
              </div>

              <div className="hero-enter hero-enter-5 mt-6 flex flex-wrap gap-3">
                <a href="/quickstart" className="inline-flex h-11 items-center rounded-md bg-navy px-5 text-[0.95rem] font-medium text-bg transition-[transform,opacity] hover:-translate-y-0.5 hover:opacity-90">Get started →</a>
                <a href="/demo" className="inline-flex h-11 items-center rounded-md border border-line-strong bg-panel px-5 text-[0.95rem] font-medium text-ink transition-colors hover:bg-muted-bg">Run live demo</a>
                <a href="/docs" className="inline-flex h-11 items-center px-2 text-[0.95rem] text-muted transition-colors hover:text-ink">Read docs →</a>
              </div>
            </div>

            <div className="hero-enter hero-enter-replay overflow-hidden rounded-lg border border-line-strong bg-term text-term-text">
              <div className="border-b border-white/10 px-5 py-3 font-mono text-[0.7rem] text-term-dim">message admission · notifications.send</div>
              <div className="space-y-3 p-5 font-mono text-[0.76rem] leading-6">
                <div><span className="text-term-dim">principal</span> orders-service</div>
                <div><span className="text-term-dim">contract</span> CTR_0182 · publish</div>
                <div><span className="text-term-dim">message</span> MSG_1049</div>
                <div className="mt-4 border-l border-white/15 pl-4 text-term-text/85">
                  <p>identity&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;✓</p>
                  <p>intent&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;✓</p>
                  <p>schema&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;✓</p>
                  <p>region&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;✓</p>
                  <p>data&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;✓</p>
                  <p>idempotency&nbsp;&nbsp;&nbsp;✓</p>
                </div>
                <div className="mt-5 border-l-2 border-[#7CC9C8] bg-[#7CC9C8]/[0.07] px-4 py-3 text-[#7CC9C8]">broker decision → ALLOW</div>
                <p className="text-term-dim">receiver → delivered · acknowledgement recorded</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-line">
          <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
            <div className="max-w-[52rem]">
              <p className="font-mono text-[0.78rem] text-accent">What PigeonMQ adds</p>
              <h2 className="mt-4 font-serif text-[2.55rem] leading-[1.03] tracking-[-0.025em] text-ink sm:text-[3.35rem]">Communication authority becomes part of the broker path.</h2>
              <p className="mt-5 text-[1.03rem] leading-8 text-muted">Subjects still organise communication. PigeonMQ additionally represents who may communicate, for which operation, and under which runtime constraints as a broker-issued contract.</p>
            </div>
            <div className="mt-12 grid overflow-hidden rounded-lg border border-line md:grid-cols-2 lg:grid-cols-4">
              {capabilities.map(([title, copy], index) => (
                <article key={title} className={`bg-panel p-6 ${index ? "border-t border-line md:border-l md:border-t-0" : ""} ${index === 2 ? "md:border-l-0 lg:border-l" : ""} ${index >= 2 ? "md:border-t lg:border-t-0" : ""}`}>
                  <p className="font-mono text-xs text-accent">0{index + 1}</p>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-line">
          <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-[50rem]">
                <p className="font-mono text-[0.78rem] text-accent">Core concepts</p>
                <h2 className="mt-4 font-serif text-[2.55rem] leading-[1.03] tracking-[-0.025em] text-ink sm:text-[3.35rem]">A small set of primitives, used consistently.</h2>
              </div>
              <a href="/concepts" className="text-sm font-medium text-navy">Learn the model →</a>
            </div>
            <div className="mt-12 grid border-y border-line sm:grid-cols-2 lg:grid-cols-3">
              {concepts.map(([title, copy], index) => (
                <article key={title} className={`p-6 ${index % 3 ? "lg:border-l lg:border-line" : ""} ${index >= 3 ? "border-t border-line" : index >= 2 ? "sm:border-t sm:border-line lg:border-t-0" : ""}`}>
                  <h3 className="font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-line">
          <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-20 sm:px-10 sm:py-24 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <p className="font-mono text-[0.78rem] text-accent">Pigeon Protocol v1</p>
              <h2 className="mt-4 font-serif text-[2.55rem] leading-[1.03] tracking-[-0.025em] text-ink sm:text-[3.35rem]">HTTP + JSON, with typed broker semantics.</h2>
              <p className="mt-5 text-[1rem] leading-7 text-muted">The Node.js implementation is the canonical broker today. JavaScript, Python and Rust clients preserve the same contract negotiation and error semantics.</p>
              <a href="/protocol" className="mt-7 inline-flex text-sm font-medium text-navy">Protocol reference →</a>
            </div>
            <div className="overflow-hidden rounded-lg border border-line-strong bg-term font-mono text-[0.75rem] text-term-text">
              <div className="border-b border-white/10 px-5 py-3 text-term-dim">protocol surface</div>
              <div className="divide-y divide-white/10">
                {[
                  ["POST", "/v1/contracts", "negotiate authority"],
                  ["POST", "/v1/messages", "publish"],
                  ["POST", "/v1/subjects/{subject}/receive", "receive"],
                  ["GET", "/v1/audit", "decision evidence"],
                  ["GET", "/v1/quarantine", "blocked communication"],
                ].map(([method, path, purpose]) => (
                  <div key={path} className="grid gap-1 px-5 py-3 sm:grid-cols-[64px_1fr_180px]">
                    <span className="text-[#7CC9C8]">{method}</span><span>{path}</span><span className="text-term-dim">{purpose}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="use-cases" className="border-b border-line">
          <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-[50rem]">
                <p className="font-mono text-[0.78rem] text-accent">Messaging patterns</p>
                <h2 className="mt-4 font-serif text-[2.55rem] leading-[1.03] tracking-[-0.025em] text-ink sm:text-[3.35rem]">The same enforcement model across application domains.</h2>
              </div>
              <a href="/use-cases" className="text-sm font-medium text-navy">Explore use cases →</a>
            </div>
            <div className="mt-12 grid overflow-hidden rounded-lg border border-line sm:grid-cols-2 lg:grid-cols-3">
              {useCases.map(([title, subject], index) => (
                <article key={subject} className={`bg-panel p-6 ${index % 3 ? "lg:border-l lg:border-line" : ""} ${index >= 3 ? "border-t border-line" : index >= 2 ? "sm:border-t sm:border-line lg:border-t-0" : ""}`}>
                  <p className="font-mono text-xs text-accent">{subject}</p>
                  <h3 className="mt-4 font-semibold text-ink">{title}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-line">
          <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-10 sm:py-24">
            <div className="rounded-lg border border-line-strong bg-panel p-7 sm:p-10 lg:flex lg:items-end lg:justify-between lg:gap-12">
              <div className="max-w-[48rem]">
                <p className="font-mono text-[0.78rem] text-accent">Start building</p>
                <h2 className="mt-4 font-serif text-[2.45rem] leading-[1.04] tracking-[-0.02em] text-ink sm:text-[3.2rem]">Start a broker. Negotiate a contract. Send a message.</h2>
                <p className="mt-5 text-[1rem] leading-7 text-muted">The quickstart takes you from installation to an accepted message, then shows how a policy violation is quarantined before delivery.</p>
              </div>
              <div className="mt-7 flex flex-wrap gap-3 lg:mt-0">
                <a href="/quickstart" className="inline-flex h-11 items-center rounded-md bg-navy px-5 text-[0.95rem] font-medium text-bg hover:opacity-90">Quickstart →</a>
                <a href="/docs" className="inline-flex h-11 items-center rounded-md border border-line-strong bg-bg px-5 text-[0.95rem] text-ink hover:bg-muted-bg">Documentation</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="flex items-center gap-2.5"><PigeonLogo size={28} /><span>PigeonMQ · contract-native messaging</span></div>
          <div className="flex flex-wrap gap-5">
            <a href="/quickstart">Quickstart</a><a href="/docs">Docs</a><a href="/demo">Demo</a><a href="https://github.com/vishnu-77/pigeon" target="_blank" rel="noreferrer">GitHub ↗</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
