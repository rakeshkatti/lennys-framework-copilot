"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const EXAMPLE_COUNT = 5;

/** Pick `count` distinct items from `pool` at random (Fisher-Yates partial shuffle). */
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
 * Entry screen: free-text decision + 5 example chips + recycle button.
 *
 * Why chips set text instead of submitting:
 *   Clicking an example used to call `onSubmit` directly, which flipped `busy`
 *   in the parent and re-rendered the chip strip — so the user lost sight of
 *   what they'd just picked. Now a chip click only populates the textarea; the
 *   user confirms with "Find my framework". Same single source of truth, no
 *   disappearing chips.
 *
 * Why examples are seeded in `useEffect` (not `useState` initializer):
 *   `pickRandom` calls `Math.random()`, which returns different values on the
 *   server (SSR) and the client (hydration) — React then throws a hydration
 *   mismatch error. Seeding in `useEffect` runs only on the client after
 *   mount, so the server renders no chips and the client populates them on
 *   first paint. Same end-state as a `useState` initializer, no mismatch.
 *
 *   This also fixes the prior re-roll bug: the parent `AppShell` does
 *   `questionBank.map(...)` on every render, yielding a fresh array
 *   reference. The effect's empty dep array means the parent's re-renders
 *   don't trigger another roll — examples only change when the user clicks
 *   Shuffle.
 */
export function EntryScreen({
  exampleQuestions,
  onSubmit,
  busy = false,
}: {
  exampleQuestions: string[];
  onSubmit: (text: string) => void;
  busy?: boolean;
}) {
  const [text, setText] = useState("");
  const [examples, setExamples] = useState<string[]>([]);

  // Seed once on mount — see the JSDoc above for why this isn't a `useState`
  // initializer. Intentionally an empty dep array; the parent re-creates
  // `exampleQuestions` every render, but we don't want that to re-roll.
  useEffect(() => {
    setExamples(pickRandom(exampleQuestions, EXAMPLE_COUNT));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
  }

  function reroll() {
    setExamples(pickRandom(exampleQuestions, EXAMPLE_COUNT));
  }

  const canSubmit = text.trim().length > 0 && !busy;

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 lg:px-10">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lenny&apos;s Framework Copilot
          </p>
          <Link
            href="/frameworks"
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            Browse all 121 frameworks →
          </Link>
        </div>

        <h1 className="mt-2 text-4xl font-semibold leading-tight text-slate-900 lg:text-5xl">
          What are you trying to figure out?
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Routes across 121 frameworks from Lenny&apos;s newsletter &amp;
          podcast.
        </p>

        <form
          className="mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            submit(text);
          }}
        >
          <textarea
            rows={4}
            value={text}
            disabled={busy}
            placeholder="e.g. Our activation has been flat at 18% for three months — how do I fix it?"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit(text);
              }
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
          />

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              {busy
                ? "Finding the right framework…"
                : "Press ⌘/Ctrl + Enter to route."}
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {busy ? "Finding the right framework…" : "Find my framework →"}
            </button>
          </div>
        </form>

        {examples.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Or start from an example
              </p>
              <button
                type="button"
                onClick={reroll}
                disabled={busy}
                title="Show 5 different example questions"
                aria-label="Show 5 different example questions"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 shadow-sm hover:border-slate-400 hover:text-slate-700 hover:shadow focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-700 shadow-sm transition hover:border-slate-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Clicking a chip drops the question into the box — edit it, then hit Find.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
