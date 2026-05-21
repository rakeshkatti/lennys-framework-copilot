"use client";

import { useEffect, useState } from "react";
import type { FrameworkSpec } from "@lib/spec";
import { storageKeyFor } from "@lib/engine/persist";

export function EntryScreen({
  spec,
  onStart,
}: {
  spec: FrameworkSpec;
  onStart: () => void;
}) {
  const [hasProgress, setHasProgress] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = storageKeyFor(spec.id);
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        setHasProgress(false);
        return;
      }
      const parsed = JSON.parse(raw) as { inputs?: Record<string, unknown> };
      const count = parsed.inputs ? Object.keys(parsed.inputs).length : 0;
      setHasProgress(count > 0);
    } catch {
      // Corrupt persisted value — drop it so we don't keep re-parsing it.
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
      setHasProgress(false);
    }
  }, [spec.id]);

  function handleReset() {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Clear your saved progress for this framework? This can't be undone.",
    );
    if (!ok) return;
    window.localStorage.removeItem(storageKeyFor(spec.id));
    setHasProgress(false);
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Lenny&apos;s Framework Copilot
        </p>
        <h1 className="mt-2 text-4xl font-semibold leading-tight text-slate-900 lg:text-5xl">
          Run a real PM framework, end to end.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
          Pick a framework, answer a handful of grounded questions, and walk
          away with a cited artifact you can paste into a doc or share with
          your team.
        </p>

        <button
          onClick={onStart}
          className="group mt-10 block w-full rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-slate-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
        >
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                Prioritization
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                Prioritize my roadmap → DRICE
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {spec.summary}
              </p>
              <p className="mt-4 text-xs text-slate-500">
                {spec.steps.length} steps · cited at every turn · exports as
                Markdown
              </p>
            </div>
            <span
              aria-hidden
              className="mt-1 shrink-0 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition group-hover:bg-slate-800"
            >
              {hasProgress ? "Resume →" : "Start →"}
            </span>
          </div>
        </button>

        {hasProgress && (
          <p className="mt-3 text-xs text-slate-500">
            We saved your progress on this device.{" "}
            <button
              onClick={handleReset}
              className="font-medium text-slate-700 underline hover:no-underline"
            >
              Start over
            </button>
            .
          </p>
        )}

        <p className="mt-12 text-xs text-slate-400">
          More frameworks coming soon.
        </p>
      </div>
    </main>
  );
}
