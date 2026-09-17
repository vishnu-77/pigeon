"use client";

import { useState } from "react";
import { PigeonLogo } from "@/components/PigeonLogo";

const links = [
  ["Get started", "/quickstart"],
  ["Concepts", "/concepts"],
  ["Protocol", "/protocol"],
  ["Use cases", "/use-cases"],
  ["Docs", "/docs"],
] as const;

export function PublicNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/92 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-5 px-5 sm:px-10" aria-label="Primary">
        <a href="/" className="flex items-center gap-2.5" aria-label="PigeonMQ home">
          <PigeonLogo size={34} />
          <span className="text-sm font-semibold tracking-[0.04em] text-ink">PIGEONMQ</span>
        </a>

        <div className="hidden items-center gap-7 text-[0.92rem] text-muted lg:flex">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="transition-colors hover:text-ink">{label}</a>
          ))}
          <a href="/demo" className="font-medium text-navy transition-opacity hover:opacity-70">Demo</a>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/vishnu-77/pigeon"
            target="_blank"
            rel="noreferrer"
            className="hidden h-9 items-center gap-1.5 rounded-md border border-line bg-transparent px-3.5 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:bg-panel hover:text-ink sm:inline-flex"
          >
            GitHub <span aria-hidden="true">↗</span>
          </a>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid h-9 w-9 place-items-center rounded-md border border-line text-lg text-muted transition-colors hover:border-line-strong hover:text-ink lg:hidden"
            aria-expanded={open}
            aria-label={open ? "Close navigation" : "Open navigation"}
          >
            {open ? "×" : "≡"}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-line bg-bg px-5 pb-5 pt-2 lg:hidden sm:px-10">
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block border-b border-line py-3.5 text-[0.98rem] text-text">{label}</a>
          ))}
          <a href="/demo" onClick={() => setOpen(false)} className="block border-b border-line py-3.5 text-[0.98rem] font-medium text-navy">Demo</a>
          <a href="https://github.com/vishnu-77/pigeon" target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 items-center rounded-md border border-line px-4 text-sm text-muted">GitHub ↗</a>
        </div>
      )}
    </header>
  );
}
