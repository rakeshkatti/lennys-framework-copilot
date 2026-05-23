import type Anthropic from "@anthropic-ai/sdk";
import { callClaude } from "@lib/llm";
import type { CatalogEntry } from "@lib/catalog";

/**
 * Result of a triangulation pass. Always returned — even on failure — so the
 * caller never crashes the Done view. When `fallback` is true, the two text
 * blocks may be empty; the UI then renders a "couldn't load the challenger"
 * note in their place.
 */
export interface TriangulationResult {
  challenger_id: string;
  challenger_name: string;
  counterargument: string;
  what_would_change_my_mind: string;
  fallback: boolean;
  reason?: string;
}

/**
 * Deliberately-contrasting category map for the fallback path of
 * `pickChallenger`. Each key maps to one or more categories that ask
 * fundamentally different questions about a product decision. The map is
 * symmetric — keys appear on both sides where it makes sense — so the
 * primary's category is always a usable starting point.
 *
 * The map is intentionally small and editable; for any unmapped category we
 * fall back to "any catalog entry from a different category."
 */
const CATEGORY_CONTRAST: Record<string, string[]> = {
  Growth: ["Strategy", "Product-Market Fit"],
  Strategy: ["Growth", "Metrics & Benchmarks"],
  "Prioritization & Planning": ["Research & Discovery", "Strategy"],
  "Research & Discovery": ["Prioritization & Planning", "Metrics & Benchmarks"],
  "Product-Market Fit": ["GTM & Sales", "Growth"],
  "GTM & Sales": ["Product-Market Fit", "Research & Discovery"],
  "Metrics & Benchmarks": ["Strategy", "Research & Discovery"],
  Pricing: ["Product-Market Fit", "Research & Discovery"],
  Hiring: ["Team & Operating Model", "Strategy"],
  "Team & Operating Model": ["Hiring", "Strategy"],
  "Communication & Influence": ["Strategy", "Team & Operating Model"],
  "Career & Self-management": ["Strategy", "Team & Operating Model"],
  Fundraising: ["Strategy", "Product-Market Fit"],
};

/**
 * Pick a challenger framework whose lens differs from the primary's category.
 *
 * Selection order:
 *  1. The first `alternatives` id whose catalog entry has a *different* category
 *     than the primary. (alternatives are already in router-ranked order, best
 *     first, so this gives us the most relevant contrasting framework.)
 *  2. If no alternative qualifies: walk `CATEGORY_CONTRAST` for the primary's
 *     category and pick the first catalog entry whose category is in that
 *     contrast set (and which isn't the primary).
 *  3. Otherwise: any catalog entry whose category differs from the primary's.
 *
 * Returns `null` only when the catalog has no usable entry — essentially never.
 * Never returns `primaryId`.
 */
export function pickChallenger(
  primaryId: string,
  alternatives: string[],
  catalog: CatalogEntry[],
): string | null {
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const primary = byId.get(primaryId);
  if (!primary) return null;
  const primaryCategory = primary.category;

  // 1. Best-ranked alternative from a different category.
  for (const id of alternatives) {
    if (id === primaryId) continue;
    const entry = byId.get(id);
    if (entry && entry.category !== primaryCategory) {
      return entry.id;
    }
  }

  // 2. Contrast-map fallback.
  const contrastCategories = CATEGORY_CONTRAST[primaryCategory] ?? [];
  for (const cat of contrastCategories) {
    const found = catalog.find(
      (e) => e.category === cat && e.id !== primaryId,
    );
    if (found) return found.id;
  }

  // 3. Last resort: any framework from any other category.
  const anyOther = catalog.find(
    (e) => e.category !== primaryCategory && e.id !== primaryId,
  );
  return anyOther ? anyOther.id : null;
}

/** Truncate the primary artifact markdown to keep the LLM prompt bounded. */
const MAX_ARTIFACT_CHARS = 3000;
function truncateArtifact(md: string): string {
  if (md.length <= MAX_ARTIFACT_CHARS) return md;
  return md.slice(0, MAX_ARTIFACT_CHARS) + "\n\n[...truncated]";
}

function buildSystemPrompt(): string {
  return [
    "You are stress-testing a product decision by re-examining it through a",
    "*deliberately different* framework's lens. You will be given:",
    "  - the PRIMARY framework's name and the user's filled-in artifact",
    "  - the user's raw inputs (JSON)",
    "  - the CHALLENGER framework's catalog entry (name, summary, key_steps,",
    "    decision_served)",
    "",
    "RULES:",
    "1. Use ONLY the challenger framework's own ideas — its name, summary,",
    "   key_steps, and decision_served — as your advisory vocabulary. Do not",
    "   invent new frameworks, statistics, or external advice.",
    "2. Produce two concrete blocks of plain prose (markdown allowed for",
    "   emphasis/lists):",
    "   - counterargument: 1-3 short paragraphs. Where is the user's primary",
    "     recommendation weak when viewed through the challenger's lens? Be",
    "     specific to the user's actual inputs — quote or reference them.",
    "   - what_would_change_my_mind: 1-2 short paragraphs. What new evidence,",
    "     observation, or condition would flip your recommendation toward the",
    "     challenger? Make it testable and concrete.",
    "3. Do NOT restate the primary recommendation. Do NOT hedge. Take the",
    "   challenger's viewpoint seriously.",
    "4. Call the submit_triangulation tool exactly once. Do not write any",
    "   prose outside the tool call.",
  ].join("\n");
}

