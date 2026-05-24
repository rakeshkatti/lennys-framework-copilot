import type { Config } from "tailwindcss";

/**
 * Tailwind theme extended with the DESIGN.md token system. Reference:
 * /Users/rakeshkatti/dev/lennys-framework-copilot/artifacts/lenny-copilot/DESIGN.md
 *
 * Class naming convention: use the semantic names (bg-cream, text-ink-body)
 * NOT the raw Tailwind palette (bg-orange-50, text-slate-700) so a future
 * palette tweak is a single config change.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        cream: "#FFF7ED",
        peach: "#FFEDD5",
        "peach-deep": "#FED7AA",
        // Brand
        brand: {
          DEFAULT: "#F97316",
          hover: "#EA580C",
          accent: "#FB923C",
          soft: "#FED7AA",
        },
        // Ink (text)
        ink: {
          strong: "#0F172A",
          body: "#334155",
          muted: "#64748B",
          subtle: "#94A3B8",
        },
        // Borders
        "border-warm": "#F3E8DC",
        // Code
        "code-bg": "#1E1B16",
        "code-text": "#F1ECE6",
        // Triangulation accent (challenger framework — intentional contrast)
        triangulation: "#7C3AED",
        "triangulation-soft": "#EDE9FE",
      },
      fontFamily: {
        // CSS variables are set in src/app/layout.tsx via next/font.
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        // Reserved for the wordmark / Lenny script accents only — NEVER for body or headings.
        script: ["var(--font-caveat)", "cursive"],
      },
      borderRadius: {
        // Hierarchical scale per DESIGN.md.
        card: "1rem",
        "card-hero": "1.5rem",
        chip: "9999px",
      },
      boxShadow: {
        // Soft warm shadow — matches Lenny's surfaces.
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(160,100,40,0.06)",
        "soft-lg": "0 2px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(160,100,40,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
