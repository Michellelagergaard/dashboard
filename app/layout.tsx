import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Udsendelsesdashboard | Dansk Psykolog Forening",
  description: "Internt analyseværktøj til DP's medlemskommunikation.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
