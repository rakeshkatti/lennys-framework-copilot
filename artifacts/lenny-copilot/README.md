# Lenny's Newsletter Co-pilot

> Type a real product decision. Get routed to the right framework from Lenny's archive. Run it as an interactive workflow. Walk out with a cited artifact and a counter-perspective from a challenger framework.

Built for the **What will you build with Lenny's data?** contest by [Rakesh Katti](https://github.com/rakeshkatti).

## What it does

- **Routes any decision** to one of **121 frameworks** extracted from Lenny's newsletter + podcast archive — using lexical retrieval + Claude Haiku for the pick.
- **Runs the framework** as an interactive step-by-step workflow. Four hand-authored "golden" workflows ship with structured inputs (DRICE score grid, Strategy Blocks dimension scoring, B2B PMF Diagnostic, Stalled-Growth Diagnostic). The other 117 are synthesized on the fly from each catalog entry's key steps.
- **Cites everything.** Every Sonnet-adapted guidance sentence carries a verbatim quote from the source piece. No invented framework advice.
- **Triangulates.** Always-on Decision Triangulation runs a Sonnet pass against a challenger framework so you see the strongest counter-argument before shipping.

## Try it

(Replace this line with the hosted Replit/Vercel URL once deployed.)

## How it works

1. **Router** — `lib/route/router.ts`. MiniSearch lexical retrieval narrows 121 frameworks to a top-15 candidate set; Claude Haiku picks one via a forced tool call with question-bank few-shots. Deterministic tier promotion swaps a guidance-tier pick for a hand-authored workflow-tier sibling in the same category.

2. **Workflow** — `src/components/WorkflowRunner.tsx` + `lib/engine/`. XState v5 drives a sequential or branching workflow; the spec format (`lib/spec.ts`) supports text, list, number, choice, multi-choice, and score-grid inputs with dimension-sum scoring and benchmark verdicts. `lib/spec/synthesize.ts` derives a spec on the fly from any catalog entry — so adding a 122nd framework only needs a catalog entry, not a hand-authored JSON.

3. **Adaptation** — `lib/adapt/adapt.ts`. Claude Sonnet rewrites each step's static guidance for the user's specific inputs, but only using verbatim substrings of the source excerpt; any sentence that fails citation match falls back to the static text. Prompt caching on the system + excerpt + framework context keeps per-step cost low even with full-markdown excerpts on the 117 synthesized workflows.

4. **Triangulation** — `lib/triangulate.ts`. One Sonnet pass over the user's inputs and the primary artifact, lensed through a challenger framework picked by category proximity. Output is appended to the artifact as a "Counter-perspective" block.

## What's in the corpus

- **121** frameworks in `data/catalog.json` (13 categories, 4 workflow-tier, 117 guidance-tier).
- **108** source markdown files in `data/corpus/` (53 newsletters + 55 podcast transcripts), snapshotted from the Lenny's Data archive.
- **143** question-bank entries in `data/question-bank.json` for router few-shot grounding and home-page chip seeds.
- **9** metric benchmark bands in `data/benchmarks.json` for inline verdicts inside golden workflows.

## Tech stack

- Next.js 14 (App Router) · TypeScript · Tailwind 3
- XState v5 (workflow engine) · Zod (spec validation)
- `@anthropic-ai/sdk` v0.39 — Claude Haiku 4.5 for routing, Claude Sonnet 4.6 for adapt + triangulate, with prompt caching
- MiniSearch v7 (lexical retrieval)
- vitest (165 tests)

## Run locally

```bash
# 1. Clone and install
git clone git@github.com:rakeshkatti/lennys-framework-copilot.git
cd lennys-framework-copilot
pnpm install

# 2. Anthropic API key in artifacts/lenny-copilot/.env.local
echo "ANTHROPIC_API_KEY=sk-ant-..." > artifacts/lenny-copilot/.env.local

# 3. Dev server
pnpm --filter @workspace/lenny-copilot run dev
# → http://localhost:3000
```

## Credit

Built on top of Lenny Rachitsky's newsletter + podcast archive. Every framework, every adapted-guidance sentence, every artifact citation comes from a Lenny post or episode. The app exists because Lenny's contest asked builders to build with the data — this is one such build. License (non-commercial) is honored throughout.