function buildUserPrompt(opts: {
  primary: CatalogEntry;
  primaryArtifactMarkdown: string;
  userInputs: Record<string, unknown>;
  challenger: CatalogEntry;
}): string {
  const inputsJson = JSON.stringify(opts.userInputs, null, 2);
  const challengerJson = JSON.stringify(
    {
      id: opts.challenger.id,
      name: opts.challenger.name,
      category: opts.challenger.category,
      decision_served: opts.challenger.decision_served,
      summary: opts.challenger.summary,
      key_steps: opts.challenger.key_steps,
    },
    null,
    2,
  );
  return [
    `PRIMARY FRAMEWORK: ${opts.primary.name} (${opts.primary.category})`,
    "",
    "PRIMARY ARTIFACT (the user's filled-in recommendation):",
    "---",
    truncateArtifact(opts.primaryArtifactMarkdown),
    "---",
    "",
    "USER INPUTS (JSON):",
    inputsJson,
    "",
    "CHALLENGER FRAMEWORK (your only allowed advisory vocabulary):",
    challengerJson,
    "",
    "Now produce the counterargument and what_would_change_my_mind blocks by",
    "calling submit_triangulation.",
  ].join("\n");
}

const TOOL: Anthropic.Tool = {
  name: "submit_triangulation",
  description:
    "Submit the two triangulation blocks: a challenger-lens counterargument and a what-would-change-my-mind synthesis.",
  input_schema: {
    type: "object",
    properties: {
      counterargument: {
        type: "string",
        description:
          "1-3 short paragraphs of plain prose: where the primary recommendation is weak through the challenger's lens. Markdown allowed.",
      },
      what_would_change_my_mind: {
        type: "string",
        description:
          "1-2 short paragraphs of plain prose: what new evidence or condition would flip the recommendation. Markdown allowed.",
      },
    },
    required: ["counterargument", "what_would_change_my_mind"],
  },
};

interface ToolPayload {
  counterargument: string;
  what_would_change_my_mind: string;
}

function parseToolPayload(message: Anthropic.Message): ToolPayload | null {
  const toolBlock = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) return null;
  const input = toolBlock.input as Partial<ToolPayload> | undefined;
  if (!input) return null;
  const counterargument =
    typeof input.counterargument === "string"
      ? input.counterargument.trim()
      : "";
  const what =
    typeof input.what_would_change_my_mind === "string"
      ? input.what_would_change_my_mind.trim()
      : "";
  if (counterargument.length === 0 || what.length === 0) return null;
  return { counterargument, what_would_change_my_mind: what };
}

async function callOnce(opts: {
  primary: CatalogEntry;
  primaryArtifactMarkdown: string;
  userInputs: Record<string, unknown>;
  challenger: CatalogEntry;
}): Promise<ToolPayload | null> {
  const message = await callClaude({
    kind: "step",
    // System rules are static across triangulation calls — cache them.
    system: buildSystemPrompt(),
    cacheableSystem: true,
    tools: [TOOL],
    toolChoice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: buildUserPrompt(opts) }],
  });
  return parseToolPayload(message);
}

/**
 * Run a single triangulation pass. Retries once on error/empty; on final
 * failure returns a fallback result with empty text blocks rather than
 * throwing — the UI degrades gracefully.
 */
export async function triangulate(opts: {
  primary: CatalogEntry;
  primaryArtifactMarkdown: string;
  userInputs: Record<string, unknown>;
  challenger: CatalogEntry;
}): Promise<TriangulationResult> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const payload = await callOnce(opts);
      if (!payload) {
        lastError = new Error("empty or invalid tool response");
        continue;
      }
      return {
        challenger_id: opts.challenger.id,
        challenger_name: opts.challenger.name,
        counterargument: payload.counterargument,
        what_would_change_my_mind: payload.what_would_change_my_mind,
        fallback: false,
      };
    } catch (err) {
      lastError = err;
    }
  }
  return {
    challenger_id: opts.challenger.id,
    challenger_name: opts.challenger.name,
    counterargument: "",
    what_would_change_my_mind: "",
    fallback: true,
    reason:
      lastError instanceof Error ? lastError.message : String(lastError ?? ""),
  };
}
