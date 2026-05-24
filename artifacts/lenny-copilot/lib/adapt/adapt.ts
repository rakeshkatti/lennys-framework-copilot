import type Anthropic from "@anthropic-ai/sdk";
import type { Step } from "@lib/spec";
import { callClaude } from "@lib/llm";
import {
  citationMatches,
  contentCoverage,
  MIN_CONTENT_COVERAGE,
  MIN_QUOTE_CHARS,
} from "@lib/citation/match";

export interface AdaptedSentence {
  text: string;
  quote: string;
}

export interface AdaptResult {
  sentences: AdaptedSentence[];
  fallback: boolean;
  source: { file: string };
  reason?: string;
  /** Optional Sonnet-suggested options for the user to click into the
   *  textarea. Present only when the step naturally invites a small-set
   *  choice grounded in the EXCERPT. Capped at 6. */
  suggested_options?: string[];
}

function buildSystemPrompt(
  excerpt: string,
  frameworkName: string,
  frameworkSummary: string,
): string {
  return [
    "You are adapting fixed product-management guidance to a user's specific situation.",
    "",
    `FRAMEWORK: ${frameworkName}`,
    `WHAT THIS FRAMEWORK IS: ${frameworkSummary}`,
    "",
    "EXCERPT (the only allowed source of advice — quote only from this):",
    "---",
    excerpt,
    "---",
    "",
    "RULES:",
    "1. You MUST NOT introduce any advice, frameworks, opinions, recommendations, statistics, or examples that are not already present in the EXCERPT.",
    "2. You MAY rephrase the excerpt, condense it, or weave the user's concrete inputs into the points the excerpt already makes.",
    "3. For EVERY sentence you output, you MUST include a `quote` field: a verbatim substring of the EXCERPT (at least " +
      MIN_QUOTE_CHARS +
      " characters, copied character-for-character from the excerpt — not paraphrased) that supports the sentence.",
    "4. Output 2 to 4 sentences total. Keep them concise and directly actionable for the user.",
    "5. When the EXCERPT is long, focus on the part most relevant to the STEP described in the user message; ignore unrelated sections.",
    "6. Call the submit_adapted_guidance tool exactly once. Do not write any prose outside the tool call.",
    "7. If THIS STEP naturally invites a choice from a small set (3 to 6) of options that appear in the EXCERPT, include them as short strings (max ~60 chars each) in `suggested_options`. Otherwise omit the field. Do NOT invent options that aren't supported by the EXCERPT.",
  ].join("\n");
}

function buildUserPrompt(
  step: Step,
  inputsSoFar: Record<string, unknown>,
): string {
  const inputsJson = JSON.stringify(inputsSoFar, null, 2);
  return [
    `STEP TITLE: ${step.title}`,
    `STEP PROMPT TO USER: ${step.prompt}`,
    "",
    "USER INPUTS SO FAR (JSON):",
    inputsJson,
    "",
    `Apply the EXCERPT's advice on "${step.title}" to this user's specific situation. Substitute their concrete ideas/numbers where natural. Do not invent.`,
  ].join("\n");
}

const TOOL: Anthropic.Tool = {
  name: "submit_adapted_guidance",
  description:
    "Submit 2-4 adapted guidance sentences, each with a verbatim supporting quote from the excerpt. Optionally include 3-6 short suggested_options when the step invites a small-set choice grounded in the excerpt.",
  input_schema: {
    type: "object",
    properties: {
      sentences: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "One adapted sentence in plain prose.",
            },
            quote: {
              type: "string",
              description:
                "Verbatim substring of the excerpt (≥15 characters, copied exactly) that supports `text`.",
            },
          },
          required: ["text", "quote"],
        },
      },
      suggested_options: {
        type: "array",
        description:
          "Optional. 3-6 short option strings (max ~60 chars each) the user can click into the textarea. Include ONLY when the step invites a small-set choice and the options are visible in the excerpt.",
        items: { type: "string" },
      },
    },
    required: ["sentences"],
  },
};

async function callClaudeOnce(
  step: Step,
  excerpt: string,
  inputsSoFar: Record<string, unknown>,
  context: { frameworkName: string; frameworkSummary: string },
): Promise<{ sentences: AdaptedSentence[]; suggested_options: string[] } | null> {
  const message = await callClaude({
    kind: "step",
    // The citation rules + excerpt + framework context are static per
    // framework (not per step) — caching them amortizes the long-markdown
    // cost across all steps of a synthesized workflow.
    system: buildSystemPrompt(excerpt, context.frameworkName, context.frameworkSummary),
    cacheableSystem: true,
    tools: [TOOL],
    toolChoice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: buildUserPrompt(step, inputsSoFar) }],
  });

  const toolBlock = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) return null;
  const input = toolBlock.input as {
    sentences?: unknown;
    suggested_options?: unknown;
  };
  if (!input || !Array.isArray(input.sentences)) return null;

  const sentences: AdaptedSentence[] = [];
  for (const raw of input.sentences) {
    if (
      raw &&
      typeof raw === "object" &&
      typeof (raw as AdaptedSentence).text === "string" &&
      typeof (raw as AdaptedSentence).quote === "string"
    ) {
      const s = raw as AdaptedSentence;
      if (s.text.trim().length > 0 && s.quote.trim().length > 0) {
        sentences.push({ text: s.text.trim(), quote: s.quote.trim() });
      }
    }
  }

  // suggested_options is optional; safely extract trimmed non-empty strings,
  // capped at 6. Drop entirely if the field isn't an array.
  const suggested_options: string[] = [];
  if (Array.isArray(input.suggested_options)) {
    for (const raw of input.suggested_options) {
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed.length > 0) suggested_options.push(trimmed);
      }
      if (suggested_options.length >= 6) break;
    }
  }

  return { sentences, suggested_options };
}

function fallbackFrom(step: Step, file: string): AdaptResult {
  return {
    sentences: [{ text: step.guidance.text, quote: step.guidance.text }],
    fallback: true,
    source: { file },
  };
}

/**
 * Adapt a step's guidance to the user's inputs using Claude with strict
 * citation enforcement. The route NEVER returns un-sourced text:
 *  - retries the Claude call once on error
 *  - drops any returned sentence whose quote doesn't fuzzy-match the excerpt
 *  - falls back to the verbatim hand-vetted guidance text if anything fails
 */
export async function adaptStepGuidance(
  step: Step,
  excerpt: string,
  excerptFile: string,
  inputsSoFar: Record<string, unknown>,
  context: { frameworkName: string; frameworkSummary: string },
): Promise<AdaptResult> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callClaudeOnce(step, excerpt, inputsSoFar, context);
      if (!raw || raw.sentences.length === 0) {
        lastError = new Error("no sentences returned");
        continue;
      }
      const allowedVocab = [excerpt, JSON.stringify(inputsSoFar)];
      const cited = raw.sentences.filter(
        (s) =>
          citationMatches(s.quote, excerpt) &&
          contentCoverage(s.text, allowedVocab) >= MIN_CONTENT_COVERAGE,
      );
      if (cited.length === 0) {
        lastError = new Error(
          "all sentences failed citation or content-coverage check",
        );
        continue;
      }
      const result: AdaptResult = {
        sentences: cited,
        fallback: false,
        source: { file: excerptFile },
      };
      if (raw.suggested_options.length > 0) {
        result.suggested_options = raw.suggested_options;
      }
      return result;
    } catch (err) {
      lastError = err;
    }
  }
  const fb = fallbackFrom(step, excerptFile);
  fb.reason = lastError instanceof Error ? lastError.message : String(lastError);
  return fb;
}
