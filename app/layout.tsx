import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Newsreader, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "./docs-pages.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", preload: false });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.pigeonmq.cc"),
  title: "PigeonMQ — contract-native messaging",
  description: "PigeonMQ is an open-source message broker where communication authority is represented by short-lived runtime contracts and enforced before delivery.",
  applicationName: "PigeonMQ",
  alternates: { canonical: "/" },
  icons: { icon: "/brand/pigeon-mark.svg", shortcut: "/brand/pigeon-mark.svg", apple: "/brand/pigeon-mark.svg" },
  openGraph: {
    type: "website",
    url: "https://www.pigeonmq.cc",
    siteName: "PigeonMQ",
    title: "PigeonMQ — contract-native messaging",
    description: "Open-source messaging with runtime communication contracts.",
  },
  twitter: { card: "summary_large_image", title: "PigeonMQ — contract-native messaging", description: "Open-source messaging with runtime communication contracts." },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#F6F2E8", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${grotesk.variable} ${jetbrains.variable} ${newsreader.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
