import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pigeon — contract-native messaging",
  description:
    "Pigeon is a contract-native message broker. Every message runs under a runtime communication contract before it is routed.",
  metadataBase: new URL("https://github.com/vishnu-77/pigeon"),
  openGraph: {
    title: "Pigeon — contract-native messaging",
    description: "Every message runs under a communication contract.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
