# CLAUDE.md — Lenny's Framework Copilot (app)

This file is loaded automatically into every Claude Code / subagent session that runs from the `artifacts/lenny-copilot/` directory. Keep it short and load-bearing; deeper conventions live in `docs/` and `DESIGN.md`.

## What this app is

Lenny's Framework Copilot — an interactive decision tool. A user describes a real product/growth/strategy decision; we route to one of 121 frameworks from Lenny's newsletter + podcast archive; run it as a guided workflow; produce a cited artifact + always-on Decision Triangulation against a challenger framework.

- 4 hand-authored "golden" workflows in `data/frameworks/*.json` (DRICE, Strategy Blocks, B2B PMF Diagnostic, Stalled-Growth Diagnostic).
- 117 catalog entries in `data/catalog.json` ship as **synthesized** specs derived on the fly from `key_steps[]` (see `lib/spec/synthesize.ts`).
- `loadSpec(id)` resolves golden first, falls back to synthesis. `loadExcerpt` does the same for source markdown.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind (slate + warm-orange palette per DESIGN.md) · Zod · XState v5 · `@anthropic-ai/sdk` v0.39 with Claude Haiku 4.5 for routing and Sonnet 4.6 for adapt/triangulate. Prompt caching everywhere via `cacheableSystem: true`. MiniSearch v7 for lexical retrieval. vitest for tests.

## Design system

**Always read `DESIGN.md` before any visual or UI decision.** All font choices, colors, spacing, radii, motion, and component patterns are defined there. Do not deviate without explicit user approval. In `/qa` or `/review` mode, flag any code that doesn't match `DESIGN.md`.

The system is extracted from three reference surfaces in Lenny's ecosystem (newsletter post, Lenny's Data MCP, Lenny's Product Pass). Screenshots in `/Users/rakeshkatti/dev/lennys-newsletterpodcastdata-all/design/lennys-references/`.

## Conventions

- File organization: small focused files (< 400 lines typical, 800 max). `lib/` is server-only Node code; `src/components/` is client; cross the boundary with caution (`lib/benchmark.server.ts` vs `lib/benchmark.ts` is the canonical example).
- Tests live next to source (`lib/foo.ts` ↔ `lib/foo.test.ts`). vitest, not jest.
- Commits: conventional-commit prefixes (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `data:`). Attribution is disabled globally — no `Co-Authored-By` lines.
- Never commit `.next/` cache files. Use explicit `git add <path>` rather than `git add -A`.
- API keys live in `artifacts/lenny-copilot/.env.local` (not tracked).

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas / brainstorming → invoke /office-hours
- Strategy / scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system / plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs / errors → invoke /investigate
- QA / testing site behavior → invoke /qa or /qa-only
- Code review / diff check → invoke /review
- Visual polish → invoke /design-review
- Ship / deploy / PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
