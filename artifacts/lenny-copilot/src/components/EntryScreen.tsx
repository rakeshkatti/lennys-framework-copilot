"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const EXAMPLE_COUNT = 5;

/** Fisher-Yates partial shuffle — picks `count` distinct items at random. */
function pickRandom<T>(pool: readonly T[], count: number): T[] {
  const copy = [...pool];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/**
 * Plan 5 — Entry screen redesign per DESIGN.md.
 *
 * Layout: cream/peach page background, single centered white "hero card"
 * (rounded-card-hero, shadow-soft-lg) containing the eyebrow, editorial
 * headline, value sub-line, generous textarea, and orange-pill CTA.
 * Below the card: the chip strip with the pinned-golden chip visually
 * distinguished by an orange ring.
 *
 * Why examples seed in useEffect (not useState initializer): pickRandom
 * uses Math.random which produces different values on SSR vs client
 * hydration. Seeding in useEffect runs only client-side after mount, so
 * server renders no chips, client populates on first paint. No hydration
 * mismatch. Empty dep array preserves the no-re-roll-on-busy-flip property
 * even though AppShell recreates the arrays every render.
 *
 * The pinned-golden chip (index 0) gets a `ring-1 ring-brand-accent`
 * treatment so demo-priority is visually obvious without a separate label.
 */

/** 1 golden chip pinned at index 0, then 4 from the rest. */
function pickExamples(
  golden: readonly string[],
  other: readonly string[],
  total: number,
): string[] {
  const pinned = pickRandom(golden, golden.length > 0 ? 1 : 0);
  const fillers = pickRandom(other, Math.max(0, total - pinned.length));
  if (pinned.length + fillers.length < total) {
    const used = new Set([...pinned, ...fillers]);
    const leftover = [...golden, ...other].filter((q) => !used.has(q));
    fillers.push(
      ...pickRandom(leftover, total - pinned.length - fillers.length),
    );
  }
  return [...pinned, ...fillers];
}

export function EntryScreen({
  goldenQuestions,
  otherQuestions,
  onSubmit,
  busy = false,
}: {
  goldenQuestions: string[];
  otherQuestions: string[];
  onSubmit: (text: string) => void;
  busy?: boolean;
}) {
  const [text, setText] = useState("");
  const [examples, setExamples] = useState<string[]>([]);

  useEffect(() => {
    setExamples(pickExamples(goldenQuestions, otherQuestions, EXAMPLE_COUNT));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
  }

  function reroll() {
    setExamples(pickExamples(goldenQuestions, otherQuestions, EXAMPLE_COUNT));
  }

  const canSubmit = text.trim().length > 0 && !busy;

  return (
    <main className="relative flex min-h-screen flex-col bg-gradient-to-b from-cream to-peach">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/*
           * Script wordmark — DESIGN.md reserves font-script (Caveat +
           * Bradley Hand fallback) for exactly this. Brand-orange to match
           * the Lenny's Data / Lenny's Product Pass wordmarks. text-3xl
           * keeps it visible without dominating the hero card below.
           */}
          <span className="font-script text-3xl font-bold leading-none text-brand sm:text-4xl">
            Lenny&apos;s Newsletter Co-pilot
          </span>
          <Link
            href="/frameworks"
            className="shrink-0 text-xs font-medium text-ink-muted underline-offset-2 transition hover:text-ink-strong hover:underline"
          >
            Browse all 121 →
          </Link>
        </div>

        <div className="mt-3 rounded-card-hero border border-border-warm bg-white p-8 shadow-soft-lg lg:p-10">
          <h1 className="text-3xl font-semibold leading-[1.15] tracking-tight text-ink-strong sm:text-4xl lg:text-[2.75rem]">
            What are you trying to figure out?
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink-body">
            Routes across 121 frameworks from Lenny&apos;s newsletter &amp;
            podcast archive — pick the right one for a real decision and walk
            through it in three minutes.
          </p>

          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              submit(text);
            }}
          >
            <label htmlFor="decision" className="sr-only">
              Describe the decision
            </label>
            <textarea
              id="decision"
              rows={5}
              value={text}
              disabled={busy}
              placeholder="e.g. We have 40 product ideas and 6 engineers next quarter — how do I rank them?"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit(text);
                }
              }}
              className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-base leading-relaxed text-ink-strong shadow-sm transition placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-xs text-ink-subtle">
                {busy
                  ? "Finding the right framework…"
                  : "Press ⌘/Ctrl + Enter to route"}
              </p>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-chip bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busy ? "Finding…" : "Find my framework →"}
              </button>
            </div>
          </form>
        </div>

        {examples.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Or start from an example
              </p>
              <button
                type="button"
                onClick={reroll}
                disabled={busy}
                title="Show 5 different example questions"
                aria-label="Show 5 different example questions"
                className="inline-flex items-center gap-1 rounded-chip border border-border-warm bg-white px-2.5 py-1 text-xs font-medium text-ink-muted shadow-sm transition hover:border-ink-subtle hover:text-ink-strong focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true">↻</span> Shuffle
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {examples.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => setText(q)}
                  className="rounded-chip border border-border-warm bg-white px-3 py-1.5 text-left text-xs text-ink-body shadow-sm transition hover:border-ink-subtle hover:text-ink-strong hover:shadow focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-subtle">
              Click a chip to drop it in the box — edit, then hit Find.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
