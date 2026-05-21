export type SML = "S" | "M" | "L";

export const SML_PERCENT: Record<SML, number> = { S: 30, M: 60, L: 90 };
export const SML_EFFORT_WEEKS: Record<SML, number> = { S: 1, M: 2, L: 4 };

export type ScoreGrid = Record<string, Record<string, SML>>;

export interface RankedRow {
  item: string;
  score: number;
  scores: Record<string, SML>;
}

function pct(v: SML): number {
  return SML_PERCENT[v] / 100;
}

export function riceScore(scores: Record<string, SML>): number {
  const reach = scores.Reach;
  const impact = scores.Impact;
  const confidence = scores.Confidence;
  const effort = scores.Effort;
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

export function rankScoreGrid(grid: ScoreGrid): RankedRow[] {
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
