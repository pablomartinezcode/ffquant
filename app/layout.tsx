import type { Metadata } from "next";
import "./globals.css";
import "./ffquant.css";

export const metadata: Metadata = {
  title: "FFQuant — Dynasty intelligence",
  description: "Performance-driven dynasty rankings, historical player research, and league-aware trade analysis.",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
