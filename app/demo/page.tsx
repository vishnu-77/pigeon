import type { Metadata } from "next";
import { LiveDemoV2 } from "@/components/LiveDemoV2";

export const metadata: Metadata = {
  title: "Live demo — Pigeon",
  description: "Send a browser-encrypted message through a live Pigeon communication contract and inspect the broker decision and delivery proof.",
  alternates: { canonical: "https://demo.pigeonmq.cc" },
  openGraph: {
    title: "Pigeon live demo",
    description: "Encrypt a message in the browser, run it through a live Pigeon communication contract, and inspect the broker decision and delivery proof.",
    url: "https://demo.pigeonmq.cc",
    siteName: "Pigeon",
    type: "website"
  }
};

export default function DemoPage() {
  return <LiveDemoV2 />;
}
