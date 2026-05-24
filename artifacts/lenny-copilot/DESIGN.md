# Design System — Lenny's Framework Copilot

> **Source of truth.** Read this before any visual or UI decision. All font choices, colors, spacing, and aesthetic direction are defined here. Do not deviate without explicit user approval. In QA mode, flag any code that doesn't match.

Extracted from three reference surfaces in Lenny's ecosystem (newsletter post, Lenny's Data MCP onboarding, Lenny's Product Pass landing) on 2026-05-24. Screenshots in `/Users/rakeshkatti/dev/lennys-newsletterpodcastdata-all/design/lennys-references/`.

---

## Product Context

- **What this is:** Lenny's Framework Copilot — interactive decision tool that routes a real product/growth/strategy decision to one of 121 frameworks from Lenny's newsletter + podcast archive, runs it as a guided workflow, ends with a cited artifact (+ always-on Decision Triangulation).
- **Who it's for:** PMs, founders, growth leads at any stage who want to apply a proven framework to a real decision, not just read about one.
- **Space:** Product-management tooling / AI productivity / Lenny's ecosystem (built for Lenny's contest).
- **Project type:** Web app (interactive workflow) + browse catalog. Single-page-feeling Next.js 14 App Router.
- **Memorable thing:** "It's a Lenny product." On first view a user should feel they're inside Lenny's ecosystem — warm, generous, opinionated.

## Aesthetic Direction

- **Direction:** **Warm editorial-tool** — Lenny's house style is editorial confidence (Substack typography, generous whitespace) meeting friendly utility (rounded cards, orange CTAs, playful illustrations). Not corporate SaaS, not consumer-app loud, not brutalist.
- **Decoration level:** **Intentional** — soft cream backgrounds, subtle shadows, the occasional illustrative mascot/icon. No purple gradients, no decorative blobs, no 3-column icon grids unless we earn them.
- **Mood:** Confident, warm, conversational. Reading should feel like a Lenny essay; clicking should feel like a useful tool.
- **Reference surfaces:** Lenny's Newsletter (substack), Lenny's Data MCP, Lenny's Product Pass.

## Typography

**Family:** **Geist** (sans + mono) — free, modern, on-trend with the AI-tooling space the contest will be judged in. Substack uses Söhne (paid); Geist is the closest free analog for our purposes.

**Roles:**

| Role | Font | Weight | Notes |
|------|------|--------|-------|
| Display / hero heading | Geist | 600–700 | Tight tracking, generous line-height |
| Section heading | Geist | 600 | |
| Body | Geist | 400 | Comfortable line-height (1.6) for the app's medium-length prose |
| UI labels / buttons | Geist | 500 | |
| Tiny-caps meta (bylines, "BEST VALUE" style tags) | Geist | 600 | `text-[10px] uppercase tracking-wide` |
| Data / tables | Geist | 400 | Use CSS `font-variant-numeric: tabular-nums` |
| Code blocks, inline code | Geist Mono | 400 | |
| Script wordmark accents (rare, intentional) | Caveat (Google) | 600 | Used ONLY for the "Lenny's Framework Copilot" wordmark and similar Lenny-style flourishes. Never for headings or body. |

**Loading:** Use Next.js `next/font/google` for Geist + Geist Mono. Caveat loaded the same way; preload only the weights we use.

**Modular scale (rem):** `0.6875` (11px meta) · `0.75` (12px small) · `0.875` (14px UI) · `1` (16px body) · `1.125` (18px lead) · `1.5` (24px h3) · `1.875` (30px h2) · `2.5` (40px h1) · `3.5` (56px display)

## Color

**Approach:** **Restrained warm** — cream surfaces, orange as the only saturated brand color, slate for ink. Color carries meaning. No accent rainbow.

| Token | Hex | Tailwind class | Use |
|-------|-----|----------------|-----|
| `bg-cream` | `#FFF7ED` | `orange-50` | Page background (entry, frameworks catalog, runner shell) |
| `bg-peach` | `#FFEDD5` | `orange-100` | Hero / header / decorative bands |
| `bg-peach-deep` | `#FED7AA` | `orange-200` | Soft chip backgrounds, selected pill fills |
| `bg-surface` | `#FFFFFF` | `white` | Cards, inputs, code "Copy" button surfaces |
| `brand-primary` | `#F97316` | `orange-500` | Primary CTAs, links on hover, the wordmark color |
| `brand-primary-hover` | `#EA580C` | `orange-600` | Hover state for primary CTAs |
| `brand-accent` | `#FB923C` | `orange-400` | Decorative accents, the script-wordmark fill |
| `ink-strong` | `#0F172A` | `slate-900` | Headings, primary text on cream |
| `ink-body` | `#334155` | `slate-700` | Body copy |
| `ink-muted` | `#64748B` | `slate-500` | Meta, captions, bylines |
| `ink-subtle` | `#94A3B8` | `slate-400` | Placeholder, dividers between meta items |
| `border-warm` | `#F3E8DC` | (custom) | Card borders on cream BG |
| `border-cool` | `#E2E8F0` | `slate-200` | Card borders on white BG, form inputs |
| `code-bg` | `#1E1B16` | (custom warm slate-900) | Code blocks |
| `code-text` | `#F1ECE6` | (custom warm slate-50) | Code text |
| `success` | `#16A34A` | `green-600` | Verdicts above benchmark threshold |
| `warning` | `#CA8A04` | `yellow-600` | Verdicts at threshold |
| `error` | `#DC2626` | `red-600` | Hard errors, citation failures |
| `triangulation-accent` | `#7C3AED` | `violet-600` | Sparingly — challenger framework block only, to differentiate from primary orange |

