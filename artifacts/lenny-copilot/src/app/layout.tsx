import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Caveat } from "next/font/google";
import "./globals.css";

// Geist Sans + Mono come from the Vercel `geist` package — self-hosted
// woff2s, identical CSS-variable contract to next/font/google's Geist
// (which only exists from Next 15+). We're on Next 14.2, so this is the
// canonical path. Variables are `--font-geist-sans` and `--font-geist-mono`,
// matching what tailwind.config.ts already references.

// Caveat — RESERVED for the script wordmark accent only. Never use for
// headings or body text. Loaded with limited weights to keep payload light.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lenny's Framework Copilot",
  description:
    "Routes any product decision to the right framework from Lenny's archive — interactive workflow, cited artifact, triangulated against a challenger.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${caveat.variable}`}
    >
      <body className="bg-cream font-sans text-ink-body antialiased">
        {children}
      </body>
    </html>
  );
}
