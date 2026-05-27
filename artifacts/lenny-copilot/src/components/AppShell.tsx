"use client";

import { useCallback, useState } from "react";
import type { CatalogEntry, QuestionBankEntry } from "@lib/catalog";
import type { RouteResult } from "@lib/route/router";
import type { SourcesIndex } from "@lib/sources";
import type { Benchmarks } from "@lib/benchmark";
import { clearSnapshot } from "@lib/engine";
import type { FrameworkSpec } from "@lib/spec";
import { EntryScreen } from "./EntryScreen";
import { RoutingCard } from "./RoutingCard";
import { WorkflowRunner } from "./WorkflowRunner";

type Mode = "entry" | "routing" | "workflow";

/**
 * Top-level client mode machine. Drives the flow:
 *   entry → POST /api/route → routing → pick a framework →
 *   workflow (GET /api/spec/[id] + WorkflowRunner).
 */
export function AppShell({
  catalog,
  questionBank,
  sourcesIndex,
  benchmarks,
}: {
  catalog: CatalogEntry[];
  questionBank: QuestionBankEntry[];
  sourcesIndex: SourcesIndex;
  benchmarks: Benchmarks;
}) {
  const [mode, setMode] = useState<Mode>("entry");
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [spec, setSpec] = useState<FrameworkSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Partition example questions by tier so EntryScreen can pin a
  // hand-authored ("golden") workflow as chip #1 every render. Demo benefit:
  // the first chip a user clicks always lands on a deep, structured workflow
  // (DRICE / Strategy Blocks / B2B PMF / Stalled-Growth), not a synthesized
  // long-tail one. The other 4 slots come from the rest of the bank.
  const goldenIds = new Set(
    catalog.filter((e) => e.tier === "workflow").map((e) => e.id),
  );
  const goldenQuestions = questionBank
    .filter((q) => goldenIds.has(q.framework_id))
    .map((q) => q.question);
  const otherQuestions = questionBank
    .filter((q) => !goldenIds.has(q.framework_id))
    .map((q) => q.question);

  const backToEntry = useCallback(() => {
    setMode("entry");
    setRouteResult(null);
    setSpec(null);
    setBusy(false);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async (text: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = (await res.json()) as RouteResult;
      setRouteResult(result);
      setMode("routing");
    } catch {
      setError(
        "We couldn't route that just now. Please check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const handleStart = useCallback(
    async (frameworkId: string) => {
      const entry = catalog.find((e) => e.id === frameworkId);
      if (!entry) {
        setError("That framework couldn't be found in the catalog.");
        return;
      }

      // Every framework — golden workflow or synthesized from a guidance-tier
      // catalog entry — loads through /api/spec/[id] and runs in WorkflowRunner.
      // loadSpec falls back to synthesizeSpec for non-golden ids.
      // Wipe any saved snapshot first so Start always begins a fresh run.
      // Otherwise Engine.load() auto-resumes from localStorage and the user
      // lands back on a previously-completed artifact instead of step 1.
      if (typeof window !== "undefined") {
        clearSnapshot(window.localStorage, entry.id);
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/spec/${entry.id}`);
        if (res.status === 404) {
          // After Plan 4 this should never happen — loadSpec synthesizes
          // from the catalog for any non-golden id. Surface as an error
          // rather than silently falling back to a dead-end view.
          setError(
            `We couldn't load "${entry.name}". The catalog and spec are out of sync.`,
          );
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const loadedSpec = (await res.json()) as FrameworkSpec;
        setSpec(loadedSpec);
        setMode("workflow");
      } catch {
        setError(
          "We couldn't load that framework's workflow. Please try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [catalog],
  );

  if (mode === "workflow" && spec) {
    return (
      <WorkflowRunner
        spec={spec}
        sourcesIndex={sourcesIndex}
        benchmarks={benchmarks}
        catalog={catalog}
        // `alternatives` is router-ranked, best first; we forward it so the
        // runner can pick a deliberately-different challenger for triangulation.
        // When a workflow is opened without a prior route (edge case), pass [].
        routeAlternatives={routeResult?.alternatives ?? []}
        onExit={backToEntry}
      />
    );
  }

  if (mode === "routing" && routeResult) {
    return (
      <div className="relative">
        <RoutingCard
          result={routeResult}
          catalog={catalog}
          sourcesIndex={sourcesIndex}
          onStart={handleStart}
          onReset={backToEntry}
        />
        {busy && (
          <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-50/80 text-sm font-medium text-slate-600">
            Loading the workflow…
          </div>
        )}
        {error && (
          <div className="fixed inset-x-0 bottom-6 z-20 mx-auto w-fit max-w-md rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 shadow">
            {error}
          </div>
        )}
      </div>
    );
  }

  // mode === "entry" (default / fallthrough)
  return (
    <div>
      <EntryScreen
        goldenQuestions={goldenQuestions}
        otherQuestions={otherQuestions}
        onSubmit={handleSubmit}
        busy={busy}
      />
      {error && (
        <div className="fixed inset-x-0 bottom-6 z-20 mx-auto w-fit max-w-md rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 shadow">
          {error}
        </div>
      )}
    </div>
  );
}
