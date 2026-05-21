import type { FrameworkSpec, Step } from "../spec";
import { rankScoreGrid, type SML } from "../engine";
import type { SourceEntry, SourcesIndex } from "../sources";

export interface RenderOptions {
  /** Steps that were completed (inputs key set). Used to skip branched-around
   *  steps so their templates render as empty. */
  completedStepIds: Set<string>;
}

/** Optional sources resolver. When passed to `renderSources` /
 *  `renderArtifactMarkdown`, source filenames in the "## Sources" block are
 *  emitted as markdown links to the original article. Either a plain
 *  `SourcesIndex` map or a resolver function may be supplied. When omitted,
 *  output is byte-identical to the filename-only form. */
export type SourceResolver =
  | SourcesIndex
  | ((file: string) => SourceEntry | null | undefined);

/** Resolve a single source file via either a map or a resolver function. */
function resolveSourceEntry(
  file: string,
  resolver: SourceResolver | undefined,
): SourceEntry | null {
  if (!resolver) return null;
  const entry =
    typeof resolver === "function" ? resolver(file) : resolver[file];
  return entry ?? null;
}

/** Render a source file as a markdown bullet label. With a resolver, emits a
 *  `[title](post_url)` link when `post_url` exists, `[title]` when the file
 *  resolves without a url, and the bare filename when it doesn't resolve (or
 *  no resolver was given). */
function formatSourceLabel(
  file: string,
  resolver: SourceResolver | undefined,
): string {
  const entry = resolveSourceEntry(file, resolver);
  if (!entry) return file;
  if (entry.post_url) return `[${entry.title}](${entry.post_url})`;
  return `[${entry.title}]`;
}

type StepValue = Record<string, unknown>;

function getStepValue(
  inputs: Record<string, unknown>,
  stepId: string,
): StepValue | null {
  const v = inputs[stepId];
  if (!v || typeof v !== "object") return null;
  return v as StepValue;
}

/** Escape a value for safe inclusion in a markdown table cell:
 *  pipes break the column structure and newlines break the row. */
