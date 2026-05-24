"use client";

import { useEffect, useMemo } from "react";
import type { FrameworkSpec, Step } from "@lib/spec";
import {
  rankScoreGrid,
  ricePreselect,
  sumPreselect,
  type CellValue,
  type RankedRow,
  type ScoringMode,
} from "@lib/engine";

export function initialDraftFor(
  step: Step,
  allInputs: Record<string, unknown>,
): unknown {
  const existing = allInputs[step.id];
  if (existing !== undefined) return existing;
  const { type, config } = step.input;
  switch (type) {
    case "list": {
      const minItems = (config.min_items as number | undefined) ?? 3;
      return { items: Array.from({ length: minItems }, () => "") };
    }
    case "number":
      return { value: "" };
    case "choice":
      return { value: "" };
    case "multi-choice":
      return { selected: [] };
    case "text":
      return config.per_item_from ? { values: {} } : { value: "" };
    case "score-grid":
      return { grid: {} };
  }
}

interface InputProps {
  step: Step;
  draft: unknown;
  allInputs: Record<string, unknown>;
  spec: FrameworkSpec;
  onChange: (v: unknown) => void;
}

export function StepInput(props: InputProps) {
  switch (props.step.input.type) {
    case "list":
      return <ListInput {...props} />;
    case "number":
      return <NumberInput {...props} />;
    case "choice":
      return <ChoiceInput {...props} />;
    case "multi-choice":
      return <MultiChoiceInput {...props} />;
    case "text":
      return <TextInput {...props} />;
    case "score-grid":
      return <ScoreGridInput {...props} />;
  }
}

function ListInput({ step, draft, onChange }: InputProps) {
  const config = step.input.config;
  const items: string[] = ((draft as { items?: string[] })?.items) ?? [];
  const minItems = (config.min_items as number | undefined) ?? 0;
  const label = (config.item_label as string | undefined) ?? "item";
  const nonEmpty = items.filter((s) => s.trim().length > 0).length;

  function update(next: string[]) {
    onChange({ items: next });
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-6 text-right text-xs text-ink-subtle">
            {i + 1}.
          </span>
          <input
            type="text"
            value={item}
            placeholder={`${label} ${i + 1}`}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              update(next);
            }}
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => update(items.filter((_, j) => j !== i))}
            className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-peach/30"
            aria-label={`Remove ${label} ${i + 1}`}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => update([...items, ""])}
          className="rounded-md border border-dashed border-border-warm px-3 py-1.5 text-sm text-ink-muted transition hover:border-ink-subtle hover:bg-peach/30 hover:text-ink-strong"
        >
          + Add {label}
        </button>
        <span
          className={`text-xs ${
            nonEmpty >= minItems ? "text-ink-muted" : "text-rose-600"
          }`}
        >
          {nonEmpty} / {minItems} minimum
        </span>
      </div>
    </div>
  );
}

function NumberInput({ step, draft, onChange }: InputProps) {
  const config = step.input.config;
  const v = (draft as { value?: number | string })?.value;
  const unit = config.unit as string | undefined;
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={v === undefined ? "" : (v as number | string)}
        min={config.min as number | undefined}
        max={config.max as number | undefined}
        onChange={(e) => {
          const raw = e.target.value;
          onChange({ value: raw === "" ? "" : Number(raw) });
        }}
        className="w-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
      />
      {unit && <span className="text-sm text-ink-muted">{unit}</span>}
    </div>
  );
}

function ChoiceInput({ step, draft, onChange }: InputProps) {
  const config = step.input.config;
  const options = (config.options as string[] | undefined) ?? [];
  const value = (draft as { value?: string })?.value ?? "";
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt}
          className="flex cursor-pointer items-center gap-3 rounded-md border border-border-warm bg-white px-3 py-2 text-sm text-ink-body transition hover:border-brand-accent hover:bg-peach/30"
        >
          <input
            type="radio"
            name={step.id}
            checked={value === opt}
            onChange={() => onChange({ value: opt })}
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

