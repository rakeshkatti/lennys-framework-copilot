import type Anthropic from "@anthropic-ai/sdk";
import { callClaude } from "@lib/llm";
import { searchCatalog } from "@lib/search";
import {
  loadCatalog,
  loadQuestionBank,
  type CatalogEntry,
  type QuestionBankEntry,
} from "@lib/catalog";

/**
 * Result of routing a plain-English product decision to a catalog framework.
 * `framework_id` is `null` only in the cold-start case (no lexical candidates);
 * `nearest` then carries the closest related framework ids for the UI to show.
 */
export interface RouteResult {
  framework_id: string | null;
  confidence: number;
  reasoning: string;
  alternatives: string[];
  nearest: string[];
}

/** How many lexical candidates to surface to the model. */
const CANDIDATE_LIMIT = 15;
/** How many few-shot examples to draw from the question bank. */
const FEW_SHOT_COUNT = 8;

/** Compact candidate shape handed to the model. */
interface Candidate {
  id: string;
  name: string;
  category: string;
  decision_served: string;
}

const TOOL: Anthropic.Tool = {
  name: "select_framework",
  description:
    "Select the single best-matching framework for the user's product decision from the provided candidate list.",
  input_schema: {
    type: "object",
    properties: {
      framework_id: {
        type: "string",
        description:
          "The id of the best-matching framework. MUST be one of the candidate ids.",
      },
      confidence: {
        type: "number",
        description:
          "Confidence the chosen framework is the right match, from 0 (guess) to 1 (certain).",
      },
      reasoning: {
        type: "string",
        description:
          "One or two plain-language sentences explaining why this framework fits the decision.",
      },
      alternatives: {
        type: "array",
        items: { type: "string" },
        description:
          "Up to 2 other candidate ids worth considering, best first. May be empty.",
      },
    },
    required: ["framework_id", "confidence", "reasoning", "alternatives"],
  },
};

const SYSTEM_PROMPT = [
  "You are the routing layer of Lenny's Framework Copilot.",
  "A user describes a product, growth, strategy, or career decision in plain English.",
  "Your job: pick the single framework from a provided candidate list that best helps them make that decision.",
  "",
  "RULES:",
  "1. You MUST choose `framework_id` from the candidate ids given in the user message. Never invent an id.",
  "2. Every id in `alternatives` MUST also be a candidate id, and must differ from `framework_id`. Include at most 2; an empty list is fine.",
  "3. Set `confidence` honestly: high (>=0.8) only when the decision clearly maps to the framework's purpose; low (<0.6) when the candidates are only loosely related.",
  "4. `reasoning` is one or two short sentences a product manager would find useful — reference what the decision is and why the framework fits.",
  "5. Call the `select_framework` tool exactly once. Do not write any prose outside the tool call.",
].join("\n");

/** Pick a stable, evenly-spread sample of few-shot examples from the bank. */
function pickFewShots(bank: QuestionBankEntry[], count: number): QuestionBankEntry[] {
  if (bank.length <= count) return bank;
  const step = bank.length / count;
  const picked: QuestionBankEntry[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(bank[Math.floor(i * step)]);
  }
  return picked;
}

/** Build the user message: the decision, the candidates, and few-shot examples. */
function buildUserPrompt(text: string, candidates: Candidate[]): string {
  const fewShots = pickFewShots(loadQuestionBank(), FEW_SHOT_COUNT)
    .map(
      (q, i) =>
        `${i + 1}. Decision: "${q.question}"\n   framework_id: ${q.framework_id}`,
    )
    .join("\n");

  return [
    "USER DECISION:",
    text.trim(),
    "",
    `CANDIDATE FRAMEWORKS (choose framework_id and alternatives only from these ${candidates.length} ids):`,
    JSON.stringify(candidates, null, 2),
    "",
    "EXAMPLES (how past decisions mapped to frameworks):",
    fewShots,
    "",
    "Now select the best framework for the USER DECISION above by calling select_framework.",
  ].join("\n");
}