function escapeCell(v: unknown): string {
  return String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

/** Inline (non-table) markdown rendering of a step's submitted value. */
export function formatStepOutput(step: Step, value: StepValue | null): string {
  if (!value) return "";
  switch (step.input.type) {
    case "list": {
      const items = (value.items as string[]) ?? [];
      return items.map((i) => `- ${i}`).join("\n");
    }
    case "number": {
      const unit = (step.input.config.unit as string | undefined) ?? "";
      return `${value.value}${unit ? ` ${unit}` : ""}`;
    }
    case "choice":
      return String(value.value ?? "");
    case "multi-choice": {
      const selected = (value.selected as string[]) ?? [];
      return selected.map((s) => `- ${s}`).join("\n");
    }
    case "score-grid": {
      // Inline form of a score grid: ranked bullets "item — score".
      const grid =
        (value.grid as Record<string, Record<string, SML>>) ?? {};
      let ranked: ReturnType<typeof rankScoreGrid> = [];
      try {
        ranked = rankScoreGrid(grid);
      } catch {
        return "";
      }
      return ranked.map((r) => `- ${r.item} — ${r.score.toFixed(2)}`).join("\n");
    }
    case "text": {
      if (step.input.config.per_item_from) {
        const values = (value.values as Record<string, string>) ?? {};
        return Object.entries(values)
          .map(([k, v]) => `**${k}**\n\n${v}`)
          .join("\n\n");
      }
      return String(value.value ?? "");
    }
  }
}

/** Markdown table rendering of a step's submitted value. Score-grids become
 *  a ranked table of `Idea | <dim1> | <dim2> | ... | Score`. Other input
 *  types fall back to a two-column key/value table. */
export function formatStepOutputAsTable(
  step: Step,
  value: StepValue | null,
): string {
  if (!value) return "";
  if (step.input.type === "score-grid") {
    const grid = (value.grid as Record<string, Record<string, SML>>) ?? {};
    let ranked: ReturnType<typeof rankScoreGrid> = [];
    try {
      ranked = rankScoreGrid(grid);
    } catch {
      return "";
    }
    if (ranked.length === 0) return "";
    const dims = Object.keys(ranked[0].scores);
    const header = ["Idea", ...dims, "Score"];
    const sep = header.map(() => "---");
    const rows = ranked.map((r) => [
      escapeCell(r.item),
      ...dims.map((d) => escapeCell(r.scores[d] ?? "")),
      r.score.toFixed(2),
    ]);
    return [header, sep, ...rows]
      .map((row) => `| ${row.join(" | ")} |`)
      .join("\n");
  }
  if (step.input.type === "multi-choice") {
    const selected = (value.selected as string[]) ?? [];
    return [
      "| Idea |",
      "| --- |",
      ...selected.map((s) => `| ${escapeCell(s)} |`),
    ].join("\n");
  }
  if (step.input.type === "list") {
    const items = (value.items as string[]) ?? [];
    return [
      "| Idea |",
      "| --- |",
      ...items.map((s) => `| ${escapeCell(s)} |`),
    ].join("\n");
  }
  // Fallback: render whatever inline form we have.
  return formatStepOutput(step, value);
}

const TEMPLATE_RE = /\{\{\s*(table:)?\s*steps\.([a-z0-9-]+)\.output\s*\}\}/g;

/** Resolve a spec's artifact.template against the user's inputs.
 *  - `{{steps.<id>.output}}` → inline formatted value
 *  - `{{table:steps.<id>.output}}` → markdown table
 *  - Steps that were skipped (not in completedStepIds) render as empty,
 *    and the placeholder's surrounding blank lines are collapsed so the
 *    output doesn't have stranded headings.
 */
export function resolveArtifactBody(
  spec: FrameworkSpec,
  inputs: Record<string, unknown>,
  opts: RenderOptions,
): string {
  const stepById = new Map(spec.steps.map((s) => [s.id, s]));
  const out = spec.artifact.template.replace(
    TEMPLATE_RE,
    (_match, tableMarker: string | undefined, stepId: string) => {
      const step = stepById.get(stepId);
      if (!step) return "";
      if (!opts.completedStepIds.has(stepId)) return "";
      const value = getStepValue(inputs, stepId);
      return tableMarker
        ? formatStepOutputAsTable(step, value)
        : formatStepOutput(step, value);
    },
  );
  // Collapse runs of 3+ newlines (left behind by empty placeholders) to 2.
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** Build a "## Sources" block. Lists every source file the spec cites
 *  (in spec order), and under each one the per-step character spans that
 *  were used to ground its guidance — so a reviewer can audit exactly which
 *  passages back the artifact. Only spans for steps the user completed are
 *  included. */
export function renderSources(
  spec: FrameworkSpec,
  opts: RenderOptions,
  sources?: SourceResolver,
): string {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const src of spec.source) {
    if (!seen.has(src)) {
      seen.add(src);
      ordered.push(src);
    }
  }

  // Group completed steps by their guidance source file.
  const spansByFile = new Map<
    string,
    Array<{ stepTitle: string; start: number; end: number }>
  >();
  for (const step of spec.steps) {
    if (!opts.completedStepIds.has(step.id)) continue;
    const span = step.guidance?.source_span;
    if (!span) continue;
    if (!spansByFile.has(span.file)) spansByFile.set(span.file, []);
    spansByFile.get(span.file)!.push({
      stepTitle: step.title,
      start: span.start,
      end: span.end,
    });
    if (!seen.has(span.file)) {
      seen.add(span.file);
      ordered.push(span.file);
    }
  }

  if (ordered.length === 0) return "";
  const lines: string[] = ["## Sources", ""];
  for (const file of ordered) {
    lines.push(`- ${formatSourceLabel(file, sources)}`);
    const spans = spansByFile.get(file) ?? [];
    for (const s of spans) {
      lines.push(`  - ${s.stepTitle} — chars ${s.start}–${s.end}`);
    }
  }
  return lines.join("\n");
}

/** Full markdown export: title + resolved body + sources. When `sources` is
 *  provided, the "## Sources" block links each file to its original article;
 *  when omitted, output is byte-identical to the filename-only form. */
export function renderArtifactMarkdown(
  spec: FrameworkSpec,
  inputs: Record<string, unknown>,
  opts: RenderOptions,
  sources?: SourceResolver,
): string {
  const body = resolveArtifactBody(spec, inputs, opts);
  const sourcesBlock = renderSources(spec, opts, sources);
  const parts = [body];
  if (sourcesBlock) parts.push(sourcesBlock);
  return parts.join("\n\n") + "\n";
}
