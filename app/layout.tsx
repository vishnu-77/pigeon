import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Newsreader, Space_Grotesk } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", preload: false });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.pigeonmq.cc"),
  title: "Pigeon — contract-native messaging",
  description: "Pigeon is a contract-native message broker. Every message runs under a runtime communication contract before it is routed.",
  applicationName: "Pigeon",
  alternates: { canonical: "/" },
  icons: { icon: "/brand/pigeon-mark.svg", shortcut: "/brand/pigeon-mark.svg", apple: "/brand/pigeon-mark.svg" },
  openGraph: {
    type: "website",
    url: "https://www.pigeonmq.cc",
    siteName: "Pigeon",
    title: "Pigeon — contract-native messaging",
    description: "Every message runs under a communication contract.",
  },
  twitter: { card: "summary_large_image", title: "Pigeon — contract-native messaging", description: "Every message runs under a communication contract." },
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
