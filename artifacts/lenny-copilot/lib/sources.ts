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

  cached = result.data;
  return cached;
}

export function resolveSource(file: string): SourceEntry | null {
  const index = loadSourcesIndex();
  const entry = index[file];
  if (!entry) return null;
  // The `post_url` in sources-index.json comes from the corpus's index.json,
  // which uses full filename-based slugs. Lenny's Substack truncates post
  // slugs at ~50 chars, so the direct URL frequently 404s. Return a Google
  // site-search URL using the post title — it lands on the real post
  // reliably (Substack has no public search endpoint).
  const query = encodeURIComponent(
    `site:lennysnewsletter.com "${entry.title}"`,
  );
  return {
    title: entry.title,
    post_url: `https://www.google.com/search?q=${query}`,
  };
}
