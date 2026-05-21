/**
 * One-off regeneration script.
 *
 * Reads the data repo's `index.json` (the corpus catalog of newsletters and
 * podcasts) and emits `data/sources-index.json`, a flat lookup mapping every
 * corpus filename (e.g. `newsletters/x.md`, `podcasts/y.md`) to its
 * `{ title, post_url }`. The app reads the committed JSON at runtime via
 * `lib/sources.ts` — it never depends on this script or the external
 * `index.json` path.
 *
 * Run this only when the corpus changes. Usage:
 *   pnpm tsx scripts/build-sources-index.ts [path-to-index.json]
 *
 * Default input path:
 *   /Users/rakeshkatti/dev/lennys-newsletterpodcastdata-all/index.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_INPUT =
  "/Users/rakeshkatti/dev/lennys-newsletterpodcastdata-all/index.json";

interface CorpusEntry {
  title: string;
  filename: string;
  post_url?: string;
}

interface CorpusIndex {
  newsletters: CorpusEntry[];
  podcasts: CorpusEntry[];
}

function main(): void {
  const inputPath = process.argv[2] ?? DEFAULT_INPUT;

  let raw: string;
  try {
    raw = readFileSync(inputPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read corpus index at ${inputPath}: ${(err as Error).message}`,
    );
  }

  let index: CorpusIndex;
  try {
    index = JSON.parse(raw) as CorpusIndex;
  } catch (err) {
    throw new Error(
      `Corpus index at ${inputPath} is not valid JSON: ${(err as Error).message}`,
    );
  }

  const entries = [
    ...(index.newsletters ?? []),
    ...(index.podcasts ?? []),
  ];

  const sourcesIndex: Record<string, { title: string; post_url: string | null }> =
    {};

  for (const entry of entries) {
    if (!entry.filename || !entry.title) {
      throw new Error(
        `Corpus entry missing filename or title: ${JSON.stringify(entry)}`,
      );
    }
    sourcesIndex[entry.filename] = {
      title: entry.title,
      post_url: entry.post_url ?? null,
    };
  }

  const outputPath = join(process.cwd(), "data", "sources-index.json");
  writeFileSync(outputPath, JSON.stringify(sourcesIndex, null, 2) + "\n", "utf-8");

  console.log(
    `Wrote ${Object.keys(sourcesIndex).length} sources to ${outputPath}`,
  );
}

main();
