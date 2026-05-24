import fs from "node:fs";
import path from "node:path";
import { loadCatalog } from "./catalog";
import { loadCorpusFile } from "./corpus";

export interface Excerpt {
  file: string;
  excerpt: string;
}

let handAuthoredCache: Record<string, Record<string, Excerpt>> | null = null;

function loadHandAuthored(): Record<string, Record<string, Excerpt>> {
  if (handAuthoredCache) return handAuthoredCache;
  const sourcesDir = path.join(process.cwd(), "data", "sources");
  const all: Record<string, Record<string, Excerpt>> = {};
  if (!fs.existsSync(sourcesDir)) {
    handAuthoredCache = all;
    return all;
  }
  for (const entry of fs.readdirSync(sourcesDir)) {
    if (!entry.endsWith("-excerpts.json")) continue;
    const raw = fs.readFileSync(path.join(sourcesDir, entry), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, Record<string, Excerpt>>;
    Object.assign(all, parsed);
  }
  handAuthoredCache = all;
  return all;
}

/**
 * Resolve an excerpt for a given framework+step. Resolution order:
 *  1. Hand-authored excerpt from data/sources/<framework>-excerpts.json
 *     (the precise, narrow quote curated for a golden workflow).
 *  2. Full source markdown from data/corpus/ for synthesized specs
 *     (the catalog entry's first source file; the entire body is the
 *     excerpt — Sonnet picks the relevant slice via the step's prompt).
 *
 * Returns null only when the framework id is unknown to both layers.
 */
export function loadExcerpt(
  frameworkId: string,
  stepId: string,
): Excerpt | null {
  const hand = loadHandAuthored();
  const exact = hand[frameworkId]?.[stepId];
  if (exact) return exact;

  // Synthesized fallback: read the catalog entry's first source file.
  const catalog = loadCatalog();
  const entry = catalog.find((e) => e.id === frameworkId);
  if (!entry || entry.source.length === 0) return null;

  const file = entry.source[0];
  const body = loadCorpusFile(file);
  if (!body) return null;

  return { file, excerpt: body };
}