/** Look up the compact candidate records for a list of framework ids. */
function toCandidates(ids: string[], catalog: CatalogEntry[]): Candidate[] {
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const out: Candidate[] = [];
  for (const id of ids) {
    const entry = byId.get(id);
    if (entry) {
      out.push({
        id: entry.id,
        name: entry.name,
        category: entry.category,
        decision_served: entry.decision_served,
      });
    }
  }
  return out;
}

interface ToolSelection {
  framework_id: string;
  confidence: number;
  reasoning: string;
  alternatives: string[];
}

/** Extract and shape the tool input from a Claude message, or null if absent. */
function parseToolSelection(message: Anthropic.Message): ToolSelection | null {
  const toolBlock = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) return null;

  const input = toolBlock.input as Partial<ToolSelection> | undefined;
  if (!input || typeof input.framework_id !== "string") return null;

  const confidence =
    typeof input.confidence === "number" && Number.isFinite(input.confidence)
      ? Math.min(1, Math.max(0, input.confidence))
      : 0;
  const reasoning =
    typeof input.reasoning === "string" && input.reasoning.trim().length > 0
      ? input.reasoning.trim()
      : "Matched to the candidate that best fits the decision.";
  const alternatives = Array.isArray(input.alternatives)
    ? input.alternatives.filter((a): a is string => typeof a === "string")
    : [];

  return {
    framework_id: input.framework_id,
    confidence,
    reasoning,
    alternatives,
  };
}

/** Lexical-only fallback used when the model is unavailable or unusable. */
function lexicalFallback(candidates: string[]): RouteResult {
  return {
    framework_id: candidates[0] ?? null,
    confidence: 0,
    reasoning: "Lexical match (model unavailable).",
    alternatives: candidates.slice(1, 3),
    nearest: [],
  };
}

/**
 * Route a plain-English product decision to a single catalog framework.
 *
 * Pipeline:
 *  1. Lexical retrieval (`searchCatalog`) narrows 121 frameworks to <=15.
 *     With no candidates we return a cold-start result.
 *  2. Claude Haiku picks the best candidate via a forced `select_framework`
 *     tool call, with question-bank few-shots for grounding.
 *  3. The pick and its alternatives are constrained to the candidate set;
 *     anything outside it is dropped.
 *
 * Resilient by construction: any LLM error, an empty tool call, or a pick
 * outside the candidate set degrades to the top lexical candidate with
 * `confidence: 0` rather than throwing.
 */
export async function routeDecision(text: string): Promise<RouteResult> {
  const candidates = searchCatalog(text, CANDIDATE_LIMIT);

  // Cold start: nothing lexically matched the decision.
  if (candidates.length === 0) {
    return {
      framework_id: null,
      confidence: 0,
      reasoning:
        "No framework in the catalog clearly matches this decision. Try describing the decision in more detail.",
      alternatives: [],
      nearest: [],
    };
  }

  const candidateSet = new Set(candidates);
  const catalog = loadCatalog();
  const candidateRecords = toCandidates(candidates, catalog);

  try {
    const message = await callClaude({
      kind: "router",
      system: SYSTEM_PROMPT,
      cacheableSystem: true,
      tools: [TOOL],
      toolChoice: { type: "tool", name: TOOL.name },
      messages: [
        { role: "user", content: buildUserPrompt(text, candidateRecords) },
      ],
    });

    const selection = parseToolSelection(message);
    if (!selection || !candidateSet.has(selection.framework_id)) {
      return lexicalFallback(candidates);
    }

    // Constrain alternatives to the candidate set, excluding the pick itself.
    const alternatives: string[] = [];
    for (const id of selection.alternatives) {
      if (
        candidateSet.has(id) &&
        id !== selection.framework_id &&
        !alternatives.includes(id)
      ) {
        alternatives.push(id);
      }
      if (alternatives.length >= 2) break;
    }

    return {
      framework_id: selection.framework_id,
      confidence: selection.confidence,
      reasoning: selection.reasoning,
      alternatives,
      nearest: [],
    };
  } catch {
    return lexicalFallback(candidates);
  }
}
