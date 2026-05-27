import { z } from "zod";

/**
 * Benchmarks catalog — see `data/benchmarks.json`. Each metric defines one or
 * more segment bands. Thresholds are free-form strings authored from the
 * Lenny's Newsletter benchmark posts (e.g. `"3-5%"`, `"<2%"`, `"~50%"`,
 * `"$1M ARR within 12 months of launch"`).
 *
 * The verdict computer only attempts to parse the common percentage-style
 * thresholds the catalog actually uses; non-numeric strings (e.g. the
 * dollar/time growth-rate entries) yield a `null` verdict rather than guess.
 */

const benchmarkSegmentSchema = z
  .object({
    segment: z.string().min(1),
    good: z.string().optional(),
    great: z.string().optional(),
    ok: z.string().optional(),
    exceptional: z.string().optional(),
  })
  .passthrough();

const metricBenchmarkSchema = z
  .object({
    metric_label: z.string().min(1),
    source: z.string().min(1),
    segments: z.array(benchmarkSegmentSchema).min(1),
  })
  .strict();

export const benchmarksSchema = z.record(metricBenchmarkSchema);

export type BenchmarkSegment = z.infer<typeof benchmarkSegmentSchema>;
export type MetricBenchmark = z.infer<typeof metricBenchmarkSchema>;
export type Benchmarks = z.infer<typeof benchmarksSchema>;

export type VerdictBand = "below" | "good" | "great";

export interface Verdict {
  band: VerdictBand;
  label: string;
  segment: string;
}

/**
 * Parse a threshold string into a numeric range (low/high in percent points
 * or whatever raw unit the value uses — we only care about ordering). Returns
 * `null` for thresholds we can't classify (dollar-time, multi-condition,
 * descriptive bands like "25-85% range, ~50% average if invited…").
 *
 * Supported shapes (after stripping `%`):
 *   - "3-5"            → { low: 3, high: 5 }
 *   - "<2", "<1.5"     → { low: -Infinity, high: 2, openLow: true }
 *   - ">1.0", ">=20"   → { low: 1.0, high: Infinity, openHigh: true }
 *   - "~25", "~50"     → { low: 25, high: 25, fuzzy: true }
 *   - "4-5x"           → { low: 4, high: 5 } (unit hint ignored)
 *   - "3x"             → { low: 3, high: 3 }
 */
export interface ParsedThreshold {
  low: number;
  high: number;
  openLow?: boolean;
  openHigh?: boolean;
  fuzzy?: boolean;
  raw: string;
}

const RANGE_RE = /^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/;
const LT_RE = /^<\s*(-?\d+(?:\.\d+)?)/;
const LE_RE = /^<=\s*(-?\d+(?:\.\d+)?)/;
const GT_RE = /^>\s*(-?\d+(?:\.\d+)?)/;
const GE_RE = /^>=\s*(-?\d+(?:\.\d+)?)/;
const APPROX_RE = /^~\s*(-?\d+(?:\.\d+)?)/;
const SINGLE_RE = /^(-?\d+(?:\.\d+)?)/;

export function parseThreshold(input: string): ParsedThreshold | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Reject obviously-non-numeric / multi-condition descriptive bands.
  // "$1M ARR within 12 months of launch", "25-85% range, ~50% average if invited within a month"
  if (trimmed.startsWith("$")) return null;
  if (/within\b/i.test(trimmed)) return null;
  if (/\baverage\b/i.test(trimmed) || /\bmedian\b/i.test(trimmed)) return null;

  // Strip a trailing percent sign on each number and a trailing "x" unit hint.
  // We'll normalize by removing "%" globally — ordering is what matters.
  const s = trimmed.replace(/%/g, "");

  let m: RegExpMatchArray | null;
  if ((m = s.match(RANGE_RE))) {
    return { low: Number(m[1]), high: Number(m[2]), raw: trimmed };
  }
  if ((m = s.match(LE_RE))) {
    return {
      low: -Infinity,
      high: Number(m[1]),
      openLow: true,
      raw: trimmed,
    };
  }
  if ((m = s.match(LT_RE))) {
    return {
      low: -Infinity,
      high: Number(m[1]),
      openLow: true,
      raw: trimmed,
    };
  }
  if ((m = s.match(GE_RE))) {
    return {
      low: Number(m[1]),
      high: Infinity,
      openHigh: true,
      raw: trimmed,
    };
  }
  if ((m = s.match(GT_RE))) {
    return {
      low: Number(m[1]),
      high: Infinity,
      openHigh: true,
      raw: trimmed,
    };
  }
  if ((m = s.match(APPROX_RE))) {
    const n = Number(m[1]);
    return { low: n, high: n, fuzzy: true, raw: trimmed };
  }
  if ((m = s.match(SINGLE_RE))) {
    const n = Number(m[1]);
    return { low: n, high: n, raw: trimmed };
  }
  return null;
}

