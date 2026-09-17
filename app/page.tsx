import { PigeonLogo } from "@/components/PigeonLogo";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--paper)] text-[color:var(--ink)]">
      <div className="site-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen max-w-[1320px] flex-col px-5 sm:px-10">
        <header className="flex h-16 items-center justify-between border-b border-[color:var(--line)]">
          <div className="flex items-center gap-3">
            <PigeonLogo size={30} />
            <span className="text-sm font-semibold tracking-[0.02em]">PIGEON</span>
          </div>
          <span className="mono text-[0.72rem] uppercase tracking-[0.12em] text-[color:var(--muted)]">Website maintenance</span>
        </header>

        <section className="flex flex-1 items-center py-20">
          <div className="grid w-full gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center">
            <div className="max-w-[46rem]">
              <p className="mono text-[0.8rem] text-[color:var(--brand)]">PigeonMQ · website rebuild in progress</p>
              <h1 className="mt-5 font-serif text-[3rem] leading-[0.98] tracking-[-0.03em] sm:text-[4.4rem]">
                We are rebuilding the Pigeon experience.
              </h1>
              <p className="mt-7 max-w-[38rem] text-[1.06rem] leading-8 text-[color:var(--muted)]">
                The broker and source code remain available. The public website is temporarily in maintenance while its interface, live-demo presentation and documentation are being rebuilt.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href="https://github.com/vishnu-77/pigeon" className="inline-flex h-11 items-center rounded-md bg-[color:var(--ink)] px-5 text-sm font-medium text-[color:var(--paper)] transition-transform hover:-translate-y-0.5">
                  View source on GitHub
                </a>
                <a href="https://www.npmjs.com/package/pigeonmq" className="inline-flex h-11 items-center rounded-md border border-[color:var(--line-strong)] px-5 text-sm transition-colors hover:bg-[color:var(--paper-soft)]">
                  npm package
                </a>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--terminal)] text-[color:var(--terminal-text)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <span className="mono text-[0.7rem] uppercase tracking-[0.12em] text-white/45">maintenance status</span>
                <span className="mono text-[0.7rem] text-[#E7B25A]">IN PROGRESS</span>
              </div>
              <div className="space-y-3 px-5 py-6 mono text-[0.78rem] leading-7">
                <p><span className="text-white/40">01</span> preserve Pigeon content and protocol narrative</p>
                <p><span className="text-white/40">02</span> restore canonical origami identity</p>
                <p><span className="text-white/40">03</span> rebuild visual system from OpenReflex reference</p>
                <p><span className="text-white/40">04</span> restore deterministic message replay and live-demo surfaces</p>
                <p className="text-white/45">deploying only after the complete interface passes review.</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-[color:var(--line)] py-6 text-sm text-[color:var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>Pigeon · contract-native messaging</span>
          <span className="mono text-xs">runtime unaffected</span>
        </footer>
      </div>
    </main>
  );
}
