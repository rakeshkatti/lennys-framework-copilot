"use client";

import { useEffect, useRef, useState } from "react";
import type { FrameworkSpec, Step } from "@lib/spec";

interface AdaptedSentence {
  text: string;
  quote: string;
}

interface AdaptResponse {
  sentences: AdaptedSentence[];
  fallback: boolean;
  source: { file: string };
  reason?: string;
}

type State =
  | { kind: "loading"; staticText: string }
  | { kind: "loaded"; data: AdaptResponse }
  | { kind: "error"; staticText: string };

export function AdaptedGuidance({
  spec,
  step,
  inputsSoFar,
}: {
  spec: FrameworkSpec;
  step: Step;
  inputsSoFar: Record<string, unknown>;
}) {
  const [state, setState] = useState<State>({
    kind: "loading",
    staticText: step.guidance.text,
  });
  // Snapshot inputs at mount of this step so the network call is stable.
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
    // We intentionally key only on step.id — re-fetching on every input keystroke
    // would be wasteful. Inputs are captured at fetch time via inputsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, spec.id]);

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Guidance
        </p>
        <Badge state={state} />
      </div>
      <div className="mt-2 text-sm leading-relaxed text-slate-700">
        {state.kind === "loading" && (
          <p className="opacity-70">{state.staticText}</p>
        )}
        {state.kind === "error" && <p>{state.staticText}</p>}
        {state.kind === "loaded" && (
          <div className="space-y-2">
            {state.data.sentences.map((s, i) => (
              <p key={i} className="group">
                <span
                  className="border-b border-dotted border-slate-400 decoration-slate-400 hover:border-slate-700"
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
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ state }: { state: State }) {
  if (state.kind === "loading") {
    return (
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
        Adapting…
      </span>
    );
  }
  if (state.kind === "error") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
        Verbatim from source
      </span>
    );
  }
  if (state.data.fallback) {
    return (
      <span
        className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800"
        title={state.data.reason ?? "fallback"}
      >
        Verbatim from source
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800">
      Adapted · {state.data.sentences.length} cited
    </span>
  );
}
