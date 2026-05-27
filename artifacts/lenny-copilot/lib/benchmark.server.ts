// Server-only: imports node:fs to read the benchmarks JSON from disk.
// Client components should NOT import this — instead thread the benchmarks
// table down as a prop from a server component / page.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  benchmarksSchema,
  computeVerdictFrom,
  type Benchmarks,
  type Verdict,
} from "./benchmark";

let cached: Benchmarks | null = null;

/**
 * Server-only loader for `data/benchmarks.json`. Validates with Zod and
 * caches the parsed table in module-scope for subsequent calls.
 *
 * For client components, the benchmarks table must be threaded as a prop
 * (loaded by a server component / page) — see `src/app/page.tsx`.
 */
export function loadBenchmarks(): Benchmarks {
  if (cached) return cached;
  const path = join(process.cwd(), "data", "benchmarks.json");
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw);
  const result = benchmarksSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `data/benchmarks.json failed schema validation:\n${JSON.stringify(
        result.error.issues,
        null,
        2,
      )}`,
    );
  }
  cached = result.data;
  return cached;
}

/** Test-only: clear the in-memory cache so tests can reload from disk. */
export function _resetBenchmarksCache(): void {
  cached = null;
}

/**
 * Server-side convenience wrapper around {@link computeVerdictFrom} that
 * loads the benchmarks table from disk on demand.
 */
export function computeVerdict(
  metric: string,
  segmentLabel: string,
  value: number,
): Verdict | null {
  return computeVerdictFrom(loadBenchmarks(), metric, segmentLabel, value);
}
