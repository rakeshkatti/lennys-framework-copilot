"use client";

import type { FrameworkSpec, Step } from "@lib/spec";
import { ARTIFACT_CURSOR, rankScoreGrid, type SML } from "@lib/engine";

type Status = "completed" | "current" | "pending";

/**
 * Plan 5 — right-column "Your progress" panel.
 *
 * Shows every step of the workflow with status badges (completed / current
 * / pending) and the user's filled-in answers for each completed step.
 * Sits below AdaptedGuidance in the right column on desktop so the user
 * can see what they've answered across the whole workflow without losing
 * the source-grounded guidance for the current step.
 *
 * Tokens per DESIGN.md (cream/peach surfaces, brand-orange accents for the
 * current step, ink-* text scale).
 */
export function ArtifactPane({
  spec,
  cursor,
  inputs,
}: {
  spec: FrameworkSpec;
  cursor: string;
  inputs: Record<string, unknown>;
}) {
  function statusFor(step: Step): Status {
    if (inputs[step.id] !== undefined) return "completed";
    if (cursor === step.id) return "current";
    return "pending";
  }

  return (
    <aside className="rounded-card border border-border-warm bg-white p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Your progress
      </p>
      <p className="mt-1 text-[11px] text-ink-subtle">
        Builds up as you complete each step. Click any step name to jump in your head.
      </p>

      <ol className="mt-4 space-y-2">
        {spec.steps.map((step, idx) => {
          const status = statusFor(step);
          return (
            <li
              key={step.id}
              className={
                status === "current"
                  ? "rounded-lg border border-brand bg-peach/30 p-3 shadow-sm transition"
                  : status === "completed"
                  ? "rounded-lg border border-border-warm bg-white p-3 transition"
                  : "rounded-lg border border-dashed border-border-warm bg-transparent p-3 opacity-60 transition"
              }
            >
              <div className="flex items-center gap-2">
                <StepDot status={status} index={idx + 1} />
                <p
                  className={
                    status === "pending"
                      ? "text-sm font-medium text-ink-muted"
                      : "text-sm font-medium text-ink-strong"
                  }
                >
                  {step.title}
                </p>
              </div>
              {status === "completed" && (
                <div className="mt-2 pl-7 text-xs text-ink-body">
                  <StepSummary step={step} value={inputs[step.id]} />
                </div>
              )}
            </li>
          );
        })}
        <li
          className={
            cursor === ARTIFACT_CURSOR
              ? "rounded-lg border border-brand bg-peach/30 p-3"
              : "rounded-lg border border-dashed border-border-warm p-3 opacity-60"
          }
        >
          <div className="flex items-center gap-2">
            <span
              className={
                cursor === ARTIFACT_CURSOR
                  ? "flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white"
                  : "flex h-5 w-5 items-center justify-center rounded-full bg-border-warm text-[10px] font-semibold text-ink-muted"
              }
            >
              ✓
            </span>
            <p className="text-sm font-medium text-ink-strong">
              {spec.artifact.type === "scored-table"
                ? "Scored & ranked artifact"
                : "Artifact"}
            </p>
          </div>
        </li>
      </ol>
    </aside>
  );
}

function StepDot({ status, index }: { status: Status; index: number }) {
  const base =
    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold";
  if (status === "completed")
    return <span className={`${base} bg-brand text-white`}>✓</span>;
  if (status === "current")
    return <span className={`${base} bg-brand text-white`}>{index}</span>;
  return (
    <span className={`${base} bg-border-warm text-ink-muted`}>{index}</span>
  );
}

function StepSummary({ step, value }: { step: Step; value: unknown }) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;

  switch (step.input.type) {
    case "list": {
      const items = (v.items as string[]) ?? [];
      return (
        <ul className="list-disc space-y-0.5 pl-4">
          {items.map((item, i) => (
            <li key={i} className="truncate">
              {item}
            </li>
          ))}
        </ul>
      );
    }
    case "number": {
      const unit = (step.input.config.unit as string | undefined) ?? "";
      return (
        <p className="font-mono">
          {String(v.value)} {unit}
        </p>
      );
    }
    case "choice":
      return <p>{String(v.value)}</p>;
    case "multi-choice": {
      const selected = (v.selected as string[]) ?? [];
      return (
        <ul className="list-disc space-y-0.5 pl-4">
          {selected.map((s, i) => (
            <li key={i} className="truncate">
              {s}
            </li>
          ))}
        </ul>
      );
    }
    case "score-grid": {
      const grid = (v.grid as Record<string, Record<string, SML>>) ?? {};
      let ranked: Array<{ item: string; score: number }> = [];
      try {
        ranked = rankScoreGrid(grid).map((r) => ({
          item: r.item,
          score: r.score,
        }));
      } catch {
        // missing required dims — show nothing
      }
      if (ranked.length === 0) return null;
      return (
        <table className="w-full text-left text-xs">
          <tbody>
            {ranked.map((r) => (
              <tr
                key={r.item}
                className="border-b border-border-warm last:border-0"
              >
                <td className="py-1 pr-2">{r.item}</td>
                <td className="py-1 text-right font-mono tabular-nums text-ink-muted">
                  {r.score.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "text": {
      if (step.input.config.per_item_from) {
        const values = (v.values as Record<string, string>) ?? {};
        return (
          <ul className="space-y-1">
            {Object.entries(values).map(([k, val]) => (
              <li key={k}>
                <span className="font-medium text-ink-strong">{k}:</span>{" "}
                <span className="text-ink-body">
                  {val.length > 80 ? val.slice(0, 80) + "…" : val}
                </span>
              </li>
            ))}
          </ul>
        );
      }
      const text = String(v.value ?? "");
      return (
        <p className="text-ink-body">
          {text.length > 200 ? text.slice(0, 200) + "…" : text}
        </p>
      );
    }
  }
}
