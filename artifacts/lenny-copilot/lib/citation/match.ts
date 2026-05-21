export const MIN_QUOTE_CHARS = 15;
export const MIN_NORMALIZED_CHARS = 12;

/**
 * Normalize text for fuzzy citation matching:
 *  - lowercase
 *  - collapse any run of non-alphanumeric characters (whitespace, punctuation,
 *    markdown markers like `*`, `_`, `#`, escaped quotes) into a single space
 *  - trim
 *
 * This makes the matcher robust to whitespace differences, smart-quote
 * substitutions, markdown formatting, and minor punctuation edits, while
 * still requiring that the model's quoted span is genuinely a substring of
 * the original excerpt.
 */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Returns true if `quote` is a substring of `excerpt` after normalization,
 * and is long enough to be a meaningful citation (not a trivial match like
 * "the" or "a").
 */
export function citationMatches(quote: string, excerpt: string): boolean {
  if (typeof quote !== "string" || typeof excerpt !== "string") return false;
  if (quote.trim().length < MIN_QUOTE_CHARS) return false;
  const nq = normalizeForMatch(quote);
  const ne = normalizeForMatch(excerpt);
  if (nq.length < MIN_NORMALIZED_CHARS) return false;
  return ne.includes(nq);
}

/**
 * Content-token coverage check. Used to close the gap where a model could
 * attach a valid `quote` to an invented `text`: every meaningful word in
 * `text` must appear either in the source excerpt or in the user's own
 * inputs (so adapted sentences that reuse user idea names are allowed).
 *
 * Returns the fraction (0..1) of meaningful tokens in `text` that are
 * present in the allowed vocabulary.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "do", "for", "from",
  "have", "has", "had", "i", "if", "in", "into", "is", "it", "its", "of", "on",
  "or", "our", "so", "that", "the", "their", "them", "then", "there", "these",
  "they", "this", "to", "was", "we", "were", "will", "with", "you", "your",
  "yours", "ll", "ve", "re", "s", "t", "d", "m", "not", "no", "yes", "than",
  "what", "which", "who", "how", "when", "where", "why", "can", "could",
  "should", "would", "may", "might", "about", "any", "all", "some", "most",
  "more", "less", "many", "much", "very", "just", "also", "too", "up", "down",
  "out", "over", "under", "before", "after", "while", "because", "since",
]);

function tokens(s: string): string[] {
  return normalizeForMatch(s)
    .split(" ")
    .filter((t) => t.length > 0);
}

export function contentCoverage(
  text: string,
  allowedSources: string[],
): number {
  const textTokens = tokens(text).filter(
    (t) => !STOPWORDS.has(t) && t.length > 2,
  );
  if (textTokens.length === 0) return 1;
  const allowed = new Set<string>();
  for (const src of allowedSources) {
    for (const tok of tokens(src)) allowed.add(tok);
  }
  let hits = 0;
  for (const tok of textTokens) {
    if (allowed.has(tok)) hits++;
  }
  return hits / textTokens.length;
}

/** Minimum fraction of content tokens in `text` that must come from
 *  excerpt + user inputs for an adapted sentence to be accepted.
 *  Tuned to allow genuine paraphrase (which scores ~0.4–0.6) while
 *  rejecting fully invented advice (which scores ~0.0–0.15). */
export const MIN_CONTENT_COVERAGE = 0.45;