function MultiChoiceInput({ step, draft, allInputs, spec, onChange }: InputProps) {
  const config = step.input.config;
  const optionsFrom = config.options_from as string | undefined;
  const explicitOptions = config.options as string[] | undefined;
  const options: string[] = useMemo(() => {
    if (optionsFrom) {
      const src = allInputs[optionsFrom] as { items?: string[] } | undefined;
      return (src?.items ?? []).filter((s) => s.trim().length > 0);
    }
    return explicitOptions ?? [];
  }, [optionsFrom, explicitOptions, allInputs]);

  const rankingInfo: {
    map: Map<string, RankedRow>;
    mode: ScoringMode;
  } | null = useMemo(() => {
    const preselect = config.preselect as string | undefined;
    if (preselect !== "rice_top" && preselect !== "sum_top") return null;
    const currentIdx = spec.steps.findIndex((s) => s.id === step.id);
    const gridStep = spec.steps
      .slice(0, currentIdx)
      .reverse()
      .find((s) => s.input.type === "score-grid");
    if (!gridStep) return null;
    const gridInput = allInputs[gridStep.id] as
      | { grid?: Record<string, Record<string, CellValue>> }
      | undefined;
    if (!gridInput?.grid) return null;
    const gridConfig = gridStep.input.config as {
      scoring?: ScoringMode;
      dimensions?: string[];
      scale?: string[];
    };
    const mode: ScoringMode = gridConfig.scoring ?? "rice";
    try {
      const ranked = rankScoreGrid(gridInput.grid, {
        scoring: mode,
        dimensions: gridConfig.dimensions,
        scale: gridConfig.scale,
      });
      const map = new Map<string, RankedRow>();
      ranked.forEach((r) => map.set(r.item, r));
      return { map, mode };
    } catch {
      return null;
    }
  }, [config.preselect, spec.steps, step.id, allInputs]);

  const ranking = rankingInfo?.map ?? null;
  const rankingMode = rankingInfo?.mode ?? null;

  const selected = (draft as { selected?: string[] })?.selected ?? [];

  // Preselect on first render of this step if user hasn't picked anything.
  useEffect(() => {
    if (selected.length > 0) return;
    if (!ranking || options.length === 0) return;
    const ranked = options
      .map((opt) => ranking.get(opt))
      .filter((r): r is RankedRow => Boolean(r));
    let top: string[] = [];
    if (config.preselect === "sum_top") {
      const count = (config.preselect_count as number | undefined) ?? 3;
      top = sumPreselect(ranked, count);
    } else {
      const multiplier = (config.preselect_multiplier as number | undefined) ?? 2;
      const capacity = Math.max(1, Math.ceil(options.length / 5));
      top = ricePreselect(ranked, multiplier, capacity);
    }
    if (top.length > 0) {
      onChange({ selected: top });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranking, options.length]);

  function toggle(opt: string) {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    onChange({ selected: next });
  }

  // Sort options by ranking when available
  const ordered = useMemo(() => {
    if (!ranking) return options;
    return [...options].sort((a, b) => {
      const ra = ranking.get(a)?.score ?? -Infinity;
      const rb = ranking.get(b)?.score ?? -Infinity;
      return rb - ra;
    });
  }, [options, ranking]);

  if (options.length === 0) {
    return (
      <p className="text-sm italic text-ink-muted">
        No options available — complete the previous list step first.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {ordered.map((opt, i) => {
        const r = ranking?.get(opt);
        const isSelected = selected.includes(opt);
        return (
          <label
            key={opt}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
              isSelected
                ? "border-brand-accent bg-peach/30"
                : "border-border-warm bg-white text-ink-body hover:border-brand-accent hover:bg-peach/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(opt)}
              />
              <span>
                {ranking && (
                  <span className="mr-2 text-xs text-ink-subtle">
                    #{i + 1}
                  </span>
                )}
                {opt}
              </span>
            </div>
            {r && (
              <span className="text-xs tabular-nums text-ink-muted">
                {rankingMode === "sum"
                  ? `Sum ${r.score}`
                  : `RICE ${r.score.toFixed(2)}`}
              </span>
            )}
          </label>
        );
      })}
      <p className="pt-1 text-xs text-ink-muted">
        {selected.length} selected
      </p>
    </div>
  );
}

function TextInput({ step, draft, allInputs, onChange }: InputProps) {
  const config = step.input.config;
  const placeholder = (config.placeholder as string | undefined) ?? "";
  const maxLen = config.max_len as number | undefined;
  const perItemFrom = config.per_item_from as string | undefined;

  if (perItemFrom) {
    const src = allInputs[perItemFrom] as
      | { items?: string[]; selected?: string[] }
      | undefined;
    const items = (src?.items ?? src?.selected ?? []).filter((s) =>
      typeof s === "string" ? s.trim().length > 0 : false,
    );
    const values = (draft as { values?: Record<string, string> })?.values ?? {};

    if (items.length === 0) {
      return (
        <p className="text-sm italic text-ink-muted">
          No items to describe — complete the previous step first.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item}>
            <label className="block text-sm font-medium text-ink-strong">
              {item}
            </label>
            <textarea
              rows={4}
              value={values[item] ?? ""}
              placeholder={placeholder}
              maxLength={maxLen}
              onChange={(e) =>
                onChange({
                  values: { ...values, [item]: e.target.value },
                })
              }
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
            />
            {maxLen !== undefined && (
              <p className="mt-1 text-right text-xs text-ink-subtle">
                {(values[item] ?? "").length} / {maxLen}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  const value = (draft as { value?: string })?.value ?? "";
  return (
    <div>
      <textarea
        rows={4}
        value={value}
        placeholder={placeholder}
        maxLength={maxLen}
        onChange={(e) => onChange({ value: e.target.value })}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
      />
      {maxLen !== undefined && (
        <p className="mt-1 text-right text-xs text-slate-400">
          {value.length} / {maxLen}
        </p>
      )}
    </div>
  );
}

function ScoreGridInput({ step, draft, allInputs, onChange }: InputProps) {
  const config = step.input.config;
  const rowsFrom = config.rows_from as string;
  const dimensions = (config.dimensions as string[]) ?? [];
  const scale = ((config.scale as string[]) ?? ["S", "M", "L"]) as CellValue[];
  const src = allInputs[rowsFrom] as { items?: string[] } | undefined;
  const rows = (src?.items ?? []).filter((s) => s.trim().length > 0);
  const grid: Record<string, Record<string, CellValue>> =
    ((draft as { grid?: Record<string, Record<string, CellValue>> })?.grid) ?? {};

  if (rows.length === 0) {
    return (
      <p className="text-sm italic text-ink-muted">
        No rows to score — complete the previous list step first.
      </p>
    );
  }

  function setCell(row: string, dim: string, value: CellValue) {
    const next = {
      ...grid,
      [row]: { ...(grid[row] ?? {}), [dim]: value },
    };
    onChange({ grid: next });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1 text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
            <th className="px-2 py-2 font-medium">Idea</th>
            {dimensions.map((d) => (
              <th key={d} className="px-2 py-2 font-medium">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="rounded-md">
              <td className="rounded-l-md bg-white px-3 py-2 align-middle text-ink-strong">
                {row}
              </td>
              {dimensions.map((dim, i) => {
                const current = grid[row]?.[dim];
                return (
                  <td
                    key={dim}
                    className={`bg-white px-2 py-2 align-middle ${
                      i === dimensions.length - 1 ? "rounded-r-md" : ""
                    }`}
                  >
                    <div className="flex gap-1">
                      {scale.map((s) => {
                        const isOn = current === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCell(row, dim, s)}
                            className={`h-7 w-7 rounded-md border text-xs font-semibold ${
                              isOn
                                ? "border-brand bg-brand text-white"
                                : "border-border-warm bg-white text-ink-body hover:bg-peach/30"
                            }`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
