"use client";

import { useCallback, useState } from "react";
import type { CatalogEntry, QuestionBankEntry } from "@lib/catalog";
import type { RouteResult } from "@lib/route/router";
import type { SourcesIndex } from "@lib/sources";
import type { Benchmarks } from "@lib/benchmark";
import type { FrameworkSpec } from "@lib/spec";
import { EntryScreen } from "./EntryScreen";
import { RoutingCard } from "./RoutingCard";
import { GuidanceView } from "./GuidanceView";
import { WorkflowRunner } from "./WorkflowRunner";

type Mode = "entry" | "routing" | "workflow" | "guidance";

/**
 * Top-level client mode machine. Drives the flow:
 *   entry → POST /api/route → routing → pick a framework →
 *   workflow (GET /api/spec/[id] + WorkflowRunner) or guidance (GuidanceView).
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
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null);
  const [spec, setSpec] = useState<FrameworkSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exampleQuestions = questionBank.map((q) => q.question);

  const backToEntry = useCallback(() => {
    setMode("entry");
    setRouteResult(null);
    setSelectedEntry(null);
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

      if (entry.tier === "guidance") {
        setSelectedEntry(entry);
        setMode("guidance");
        return;
      }

      // workflow tier: load the golden framework's spec.
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/spec/${entry.id}`);
        if (res.status === 404) {
          // A workflow-tier framework whose interactive spec hasn't been
          // authored yet (ships in a later plan). Degrade gracefully to the
          // read-only guidance view instead of erroring.
          setSelectedEntry(entry);
          setMode("guidance");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const loadedSpec = (await res.json()) as FrameworkSpec;
        setSpec(loadedSpec);
        setSelectedEntry(entry);
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
        onExit={backToEntry}
      />
    );
  }

  if (mode === "guidance" && selectedEntry) {
    return (
      <GuidanceView
        entry={selectedEntry}
        sourcesIndex={sourcesIndex}
        onReset={backToEntry}
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
        exampleQuestions={exampleQuestions}
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
