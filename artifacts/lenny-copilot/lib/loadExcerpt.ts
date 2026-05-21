import fs from "node:fs";
import path from "node:path";

export interface Excerpt {
  file: string;
  excerpt: string;
}

let cache: Record<string, Record<string, Excerpt>> | null = null;

function loadAll(): Record<string, Record<string, Excerpt>> {
  if (cache) return cache;
  const sourcesDir = path.join(process.cwd(), "data", "sources");
  const all: Record<string, Record<string, Excerpt>> = {};
  if (!fs.existsSync(sourcesDir)) {
    cache = all;
    return all;
  }
  for (const entry of fs.readdirSync(sourcesDir)) {
    if (!entry.endsWith("-excerpts.json")) continue;
    const fullPath = path.join(sourcesDir, entry);
    const raw = fs.readFileSync(fullPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, Record<string, Excerpt>>;
    Object.assign(all, parsed);
  }
  cache = all;
  return all;
}

export function loadExcerpt(
  frameworkId: string,
  stepId: string,
): Excerpt | null {
  const all = loadAll();
  return all[frameworkId]?.[stepId] ?? null;
}
