import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lenny's Framework Copilot",
  description: "Interactive step-by-step framework workflows for product decisions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
