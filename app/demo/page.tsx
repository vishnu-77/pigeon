import type { Metadata } from "next";
import { DemoPlayground } from "@/components/DemoPlayground";

export const metadata: Metadata = {
  title: "Playground — Pigeon",
  description: "Your messages, your rules. Explore Pigeon with your own payload, editable communication rules and real broker decisions.",
  alternates: { canonical: "https://demo.pigeonmq.cc" },
  openGraph: {
    title: "Pigeon playground — your messages, your rules",
    description: "Send your own message, change the communication rules and inspect Pigeon's decision before delivery.",
    url: "https://demo.pigeonmq.cc",
    siteName: "Pigeon",
    type: "website"
  }
};

export default function DemoPage() {
  return <DemoPlayground />;
}