**Dark mode:** **Not in scope for Plan 5.** Lenny's surfaces are light-mode-only; we follow suit. If added later, redesign surfaces from cream/peach toward a warm-tinted slate-900 (`#1A1612` ish), keep orange at the same saturation.

## Spacing

- **Base unit:** 4px (Tailwind default — matches Lenny's surfaces).
- **Density:** **Comfortable** — closer to Lenny's editorial layouts than dense dashboard SaaS.
- **Scale:** `1` (4) · `2` (8) · `3` (12) · `4` (16) · `6` (24) · `8` (32) · `10` (40) · `12` (48) · `16` (64) · `20` (80) · `24` (96)
- **Section vertical rhythm:** `py-12 lg:py-16` for top-level page sections; `py-8` for in-card sections.
- **Max content width:** `max-w-3xl` (768px) for reading-density pages (entry, workflow runner step pane). `max-w-5xl` (1024px) for catalog grid + denser surfaces.

## Layout

- **Approach:** **Grid-disciplined editorial** — strict columns and predictable alignment, but generous gutters and centered single-column reading views. Not asymmetric, not magazine-style — it's an app first.
- **Grid:** Mobile = 1 col, sm = 1 col, md+ = 2 cols for card grids, lg+ = 3 cols for the catalog.
- **Header treatment:** Light, optional. The home page has no header (entry IS the page). Sub-pages get a `← Back` text-link top-left + meta top-right. No top nav bar.
- **Border radius scale:**
  - `sm`: `0.375rem` (6px) — small inputs, code blocks
  - `md`: `0.5rem` (8px) — buttons (non-pill), inputs
  - `lg`: `0.75rem` (12px) — small cards, chips with content
  - `xl`: `1rem` (16px) — primary cards
  - `2xl`: `1.5rem` (24px) — hero / showcase cards
  - `full`: `9999px` — pills, tabs, chips, brand CTAs

## Motion

- **Approach:** **Minimal-functional** — transitions only when they aid comprehension (hover, focus, panel mount). No scroll-driven choreography, no parallax. Lenny's pages are basically still.
- **Easing:** `ease-out` for enter, `ease-in` for exit, `ease-in-out` for state moves.
- **Duration:** `150ms` for micro (hover, focus ring), `200ms` for small state changes (chip select), `300ms` for panel mounts. No animation > 300ms.
- **Allowed effects:** opacity fade, transform-translate-y on hover (cards lift 2–4px), border-color shift, shadow lift. No skew, no rotate, no scale > 1.02.

## Component patterns

These are the recurring shapes across Lenny's surfaces. Plan 5 should reuse them rather than invent new ones.

**Primary CTA — orange pill**
```html
<button class="rounded-full bg-[#F97316] hover:bg-[#EA580C] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2">
  Find my framework →
</button>
```

**Secondary CTA — outline pill (white on cream)**
```html
<button class="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900">
  Back to downloads
</button>
```

**Card — primary surface on cream**
```html
<article class="rounded-xl border border-[#F3E8DC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_8px_rgba(160,100,40,0.06)]">
  …
</article>
```

**Chip — selected (pill-tab)**
```html
<button class="rounded-full bg-[#FED7AA] px-3 py-1 text-xs font-medium text-[#9A3412] ring-1 ring-inset ring-[#FB923C]">Claude</button>
```

**Chip — unselected**
```html
<button class="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:ring-slate-400">Cursor</button>
```

**Code block — dark navy on cream**
```html
<pre class="rounded-md bg-[#1E1B16] px-4 py-3 text-xs leading-relaxed text-[#F1ECE6] font-mono overflow-x-auto">…</pre>
```

**Tiny-caps tag (meta)**
```html
<span class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">May 5, 2026 · Paid</span>
```

**Wordmark (script)**
```html
<span class="font-['Caveat'] text-2xl font-semibold text-[#F97316]">Lenny's Framework Copilot</span>
```

## Voice

- **Tone:** Warm, conversational, generous. Lenny-style P.S. notes, casual asides, emoji when natural (👋 not 🚀).
- **Copy length:** Short. Headers state the action; bodies stay under 2 sentences.
- **CTAs:** Active verbs. "Find my framework →" beats "Submit decision." "Run this framework" beats "Start workflow."
- **Empty/error states:** Honest, never blame the user. "Couldn't route that — try describing the decision in a bit more detail" beats "Invalid input."
- **Citations:** Always credit. Source post links use `↳ {title}` chip; quotes use the existing dotted-underline tooltip pattern.

## Anti-patterns (do not ship)

- Purple/violet gradients as default accent (we use violet only for the triangulation challenger block, intentionally as contrast).
- Generic 3-column SaaS feature grid with icons in colored circles.
- Centered-everything hero with gradient CTA — Lenny's surfaces are left-aligned-editorial.
- `system-ui` or `Inter` as the primary font (the "I gave up on typography" signal).
- Uniform bubble border-radius on every element (we use a hierarchical scale).
- Glassmorphism, neumorphism, big drop shadows.
- Dark-mode-by-default — Lenny is light.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-24 | Initial design system extracted | From 3 reference screenshots of Lenny's web properties. Source of truth for Plan 5 polish work. |
| 2026-05-24 | Geist sans-serif throughout | User picked it over Source Serif body / Inter. Matches modern AI-tooling aesthetic the contest will be judged in. Free + Next.js-native via `next/font/google`. |
| 2026-05-24 | Caveat for script wordmark accents only | Closest free analog to Lenny's hand-lettered wordmark. Reserved for the app wordmark; never used for headings/body. |
| 2026-05-24 | Light-mode only for Plan 5 | Matches Lenny's surfaces. Dark mode deferred to a later plan if requested. |
