"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { FrameworkSpec, Step } from "@lib/spec";
import type { CatalogEntry } from "@lib/catalog";
import type { SourcesIndex } from "@lib/sources";
import type { Benchmarks, Verdict } from "@lib/benchmark";
import { computeVerdictFrom } from "@lib/benchmark";
import {
  Engine,
  validateStepInput,
  InputValidationError,
  ARTIFACT_CURSOR,
} from "@lib/engine";
import { pickChallenger, type TriangulationResult } from "@lib/triangulate";
import { renderArtifactMarkdown } from "@lib/artifact/render";
import { StepInput, initialDraftFor } from "./StepInput";
import { AdaptedGuidance } from "./AdaptedGuidance";
import { ArtifactPane } from "./ArtifactPane";
import { ArtifactExport } from "./ArtifactExport";

type Snapshot = {
  cursor: string;
  inputs: Record<string, unknown>;
  canGoBack: boolean;
};

function snapshotOf(engine: Engine): Snapshot {
  return {
    cursor: engine.cursor(),
    inputs: engine.inputs(),
    canGoBack: engine.canGoBack(),
  };
}

export function WorkflowRunner({
  spec,
  onExit,
  sourcesIndex,
  benchmarks,
  catalog,
  routeAlternatives,
}: {
  spec: FrameworkSpec;
  onExit?: () => void;
  /** When provided, guidance + artifact source files resolve to article links. */
  sourcesIndex?: SourcesIndex;
  /** When provided, steps with a `benchmark_hook` render an inline verdict
   *  comparing the user's draft value to the catalog band for the chosen segment. */
  benchmarks?: Benchmarks;
  /** Full catalog — threaded so the Done view can pick a challenger client-side
   *  without an extra fetch. (`loadCatalog` is server-only.) Optional for
   *  back-compat: when absent, triangulation is silently skipped. */
  catalog?: CatalogEntry[];
  /** Router-ranked alternative framework ids from the route that opened this
   *  workflow. Best first. Empty when the workflow was opened without a route. */
  routeAlternatives?: string[];
}) {
  const engineRef = useRef<Engine | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<unknown>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storage =
      typeof window !== "undefined" ? window.localStorage : undefined;
    const { engine, notice: loadNotice } = Engine.load(spec, { storage });
    engineRef.current = engine;
    setSnap(snapshotOf(engine));
    setNotice(loadNotice);
  }, [spec]);

  const currentStep: Step | null = useMemo(() => {
    if (!snap) return null;
    if (snap.cursor === ARTIFACT_CURSOR) return null;
    return spec.steps.find((s) => s.id === snap.cursor) ?? null;
  }, [snap, spec]);

  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!currentStep || !snap) {
      setDraft(undefined);
      return;
    }
    setDraft(initialDraftFor(currentStep, snap.inputs));
    setError(null);
    setSubmitAttempted(false);
  }, [currentStep, snap?.inputs]);

  const validation = useMemo(() => {
    if (!currentStep || !snap || draft === undefined)
      return { ok: false as const, error: null };
    try {
      validateStepInput(currentStep, draft, snap.inputs);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof InputValidationError) {
        return { ok: false as const, error: e.message };
      }
      return { ok: false as const, error: (e as Error).message };
    }
  }, [currentStep, draft, snap]);

  const handleNext = useCallback(() => {
    if (!engineRef.current || !currentStep) return;
    setSubmitAttempted(true);
    try {
      engineRef.current.advance(draft);
      setSnap(snapshotOf(engineRef.current));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [draft, currentStep]);

  const handleBack = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.back();
    setSnap(snapshotOf(engineRef.current));
    setError(null);
  }, []);

  const handleReset = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.reset();
    setSnap(snapshotOf(engineRef.current));
    setError(null);
    setNotice(null);
  }, []);

  if (!snap) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cream to-peach text-ink-muted">
        Loading…
      </main>
    );
  }

  const isDone = snap.cursor === ARTIFACT_CURSOR;
  const stepIndex = currentStep
    ? spec.steps.findIndex((s) => s.id === currentStep.id) + 1
    : spec.steps.length;

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-cream to-peach">
      <header className="sticky top-0 z-20 border-b border-border-warm bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            {onExit && (
              <button
                onClick={onExit}
                className="text-xs font-medium text-ink-muted underline-offset-2 transition hover:text-ink-strong hover:underline"
              >
                ← Exit
              </button>
            )}
            {onExit && <span className="text-ink-subtle">·</span>}
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {spec.name}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 sm:flex">
              {spec.steps.map((s, i) => {
                const isCurrent = !isDone && s.id === currentStep?.id;
                const isComplete = isDone || i < stepIndex - 1;
                return (
                  <span
                    key={s.id}
                    aria-label={`Step ${i + 1}: ${s.title}`}
                    className={
                      isCurrent
                        ? "h-2 w-6 rounded-full bg-brand transition"
                        : isComplete
                        ? "h-2 w-2 rounded-full bg-brand/60 transition"
                        : "h-2 w-2 rounded-full bg-border-warm transition"
                    }
                  />
                );
              })}
            </div>
            <button
              onClick={handleReset}
              className="rounded-chip border border-border-warm bg-white px-3 py-1.5 text-xs font-medium text-ink-body transition hover:border-ink-subtle hover:text-ink-strong"
            >
              Restart
            </button>
          </div>
        </div>
      </header>

      {notice && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-800 lg:px-10">
          {notice}{" "}
          <button
            onClick={() => setNotice(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {isDone ? (
        <DoneView
          spec={spec}
          inputs={snap.inputs}
          onBack={handleBack}
          canGoBack={snap.canGoBack}
          onExit={onExit}
          sourcesIndex={sourcesIndex}
          catalog={catalog}
          routeAlternatives={routeAlternatives ?? []}
        />
      ) : currentStep ? (
        <StepView
          step={currentStep}
          draft={draft}
          onChange={setDraft}
          allInputs={snap.inputs}
          spec={spec}
          sourcesIndex={sourcesIndex}
          benchmarks={benchmarks}
          error={error}
          validationError={
            submitAttempted && !validation.ok ? validation.error : null
          }
          canGoBack={snap.canGoBack}
          canGoNext={validation.ok}
          onBack={handleBack}
          onNext={handleNext}
          stepIndex={stepIndex}
          totalSteps={spec.steps.length}
        />
      ) : null}
    </main>
  );
}

function StepView({
  step,
  draft,
  onChange,
  allInputs,
  spec,
  sourcesIndex,
  benchmarks,
  error,
  validationError,
  canGoBack,
  canGoNext,
  onBack,
  onNext,
  stepIndex,
  totalSteps,
}: {
  step: Step;
  draft: unknown;
  onChange: (v: unknown) => void;
  allInputs: Record<string, unknown>;
  spec: FrameworkSpec;
  sourcesIndex?: SourcesIndex;
  benchmarks?: Benchmarks;
  error: string | null;
  validationError: string | null;
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  stepIndex: number;
  totalSteps: number;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8 lg:py-12">
      <div className="grid gap-8 lg:grid-cols-5 lg:gap-10">
        {/* LEFT: prompt + input + verdict + examples + nav (~60%) */}
        <div className="lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Step {stepIndex} of {totalSteps}
          </p>
          <h2 className="mt-1 text-2xl font-semibold leading-tight text-ink-strong sm:text-3xl">
            {step.title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink-body">
            {step.prompt}
          </p>

          <div className="mt-6">
            <StepInput
              step={step}
              draft={draft}
              allInputs={allInputs}
              spec={spec}
              onChange={onChange}
            />
          </div>

          <BenchmarkVerdict
            step={step}
            draft={draft}
            allInputs={allInputs}
            benchmarks={benchmarks}
          />

          {step.examples && step.examples.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {step.examples.map((ex, i) => (
                <details
                  key={i}
                  className="group rounded-chip border border-border-warm bg-white px-3 py-1 text-xs text-ink-body open:rounded-card open:px-4 open:py-3 open:shadow-soft"
                >
                  <summary className="cursor-pointer font-medium text-ink-body">
                    {ex.company}
                  </summary>
                  <p className="mt-2 leading-relaxed text-ink-body">{ex.text}</p>
                </details>
              ))}
            </div>
          )}

          {(error || validationError) && (
            <p className="mt-4 text-sm text-rose-700">
              {error || validationError}
            </p>
          )}

          <div className="mt-8 flex items-center justify-between gap-4">
            <button
              onClick={onBack}
              disabled={!canGoBack}
              className="rounded-chip border border-border-warm bg-white px-4 py-2 text-sm font-medium text-ink-body shadow-sm transition hover:border-ink-subtle hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Back
            </button>
            <button
              onClick={onNext}
              disabled={!canGoNext}
              className="rounded-chip bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Continue →
            </button>
          </div>
        </div>

        {/* RIGHT (~40%): source-grounded guidance for THIS step, then a
            full-workflow progress overview below it so the user can see
            every step's status + their filled-in answers without leaving
            the runner. Collapses to a single column below the input on
            mobile. AdaptedGuidance is NOT sticky — it scrolls with the
            ArtifactPane so the user can see both panels naturally on
            longer workflows. */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            <AdaptedGuidance
              spec={spec}
              step={step}
              inputsSoFar={allInputs}
              sourcesIndex={sourcesIndex}
              // Only wire chip-click → textarea fill for text inputs. For score
              // grids / multi-choice steps, the LLM's suggested_options (if any)
              // don't apply to the structured input UI.
              onSuggestionSelect={
                step.input.type === "text"
                  ? (text) => onChange({ value: text })
                  : undefined
              }
            />
            <ArtifactPane spec={spec} cursor={step.id} inputs={allInputs} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Resolve a dotted path like "segment.value" against the engine's collected
 * inputs. Returns `undefined` if any segment is missing — callers MUST handle
 * that gracefully (no verdict render).
 */
function resolveSegmentPath(
  path: string,
  allInputs: Record<string, unknown>,
): unknown {
  const parts = path.split(".");
  let cur: unknown = allInputs;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function BenchmarkVerdict({
  step,
  draft,
  allInputs,
  benchmarks,
}: {
  step: Step;
  draft: unknown;
  allInputs: Record<string, unknown>;
  benchmarks?: Benchmarks;
}) {
  const hook = step.benchmark_hook;
  // Bail conditions — render nothing.
  if (!hook || !benchmarks) return null;

  const segmentRaw = resolveSegmentPath(hook.segment_from, allInputs);
  if (typeof segmentRaw !== "string" || segmentRaw.length === 0) return null;

  const valueRaw = (draft as { value?: unknown } | undefined)?.value;
  if (typeof valueRaw !== "number" || !Number.isFinite(valueRaw)) return null;

  let verdict: Verdict | null = null;
  try {
    verdict = computeVerdictFrom(benchmarks, hook.metric, segmentRaw, valueRaw);
  } catch {
    return null;
  }
  if (!verdict) return null;

  const bandStyles: Record<Verdict["band"], string> = {
    below: "border-rose-200 bg-rose-50 text-rose-800",
    good: "border-slate-200 bg-slate-50 text-slate-800",
    great: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  const bandPill: Record<Verdict["band"], { label: string; cls: string }> = {
    below: { label: "Below", cls: "bg-rose-100 text-rose-800" },
    good: { label: "Good", cls: "bg-slate-200 text-slate-800" },
    great: { label: "Great", cls: "bg-emerald-100 text-emerald-800" },
  };
  const pill = bandPill[verdict.band];

  return (
    <div
      className={`mt-3 flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${bandStyles[verdict.band]}`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${pill.cls}`}
      >
        {pill.label}
      </span>
      <span className="leading-snug">{verdict.label}</span>
    </div>
  );
}

function DoneView({
  spec,
  inputs,
  onBack,
  canGoBack,
  onExit,
  sourcesIndex,
  catalog,
  routeAlternatives,
}: {
  spec: FrameworkSpec;
  inputs: Record<string, unknown>;
  onBack: () => void;
  canGoBack: boolean;
  onExit?: () => void;
  sourcesIndex?: SourcesIndex;
  catalog?: CatalogEntry[];
  routeAlternatives: string[];
}) {
  // The user's filled-in primary artifact — rendered identically to today.
  const completedStepIds = useMemo(
    () =>
      new Set(Object.keys(inputs).filter((k) => inputs[k] !== undefined)),
    [inputs],
  );
  const primaryArtifactMarkdown = useMemo(
    () =>
      renderArtifactMarkdown(
        spec,
        inputs,
        { completedStepIds },
        sourcesIndex,
      ),
    [spec, inputs, completedStepIds, sourcesIndex],
  );

  // Pick the challenger client-side. `loadCatalog` is server-only, so we rely
  // on the `catalog` prop threaded from AppShell.
  const challengerEntry = useMemo<CatalogEntry | null>(() => {
    if (!catalog) return null;
    const id = pickChallenger(spec.id, routeAlternatives, catalog);
    if (!id) return null;
    return catalog.find((e) => e.id === id) ?? null;
  }, [catalog, spec.id, routeAlternatives]);

  // Triangulation lifecycle: loading | result | error. Fires once per
  // mount of the Done view (when entering the artifact state).
  const [triState, setTriState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "result"; result: TriangulationResult }
    | { kind: "error"; reason: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (!challengerEntry) {
      setTriState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setTriState({ kind: "loading" });
    (async () => {
      try {
        const res = await fetch("/api/triangulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primaryFrameworkId: spec.id,
            challengerFrameworkId: challengerEntry.id,
            primaryArtifactMarkdown,
            userInputs: inputs,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = (await res.json()) as TriangulationResult;
        if (!cancelled) setTriState({ kind: "result", result });
      } catch (e) {
        if (!cancelled) {
          setTriState({
            kind: "error",
            reason: e instanceof Error ? e.message : String(e),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-run only when the spec or challenger identity changes. inputs +
    // markdown are stable for a completed workflow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id, challengerEntry?.id]);

  // The triangulation payload threaded into ArtifactExport's markdown when
  // available — only when the LLM call succeeded (not a fallback).
  const exportTriangulation = useMemo(() => {
    if (triState.kind !== "result") return undefined;
    if (triState.result.fallback) return undefined;
    return {
      challengerName: triState.result.challenger_name,
      challengerSourceFile: challengerEntry?.source?.[0],
      counterargument: triState.result.counterargument,
      what_would_change_my_mind: triState.result.what_would_change_my_mind,
    };
  }, [triState, challengerEntry]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 lg:px-8 lg:py-12">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Workflow complete
        </p>
      </div>
      <h2 className="mt-1 text-2xl font-semibold leading-tight text-ink-strong sm:text-3xl">
        {spec.name}
      </h2>
      <p className="mt-3 text-base leading-relaxed text-ink-body">
        Your recommended path, with a deliberate counterargument from a
        different framework and what would change your mind, follow below.
        Copy as Markdown or download to share.
      </p>

      {/*
       * Triangulation loading banner — rendered ABOVE the artifact so the
       * user sees the progress signal immediately when the workflow
       * completes (no scrolling needed). Disappears the moment a
       * successful non-fallback result arrives; ArtifactExport then
       * renders the actual Counter-perspective aside below the artifact
       * at its natural position. The two cards never co-exist.
       */}
      <TriangulationStatus
        triState={triState}
        challengerName={challengerEntry?.name ?? null}
      />

      {/*
       * Plan 5 — single rendered view of the final artifact + triangulation.
       * ArtifactExport renders the primary artifact via react-markdown with
       * the Geist scale and splits the triangulation into its own violet
       * Counter-perspective aside (only when triangulation succeeded
       * non-fallback). The TriangulationStatus banner above handles every
       * other state (loading / error / fallback).
       */}
      <ArtifactExport
        spec={spec}
        inputs={inputs}
        sourcesIndex={sourcesIndex}
        triangulation={exportTriangulation}
      />

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className="rounded-chip border border-border-warm bg-white px-4 py-2 text-sm font-medium text-ink-body shadow-sm transition hover:border-ink-subtle hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← Back to last step
        </button>
        {onExit && (
          <button
            onClick={onExit}
            className="rounded-chip bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
          >
            Back to frameworks
          </button>
        )}
      </div>
    </div>
  );
}

/** Generic labelled artifact block — used for all three Done-view sections. */
function ArtifactBlock({
  label,
  subtitle,
  accent,
  children,
}: {
  label: string;
  subtitle?: React.ReactNode;
  accent: "emerald" | "amber" | "indigo";
  children: React.ReactNode;
}) {
  const accentCls = {
    emerald: "border-emerald-200",
    amber: "border-amber-200",
    indigo: "border-indigo-200",
  }[accent];
  const labelCls = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    indigo: "text-indigo-700",
  }[accent];
  return (
    <section className={`mt-6 rounded-card border ${accentCls} bg-white shadow-soft`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-border-warm px-4 py-3">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}
        >
          {label}
        </p>
        {subtitle && (
          <p className="text-xs text-ink-muted">{subtitle}</p>
        )}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

/** Resolve a challenger source file to a clickable chip via the sources index. */
function ChallengerSourceChip({
  challengerEntry,
  sourcesIndex,
}: {
  challengerEntry: CatalogEntry;
  sourcesIndex?: SourcesIndex;
}) {
  const file = challengerEntry.source?.[0];
  const entry = file && sourcesIndex ? sourcesIndex[file] : null;
  if (entry?.post_url) {
    return (
      <a
        href={entry.post_url}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
      >
        Source: {entry.title} ↗
      </a>
    );
  }
  return (
    <span className="rounded-full border border-border-warm bg-white px-2 py-0.5 text-[11px] font-medium text-ink-muted">
      {file ?? "Source"}
    </span>
  );
}

/** The challenger half of the triangulated artifact — blocks 2 + 3. Handles
 *  loading, success, and graceful failure (LLM error or transport error). */
function ChallengerBlocks({
  triState,
  challengerEntry,
  sourcesIndex,
}: {
  triState:
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "result"; result: TriangulationResult }
    | { kind: "error"; reason: string };
  challengerEntry: CatalogEntry | null;
  sourcesIndex?: SourcesIndex;
}) {
  // No catalog / no contrasting framework at all — show a quiet note in
  // place of the challenger half and move on. Should be essentially never.
  if (!challengerEntry) {
    return (
      <ArtifactBlock label="Best counterargument" accent="amber">
        <p className="text-sm text-ink-body">
          No contrasting framework available to challenge this decision.
        </p>
      </ArtifactBlock>
    );
  }

  const challengerSubtitle = (
    <span className="flex items-center gap-2">
      <span>via {challengerEntry.name}</span>
      <ChallengerSourceChip
        challengerEntry={challengerEntry}
        sourcesIndex={sourcesIndex}
      />
    </span>
  );

  if (triState.kind === "loading" || triState.kind === "idle") {
    return (
      <>
        <ArtifactBlock
          label="Best counterargument"
          accent="amber"
          subtitle={challengerSubtitle}
        >
          <p className="flex items-center gap-2 text-sm text-ink-body">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            Running the challenger…
          </p>
        </ArtifactBlock>
        <ArtifactBlock label="What would change my mind" accent="indigo">
          <p className="text-sm text-ink-muted">Pending the challenger.</p>
        </ArtifactBlock>
      </>
    );
  }

  if (triState.kind === "error" || triState.result.fallback) {
    const reason =
      triState.kind === "error"
        ? triState.reason
        : (triState.result.reason ?? "the challenger model didn't respond");
    return (
      <ArtifactBlock
        label="Best counterargument"
        accent="amber"
        subtitle={challengerSubtitle}
      >
        <p className="text-sm text-ink-body">
          Couldn&apos;t load the challenger ({reason}). The recommended path
          above is unchanged — try refreshing to retry.
        </p>
      </ArtifactBlock>
    );
  }

  // Happy path: render blocks 2 + 3.
  const { counterargument, what_would_change_my_mind } = triState.result;
  return (
    <>
      <ArtifactBlock
        label="Best counterargument"
        accent="amber"
        subtitle={challengerSubtitle}
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-body">
          {counterargument}
        </div>
      </ArtifactBlock>
      <ArtifactBlock label="What would change my mind" accent="indigo">
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-body">
          {what_would_change_my_mind}
        </div>
      </ArtifactBlock>
    </>
  );
}

/**
 * Triangulation status placeholder for the Done view.
 *
 * Visible whenever the violet Counter-perspective aside inside ArtifactExport
 * is NOT shown — i.e. while the triangulation fetch is in flight, when it
 * errored, when it fell back, or when no challenger was picked. Mirrors the
 * violet treatment of the eventual aside so the loading→success transition
 * is visually continuous (no layout jump, no surprise where the block lands).
 *
 * Silent fetch was a real UX problem: the user reached the final artifact,
 * saw no counter-perspective, assumed the workflow was done, and left
 * before the Sonnet pass returned (~5-15 seconds depending on network).
 * Now there's always a visible status.
 */
function TriangulationStatus({
  triState,
  challengerName,
}: {
  triState:
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "result"; result: TriangulationResult }
    | { kind: "error"; reason: string };
  challengerName: string | null;
}) {
  // Successful non-fallback result is rendered by ArtifactExport's
  // Counter-perspective aside; we render nothing here.
  if (triState.kind === "result" && !triState.result.fallback) return null;

  // No challenger could be picked (e.g. tiny catalog, every alternative is
  // a near-duplicate of the primary). Don't surface anything — silent skip
  // is the right call when there's literally no counter-perspective to
  // generate.
  if (triState.kind === "idle" && !challengerName) return null;

  const baseAside =
    "mt-6 rounded-card border-l-4 border-triangulation bg-triangulation-soft/40 px-6 py-6 sm:px-8";
  const eyebrow =
    "text-xs font-semibold uppercase tracking-wide text-triangulation";

  if (triState.kind === "loading" || triState.kind === "idle") {
    return (
      <aside className={baseAside} aria-live="polite">
        <p className={eyebrow}>Counter-perspective</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-body">
          Generating a deliberate counterargument
          {challengerName ? (
            <>
              {" "}from{" "}
              <span className="font-semibold text-ink-strong">
                {challengerName}
              </span>
            </>
          ) : null}
          … this usually takes 5–15 seconds. Stay on the page.
        </p>
        {/*
         * Indeterminate progress bar — 25%-wide filled segment slides
         * across the track L→R, exits the right edge, snaps back. The
         * `overflow-hidden` clips the bar at the track edges; the
         * keyframe (translate -100% → 400%) is defined in
         * tailwind.config.ts. Unambiguous 'we're loading' motion; the
         * pre-existing animate-pulse dot was too subtle to read as
         * progress.
         */}
        <div
          className="mt-4 h-1 w-full overflow-hidden rounded-full bg-triangulation/15"
          aria-hidden
        >
          <div className="h-full w-1/4 rounded-full bg-triangulation animate-indeterminate" />
        </div>
      </aside>
    );
  }

  // error OR fallback result
  const reason =
    triState.kind === "error"
      ? triState.reason
      : (triState.result.reason ?? "the challenger model didn't respond");

  return (
    <aside className={baseAside}>
      <p className={eyebrow}>Counter-perspective</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-body">
        We couldn&apos;t generate the counter-perspective this time
        {challengerName ? (
          <>
            {" "}(challenger:{" "}
            <span className="font-semibold text-ink-strong">
              {challengerName}
            </span>
            )
          </>
        ) : null}
        . The recommended path above is still your artifact — the
        counter-perspective is a complement, not a gate.{" "}
        <span className="text-ink-muted">({reason})</span>
      </p>
    </aside>
  );
}
