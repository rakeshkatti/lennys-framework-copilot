"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { FrameworkSpec, Step } from "@lib/spec";
import type { SourcesIndex } from "@lib/sources";
import {
  Engine,
  validateStepInput,
  InputValidationError,
  ARTIFACT_CURSOR,
} from "@lib/engine";
import { StepInput, initialDraftFor } from "./StepInput";
import { ArtifactPane } from "./ArtifactPane";
import { AdaptedGuidance } from "./AdaptedGuidance";
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
}: {
  spec: FrameworkSpec;
  onExit?: () => void;
  /** When provided, guidance + artifact source files resolve to article links. */
  sourcesIndex?: SourcesIndex;
}) {
  const engineRef = useRef<Engine | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<unknown>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArtifact, setShowArtifact] = useState(false);

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
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </main>
    );
  }

  const isDone = snap.cursor === ARTIFACT_CURSOR;

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4 lg:px-10">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
          <div>
            {onExit && (
              <button
                onClick={onExit}
                className="mb-1 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                ← Frameworks
              </button>
            )}
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {spec.category}
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              {spec.name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {spec.summary}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArtifact((v) => !v)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 lg:hidden"
            >
              {showArtifact ? "Hide artifact" : "Show artifact"}
            </button>
            <button
              onClick={handleReset}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
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

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 lg:grid-cols-[1fr_420px]">
        <section
          className={`${
            showArtifact ? "hidden lg:block" : "block"
          } border-r border-slate-200 bg-white px-6 py-8 lg:px-10 lg:py-12`}
        >
          {isDone ? (
            <DoneView
              spec={spec}
              inputs={snap.inputs}
              onBack={handleBack}
              canGoBack={snap.canGoBack}
              onExit={onExit}
              sourcesIndex={sourcesIndex}
            />
          ) : currentStep ? (
            <StepView
              step={currentStep}
              draft={draft}
              onChange={setDraft}
              allInputs={snap.inputs}
              spec={spec}
              sourcesIndex={sourcesIndex}
              error={error}
              validationError={
                submitAttempted && !validation.ok ? validation.error : null
              }
              canGoBack={snap.canGoBack}
              canGoNext={validation.ok}
              onBack={handleBack}
              onNext={handleNext}
              stepIndex={
                spec.steps.findIndex((s) => s.id === currentStep.id) + 1
              }
              totalSteps={spec.steps.length}
            />
          ) : null}
        </section>

        <aside
          className={`${
            showArtifact ? "block" : "hidden lg:block"
          } bg-slate-50 px-6 py-8 lg:px-8 lg:py-12`}
        >
          <ArtifactPane
            spec={spec}
            cursor={snap.cursor}
            inputs={snap.inputs}
          />
        </aside>
      </div>
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
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Step {stepIndex} of {totalSteps}
      </p>
      <h2 className="mt-1 text-2xl font-semibold text-slate-900">
        {step.title}
      </h2>
      <p className="mt-3 text-base leading-relaxed text-slate-700">
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

      <AdaptedGuidance
        spec={spec}
        step={step}
        inputsSoFar={allInputs}
        sourcesIndex={sourcesIndex}
      />


      {step.examples && step.examples.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {step.examples.map((ex, i) => (
            <details
              key={i}
              className="group rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 open:rounded-lg open:px-4 open:py-3"
            >
              <summary className="cursor-pointer font-medium text-slate-900">
                {ex.company}
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {ex.text}
              </p>
            </details>
          ))}
        </div>
      )}

      {(error || validationError) && (
        <p className="mt-4 text-sm text-rose-700">
          {error || validationError}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Next →
        </button>
      </div>
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
}: {
  spec: FrameworkSpec;
  inputs: Record<string, unknown>;
  onBack: () => void;
  canGoBack: boolean;
  onExit?: () => void;
  sourcesIndex?: SourcesIndex;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
          Workflow complete
        </p>
      </div>
      <h2 className="mt-1 text-2xl font-semibold text-slate-900">
        {spec.name} — artifact ready
      </h2>
      <p className="mt-3 text-base leading-relaxed text-slate-700">
        You&apos;ve answered every step. Copy or download the finished artifact
        below, or jump back to revise a step.
      </p>

      <ArtifactExport spec={spec} inputs={inputs} sourcesIndex={sourcesIndex} />

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          ← Back to last step
        </button>
        {onExit && (
          <button
            onClick={onExit}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to frameworks
          </button>
        )}
      </div>
    </div>
  );
}
