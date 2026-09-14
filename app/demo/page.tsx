import type { Metadata } from "next";
import { LiveDemoV2 } from "@/components/LiveDemoV2";

export const metadata: Metadata = {
  title: "Live demo — Pigeon",
  description: "Run a live Pigeon communication contract across a deployed sender, broker and receiver.",
  alternates: { canonical: "https://demo.pigeonmq.cc" },
  openGraph: {
    title: "Pigeon live demo",
    description: "Run a real communication contract and watch Pigeon allow or quarantine a message before delivery.",
    url: "https://demo.pigeonmq.cc",
    siteName: "Pigeon",
    type: "website"
  }
};

export default function DemoPage() {
  return <LiveDemoV2 />;
}
