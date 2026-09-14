import { Landing } from "@/components/Landing";

export default function Home() {
  return (
    <>
      <Landing />
      <a
        href="https://demo.pigeonmq.cc"
        className="fixed bottom-5 right-5 z-50 inline-flex h-11 items-center border border-[color:var(--ink)] bg-[color:var(--ink)] px-5 text-sm font-medium text-[color:var(--paper)] shadow-none transition-transform hover:-translate-y-0.5"
      >
        Run live demo →
      </a>
    </>
  );
}
