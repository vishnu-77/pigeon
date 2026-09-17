import type { ReactNode } from "react";
import { PublicNav } from "@/components/PublicNav";

const docs = [
  ["Overview", "/docs"],
  ["Quickstart", "/quickstart"],
  ["Core concepts", "/concepts"],
  ["Protocol v1", "/protocol"],
  ["Use cases", "/use-cases"],
  ["Live demo", "/demo"],
] as const;

export function DocsShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <PublicNav />
      <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-12 sm:px-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-accent">Documentation</p>
          <nav className="mt-4 border-t border-line text-sm" aria-label="Documentation">
            {docs.map(([label, href]) => (
              <a key={href} href={href} className="block border-b border-line py-3 text-muted transition-colors hover:text-ink">{label}</a>
            ))}
          </nav>
          <div className="mt-6 text-xs leading-6 text-muted">
            <p>Pigeon Protocol v1</p>
            <p>Apache-2.0</p>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="border-b border-line pb-10">
            <p className="font-mono text-[0.76rem] text-accent">{eyebrow}</p>
            <h1 className="mt-4 max-w-[50rem] font-serif text-[2.8rem] leading-[1] tracking-[-0.025em] text-ink sm:text-[4rem]">{title}</h1>
            <p className="mt-6 max-w-[48rem] text-[1.05rem] leading-8 text-muted">{intro}</p>
          </div>
          <article className="docs-prose py-10">{children}</article>
        </main>
      </div>
    </div>
  );
}
