import type { Metadata } from "next";
import { LiveDemoV2 } from "@/components/LiveDemoV2";

export const metadata: Metadata = {
  title: "Live demo — Pigeon",
  description: "Run a live Pigeon communication contract across a deployed sender, broker and receiver.",
  alternates: { canonical: "https://demo.pigeonmq.cc" },
  openGraph: {
    title: "Pigeon live demo",
    description: "Send a message through Pigeon and inspect the contract decision, delivery result and measured timings.",
    url: "https://demo.pigeonmq.cc",
    siteName: "Pigeon",
    type: "website"
  }
};

export default function DemoPage() {
  return (
    <>
      <LiveDemoV2 />
      <section className="border-t rule bg-[color:var(--paper)] text-[color:var(--ink)]">
        <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr]">
            <div>
              <p className="kicker mono text-[color:var(--brand)]">Measured broker path</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.035em]">Reference enforcement benchmark.</h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
                Latest CI reference run: GitHub Actions, Ubuntu 24.04, Node 22.23.2, 50,000 iterations on the in-memory single-node broker. These figures measure Pigeon&apos;s broker operations, not hosted network latency and not Kafka/NATS throughput.
              </p>
              <a
                href="https://github.com/vishnu-77/pigeon/blob/main/scripts/bench-enforcement.mjs"
                className="mt-5 inline-flex border-b border-[color:var(--line-strong)] pb-1 text-sm font-medium hover:border-[color:var(--ink)]"
              >
                Reproduce with npm run bench ↗
              </a>
            </div>

            <div className="grid gap-px border border-[color:var(--line)] bg-[color:var(--line)] sm:grid-cols-2">
              <article className="bg-[color:var(--paper-soft)] p-5">
                <span className="mono text-[10px] uppercase tracking-[.1em] text-[color:var(--muted)]">Contract negotiation</span>
                <strong className="mt-3 block text-3xl font-semibold tracking-[-.04em]">7.08 µs/op</strong>
                <span className="mt-2 block mono text-xs text-[color:var(--allow)]">141,159 ops/s</span>
              </article>
              <article className="bg-[color:var(--paper-soft)] p-5">
                <span className="mono text-[10px] uppercase tracking-[.1em] text-[color:var(--muted)]">Full governance + audit publish</span>
                <strong className="mt-3 block text-3xl font-semibold tracking-[-.04em]">10.79 µs/op</strong>
                <span className="mt-2 block mono text-xs text-[color:var(--allow)]">92,720 ops/s</span>
              </article>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
