import type { Metadata } from "next";
import { LiveDemoV2 } from "@/components/LiveDemoV2";

export const metadata: Metadata = {
  title: "Live demo — Pigeon",
  description: "Try PigeonMQ live: send a message, apply a communication contract and see whether it is delivered or contained.",
  alternates: { canonical: "https://demo.pigeonmq.cc" },
  openGraph: {
    title: "Pigeon live demo",
    description: "Send a message through PigeonMQ and see communication contracts and runtime policy enforcement in action.",
    url: "https://demo.pigeonmq.cc",
    siteName: "Pigeon",
    type: "website"
  }
};

export default function DemoPage() {
  return <LiveDemoV2 />;
}
