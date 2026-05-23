export type SML = "S" | "M" | "L";

export const SML_PERCENT: Record<SML, number> = { S: 30, M: 60, L: 90 };
export const SML_EFFORT_WEEKS: Record<SML, number> = { S: 1, M: 2, L: 4 };

export type CellValue = string;

export type ScoreGrid = Record<string, Record<string, CellValue>>;

export interface RankedRow {
  item: string;
  score: number;
  scores: Record<string, CellValue>;
}

export type ScoringMode = "rice" | "sum";

export interface RankScoreGridOptions {
  /** Which scoring algorithm to use. Defaults to "rice" for back-compat. */
  scoring?: ScoringMode;
  /** Dimensions to include in sum scoring. Required for "sum". */
  dimensions?: string[];
  /** Spec scale array — used to map cell strings to integer values for "sum". */
  scale?: string[];
}

function pct(v: SML): number {
  return SML_PERCENT[v] / 100;
}

export function riceScore(scores: Record<string, CellValue>): number {
  const reach = scores.Reach as SML | undefined;
  const impact = scores.Impact as SML | undefined;
  const confidence = scores.Confidence as SML | undefined;
  const effort = scores.Effort as SML | undefined;
  if (!reach || !impact || !confidence || !effort) {
    throw new Error(
      `riceScore requires Reach, Impact, Confidence, Effort. Got: ${JSON.stringify(scores)}`,
    );
  }
  return (
    (pct(reach) * pct(impact) * pct(confidence)) /
    SML_EFFORT_WEEKS[effort]
  );
}

/**
 * Sum a row's dimension scores using the spec's `scale` array as the value map:
 * the position in `scale` (1-indexed) is the integer value of that cell.
 * Unknown cell values contribute 0.
 *
 * Example: scale=["1","2","3"], scores={Impact:"3", Certainty:"2"} → 3 + 2 = 5.
 * Example: scale=["S","M","L"], scores={Reach:"L", Impact:"S"} → 3 + 1 = 4.
 */
export function sumScore(
  scores: Record<string, CellValue>,
  dimensions: string[],
  scale: string[],
): number {
  let total = 0;
  for (const dim of dimensions) {
    const v = scores[dim];
    if (typeof v !== "string") continue;
    const idx = scale.indexOf(v);
    if (idx >= 0) total += idx + 1;
  }
  return total;
}

export function rankByDimensionSum(
  grid: ScoreGrid,
  dimensions: string[],
  scale: string[],
): RankedRow[] {
  const rows: RankedRow[] = Object.entries(grid).map(([item, scores]) => ({
    item,
    scores,
    score: sumScore(scores, dimensions, scale),
  }));
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

/**
 * Rank a score-grid. Dispatches on `opts.scoring`:
 *   - "rice" (default, back-compat): uses {@link riceScore}, requires R/I/C/E.
 *   - "sum": uses {@link sumScore}, requires `dimensions` + `scale`.
 */
export function rankScoreGrid(
  grid: ScoreGrid,
  opts: RankScoreGridOptions = {},
): RankedRow[] {
  const mode: ScoringMode = opts.scoring ?? "rice";
  if (mode === "sum") {
    if (!opts.dimensions || opts.dimensions.length === 0) {
      throw new Error("rankScoreGrid: sum scoring requires `dimensions`");
    }
    if (!opts.scale || opts.scale.length === 0) {
      throw new Error("rankScoreGrid: sum scoring requires `scale`");
    }
    return rankByDimensionSum(grid, opts.dimensions, opts.scale);
  }
  const rows: RankedRow[] = Object.entries(grid).map(([item, scores]) => ({
    item,
    scores,
    score: riceScore(scores),
  }));
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

export function ricePreselect(
  ranked: RankedRow[],
  multiplier: number,
  capacity = 1,
): string[] {
  const n = Math.max(1, Math.round(multiplier * capacity));
  return ranked.slice(0, n).map((r) => r.item);
}

/**
 * Pick the top `count` items from a ranked list — sum-mode companion to
 * {@link ricePreselect}. Used when a multi-choice step's `preselect` is
 * `"sum_top"` and `preselect_count` is set.
 */
export function sumPreselect(ranked: RankedRow[], count: number): string[] {
  const n = Math.max(1, Math.floor(count));
  return ranked.slice(0, n).map((r) => r.item);
}
