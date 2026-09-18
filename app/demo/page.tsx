import type { Metadata } from "next";
import { LiveDemoV2 } from "@/components/LiveDemoV2";

export const metadata: Metadata = {
  title: "Live demo — Pigeon",
  description: "Send an encrypted message or a payment through Pigeon and see the broker's decision before delivery.",
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
