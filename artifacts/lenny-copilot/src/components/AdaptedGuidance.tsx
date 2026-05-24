"use client";

import { useEffect, useRef, useState } from "react";
import type { FrameworkSpec, Step } from "@lib/spec";
import type { SourceEntry, SourcesIndex } from "@lib/sources";

interface AdaptedSentence {
  text: string;
  quote: string;
}

interface AdaptResponse {
  sentences: AdaptedSentence[];
  fallback: boolean;
  source: { file: string };
  reason?: string;
  suggested_options?: string[];
}

type State =
  | { kind: "loading"; staticText: string }
  | { kind: "loaded"; data: AdaptResponse }
  | { kind: "error"; staticText: string };

/**
 * Plan 5 — right-column "From the source" panel.
 *
 * Cream-tinted background (bg-peach/50 over the cream page BG) so the
 * panel reads as a quiet auxiliary surface, not a primary card. The
 * dotted-underline citation tooltips and source chip remain identical
 * in behavior; only the visual treatment changed.
 */
function ResponseSourceChip({
  file,
  source,
}: {
  file: string;
  source: SourceEntry | null;
}) {
  const label = source?.title ?? file;
  const base =
    "inline-flex items-center gap-1 rounded-chip border border-border-warm bg-white px-2.5 py-1 text-[11px] text-ink-body";
  if (source?.post_url) {
    return (
      <a
        href={source.post_url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} transition hover:border-ink-subtle hover:text-ink-strong`}
      >
        <span aria-hidden>↗</span>
        {label}
      </a>
    );
  }
  return (
    <span className={base}>
      <span aria-hidden>◆</span>
      {label}
    </span>
  );
}

export function AdaptedGuidance({
  spec,
  step,
  inputsSoFar,
  sourcesIndex,
  onSuggestionSelect,
}: {
  spec: FrameworkSpec;
  step: Step;
  inputsSoFar: Record<string, unknown>;
  sourcesIndex?: SourcesIndex;
  onSuggestionSelect?: (text: string) => void;
}) {
  const [state, setState] = useState<State>({
    kind: "loading",
    staticText: step.guidance.text,
  });
  const inputsRef = useRef(inputsSoFar);
  inputsRef.current = inputsSoFar;

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading", staticText: step.guidance.text });

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frameworkId: spec.id,
            stepId: step.id,
            inputsSoFar: inputsRef.current,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as AdaptResponse;
        if (cancelled) return;
        setState({ kind: "loaded", data });
      } catch (err) {
        if (cancelled || (err as { name?: string }).name === "AbortError") return;
        setState({ kind: "error", staticText: step.guidance.text });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, spec.id]);

  return (
    <aside className="rounded-card border border-border-warm bg-peach/50 p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          From the source
        </p>
        <Badge state={state} />
      </div>
      <div className="mt-3 text-sm leading-relaxed text-ink-body">
        {state.kind === "loading" && (
          <p className="opacity-70">{state.staticText}</p>
        )}
        {state.kind === "error" && <p>{state.staticText}</p>}
        {state.kind === "loaded" && (
          <div className="space-y-2">
            {state.data.sentences.map((s, i) => (
              <p key={i} className="group">
                <span
                  className="border-b border-dotted border-ink-subtle decoration-ink-subtle hover:border-ink-strong"
                  title={
                    state.data.fallback
                      ? `From ${state.data.source.file}`
                      : `Source: "${s.quote}" — ${state.data.source.file}`
                  }
                >
                  {s.text}
                </span>
              </p>
            ))}
            {sourcesIndex && (
              <div className="pt-2">
                <ResponseSourceChip
                  file={state.data.source.file}
                  source={sourcesIndex[state.data.source.file] ?? null}
                />
              </div>
            )}
            {onSuggestionSelect &&
              state.data.suggested_options &&
              state.data.suggested_options.length > 0 && (
                <div className="pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Suggestions from the source
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {state.data.suggested_options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onSuggestionSelect(opt)}
                        className="rounded-chip border border-border-warm bg-white px-3 py-1 text-xs text-ink-body shadow-sm transition hover:border-brand-accent hover:text-ink-strong hover:shadow focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink-subtle">
                    Click a chip to drop it into the notes — edit before continuing.
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </aside>
  );
}

function Badge({ state }: { state: State }) {
  if (state.kind === "loading") {
    return (
      <span className="rounded-chip bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        Adapting…
      </span>
    );
  }
  if (state.kind === "error") {
    return (
      <span className="rounded-chip bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
        Verbatim from source
      </span>
    );
  }
  if (state.data.fallback) {
    return (
      <span
        className="rounded-chip bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
        title={state.data.reason ?? "fallback"}
      >
        Verbatim from source
      </span>
    );
  }
  return (
    <span className="rounded-chip bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
      Adapted · {state.data.sentences.length} cited
    </span>
  );
}
