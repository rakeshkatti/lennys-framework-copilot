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
  title: "Lenny's Newsletter Co-pilot",
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
      <body className="flex min-h-screen flex-col bg-cream font-sans text-ink-body antialiased">
        <div className="flex-1">{children}</div>
        {/*
         * Site-wide footer for the archived contest project. Single line:
         * builder credit + author link. Subtle styling so it never competes
         * with page content; lives at the bottom of every route.
         */}
        <footer className="bg-cream py-4 text-center">
          <p className="text-xs text-ink-subtle">
            Built by{" "}
            <a
              href="https://rakeshkatti.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink-muted underline-offset-2 transition hover:text-ink-strong hover:underline"
            >
              Rakesh Katti
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
