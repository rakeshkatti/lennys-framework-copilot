import MiniSearch from "minisearch";
import { loadCatalog, loadQuestionBank } from "./catalog";

interface IndexedDoc {
  /** Unique MiniSearch document id, e.g. `cat:<id>` or `q:<index>`. */
  id: string;
  /** Document kind. */
  type: "catalog" | "question";
  /** The catalog framework id this doc maps to. */
  frameworkId: string;
  /** Catalog-only fields. */
  name?: string;
  summary?: string;
  decision_served?: string;
  key_steps?: string;
  /** Question-only field. */
  question?: string;
}

let cachedIndex: MiniSearch<IndexedDoc> | null = null;

function buildIndex(): MiniSearch<IndexedDoc> {
  const catalog = loadCatalog();
  const questionBank = loadQuestionBank();

  const docs: IndexedDoc[] = [];

  for (const entry of catalog) {
    docs.push({
      id: `cat:${entry.id}`,
      type: "catalog",
      frameworkId: entry.id,
      name: entry.name,
      summary: entry.summary,
      decision_served: entry.decision_served,
      key_steps: entry.key_steps.join(" "),
    });
  }

  questionBank.forEach((entry, index) => {
    docs.push({
      id: `q:${index}`,
      type: "question",
      frameworkId: entry.framework_id,
      question: entry.question,
    });
  });

  const index = new MiniSearch<IndexedDoc>({
    fields: ["name", "summary", "decision_served", "key_steps", "question"],
    storeFields: ["type", "frameworkId"],
  });
  index.addAll(docs);

  return index;
}

function getIndex(): MiniSearch<IndexedDoc> {
  if (cachedIndex === null) {
    cachedIndex = buildIndex();
  }
  return cachedIndex;
}

/**
 * Lexical search over the catalog and question bank. Returns the top `limit`
 * candidate catalog framework ids, de-duplicated and preserving first-seen rank.
 */
export function searchCatalog(query: string, limit = 15): string[] {
  const results = getIndex().search(query, { prefix: true, fuzzy: 0.2 });

  const seen = new Set<string>();
  const ids: string[] = [];

  for (const hit of results) {
    const frameworkId = (hit as unknown as { frameworkId: string }).frameworkId;
    if (!seen.has(frameworkId)) {
      seen.add(frameworkId);
      ids.push(frameworkId);
      if (ids.length >= limit) break;
    }
  }

  return ids;
}
