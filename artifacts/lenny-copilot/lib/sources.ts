import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const sourceEntrySchema = z
  .object({
    title: z.string().min(1),
    post_url: z.union([z.string().min(1), z.null()]),
  })
  .strict();

export const sourcesIndexSchema = z.record(z.string().min(1), sourceEntrySchema);

export type SourceEntry = z.infer<typeof sourceEntrySchema>;
export type SourcesIndex = z.infer<typeof sourcesIndexSchema>;

let cached: SourcesIndex | null = null;

/**
 * Build a guaranteed-working source link for a post title.
 *
 * Why not the raw `post_url` from `sources-index.json`?
 * The corpus's `index.json` stores post URLs constructed from filenames, but
 * Lenny's Substack truncates published post slugs at ~50 characters — every
 * sampled URL beyond that length 404s on the live site (including all four
 * golden-framework canonical URLs). Substack also exposes no public search
 * endpoint we can deep-link into. A Google site-search URL with the post
 * title resolves to the real post reliably (top result in every sampled
 * case), at the cost of one extra click through Google.
 *
 * Applied centrally in `loadSourcesIndex` so every consumer — components
 * that read `sourcesIndex[file].post_url` directly, callers of
 * `resolveSource`, and the markdown artifact renderer — picks up the
 * working link without needing to know about the slug-truncation quirk.
 */
function searchUrlForTitle(title: string): string {
  const query = encodeURIComponent(`site:lennysnewsletter.com "${title}"`);
  return `https://www.google.com/search?q=${query}`;
}

export function loadSourcesIndex(): SourcesIndex {
  if (cached) {
    return cached;
  }

  const path = join(process.cwd(), "data", "sources-index.json");

  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read sources index at ${path}: ${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Sources index at ${path} is not valid JSON: ${(err as Error).message}`,
    );
  }

  const result = sourcesIndexSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Sources index at ${path} failed schema validation:\n${JSON.stringify(
        result.error.issues,
        null,
        2,
      )}`,
    );
  }

  // Rewrite every entry's `post_url` to a working Google site-search URL.
  // This is the single chokepoint — see `searchUrlForTitle` for the why.
  // Also gives every entry (including podcasts that had `post_url: null`)
  // a clickable reference link.
  const rewritten: SourcesIndex = {};
  for (const [file, entry] of Object.entries(result.data)) {
    rewritten[file] = {
      title: entry.title,
      post_url: searchUrlForTitle(entry.title),
    };
  }

  cached = rewritten;
  return cached;
}

export function resolveSource(file: string): SourceEntry | null {
  const index = loadSourcesIndex();
  return index[file] ?? null;
}
