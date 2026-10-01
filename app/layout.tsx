import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Michelle's Motherboard",
  description: "Overblik over DP's nyhedsbreve og medlemskommunikation.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body className="antialiased">{children}</body>
    </html>
  );
}