/**
 * For a "lower-is-better" metric (e.g. churn), a value meets a threshold if
 * value <= threshold high bound (for "<2%" or "3-5%" the boundary is high).
 *
 * For a "higher-is-better" metric (e.g. retention, NRR), a value meets a
 * threshold if value >= threshold low bound.
 *
 * `monthly_churn` is the only lower-is-better metric in the current catalog;
 * everything else (retention, NRR, growth rate, free-to-paid, waitlist,
 * activation) is higher-is-better.
 */
const LOWER_IS_BETTER = new Set(["monthly_churn", "payback_period"]);

function meetsBand(
  value: number,
  parsed: ParsedThreshold,
  lowerIsBetter: boolean,
): boolean {
  if (lowerIsBetter) {
    // good "3-5%": value <= 5 is "at-or-better-than the upper edge of good".
    // great "<2%": value <= 2.
    return value <= parsed.high;
  }
  // higher-is-better:
  // good "3-5%": value >= 3 (lower edge of good).
  // great "6-8%": value >= 6.
  // good "~50%": value >= 50.
  // good ">1.0": value >= 1.0.
  return value >= parsed.low;
}

function formatPercent(value: number): string {
  // Strip trailing .0 for clean display; keep up to 2 decimals otherwise.
  if (Number.isInteger(value)) return `${value}`;
  return `${Number(value.toFixed(2))}`;
}

/**
 * Pure variant — caller supplies the benchmarks table (so it works in the
 * browser without importing `node:fs`). Server callers can use the
 * {@link computeVerdict} convenience wrapper instead.
 */
export function computeVerdictFrom(
  benchmarks: Benchmarks,
  metric: string,
  segmentLabel: string,
  value: number,
): Verdict | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const metricEntry = benchmarks[metric];
  if (!metricEntry) return null;
  const segment = metricEntry.segments.find(
    (s) => s.segment === segmentLabel,
  );
  if (!segment) return null;

  const lowerIsBetter = LOWER_IS_BETTER.has(metric);
  const great = segment.great ? parseThreshold(segment.great) : null;
  const good = segment.good ? parseThreshold(segment.good) : null;

  // Both unparseable: bail (e.g. growth-rate's dollar/time entries).
  if (!great && !good) return null;

  const valueStr = formatPercent(value);
  // Format using a percent sign if the threshold contained one.
  const hasPercent =
    (segment.great?.includes("%") ?? false) ||
    (segment.good?.includes("%") ?? false);
  const display = `${valueStr}${hasPercent ? "%" : ""}`;

  if (great && meetsBand(value, great, lowerIsBetter)) {
    return {
      band: "great",
      segment: segment.segment,
      label: `${display} — meets the great threshold (${great.raw}) for ${segment.segment}`,
    };
  }
  if (good && meetsBand(value, good, lowerIsBetter)) {
    return {
      band: "good",
      segment: segment.segment,
      label: `${display} — within the ${good.raw} healthy band for ${segment.segment}`,
    };
  }
  // Below — name the gap to the great threshold when available, else good.
  const reference = great ?? good!;
  const refKind = great ? "great" : "good";
  return {
    band: "below",
    segment: segment.segment,
    label: `${display} — below the ${refKind} threshold (${reference.raw}) for ${segment.segment}`,
  };
}

