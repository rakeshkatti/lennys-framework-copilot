"use client";

import type { FrameworkSpec, Step } from "@lib/spec";
import { ARTIFACT_CURSOR, rankScoreGrid, type SML } from "@lib/engine";

type Status = "completed" | "current" | "pending";

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
    <div className="sticky top-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Artifact preview
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">
        {spec.name}
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Builds up as you complete each step.
      </p>

      <ol className="mt-4 space-y-2">
        {spec.steps.map((step, idx) => {
          const status = statusFor(step);
          return (
            <li
              key={step.id}
              className={`rounded-lg border p-3 transition ${
                status === "current"
                  ? "border-slate-900 bg-white shadow-sm"
                  : status === "completed"
                  ? "border-slate-200 bg-white"
                  : "border-dashed border-slate-200 bg-transparent opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                <StepDot status={status} index={idx + 1} />
                <p
                  className={`text-sm font-medium ${
                    status === "pending" ? "text-slate-500" : "text-slate-900"
                  }`}
                >
                  {step.title}
                </p>
              </div>
              {status === "completed" && (
                <div className="mt-2 pl-7 text-xs text-slate-600">
                  <StepSummary step={step} value={inputs[step.id]} />
                </div>
              )}
            </li>
          );
        })}
        <li
          className={`rounded-lg border p-3 ${
            cursor === ARTIFACT_CURSOR
              ? "border-emerald-500 bg-emerald-50"
              : "border-dashed border-slate-200 opacity-60"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                cursor === ARTIFACT_CURSOR
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              ✓
            </span>
            <p className="text-sm font-medium text-slate-900">
              {spec.artifact.type === "scored-table"
                ? "Scored & ranked artifact"
                : "Artifact"}
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}

function StepDot({ status, index }: { status: Status; index: number }) {
  const base = "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold";
  if (status === "completed")
    return <span className={`${base} bg-slate-900 text-white`}>✓</span>;
  if (status === "current")
    return <span className={`${base} bg-slate-900 text-white`}>{index}</span>;
  return <span className={`${base} bg-slate-200 text-slate-500`}>{index}</span>;
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
              <tr key={r.item} className="border-b border-slate-100 last:border-0">
                <td className="py-1 pr-2">{r.item}</td>
                <td className="py-1 text-right font-mono tabular-nums text-slate-500">
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
                <span className="font-medium text-slate-800">{k}:</span>{" "}
                <span className="text-slate-600">
                  {val.length > 80 ? val.slice(0, 80) + "…" : val}
                </span>
              </li>
            ))}
          </ul>
        );
      }
      const text = String(v.value ?? "");
      return (
        <p className="text-slate-600">
          {text.length > 200 ? text.slice(0, 200) + "…" : text}
        </p>
      );
    }
  }
}
