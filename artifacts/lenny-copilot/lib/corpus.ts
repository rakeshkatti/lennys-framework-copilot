import { readFileSync } from "node:fs";
import { join, normalize, sep } from "node:path";

/**
 * Read a corpus markdown file by its catalog source path (e.g.
 * `"newsletters/introducing-drice-a-modern-prioritization-framework.md"`),
 * strip the YAML frontmatter, and return the body. Returns `null` for
 * missing files or path-traversal attempts.
 *
 * Module-scope cache: each path is read once per process.
 */

const CORPUS_ROOT = join(process.cwd(), "data", "corpus");
const cache = new Map<string, string | null>();

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

function stripFrontmatter(raw: string): string {
  const match = FRONTMATTER.exec(raw);
  return match ? raw.slice(match[0].length) : raw;
}

export function loadCorpusFile(relativePath: string): string | null {
  if (cache.has(relativePath)) return cache.get(relativePath)!;

  // Path-traversal guard: the normalized path must stay inside CORPUS_ROOT
  // and must not begin with ".." or contain an absolute segment.
  const normalized = normalize(relativePath);
  if (normalized.startsWith("..") || normalized.includes(`..${sep}`)) {
    cache.set(relativePath, null);
    return null;
  }

  const full = join(CORPUS_ROOT, normalized);
  // Belt-and-suspenders: the resolved path must still live under CORPUS_ROOT.
  if (!full.startsWith(CORPUS_ROOT + sep) && full !== CORPUS_ROOT) {
    cache.set(relativePath, null);
    return null;
  }

  let raw: string;
  try {
    raw = readFileSync(full, "utf-8");
  } catch {
    cache.set(relativePath, null);
    return null;
  }

  const body = stripFrontmatter(raw).trim();
  cache.set(relativePath, body);
  return body;
}
