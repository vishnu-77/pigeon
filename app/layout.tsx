import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pigeon — contract-native messaging",
  description:
    "Pigeon is a contract-native message broker. Every message runs under a runtime communication contract before it is routed.",
  metadataBase: new URL("https://www.pigeonmq.cc"),
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Pigeon — contract-native messaging",
    description: "Every message runs under a communication contract.",
    url: "https://www.pigeonmq.cc",
    siteName: "Pigeon",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Pigeon — contract-native messaging",
    description: "Every message runs under a communication contract."
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
