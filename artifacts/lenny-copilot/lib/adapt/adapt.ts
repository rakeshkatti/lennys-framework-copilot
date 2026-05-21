import Anthropic from "@anthropic-ai/sdk";
import type { Step } from "@lib/spec";
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
}

const MODEL = "claude-sonnet-4-6";

function buildSystemPrompt(): string {
  return [
    "You are adapting fixed product-management guidance to a user's specific situation.",
    "",
    "RULES:",
    "1. You MUST NOT introduce any advice, frameworks, opinions, recommendations, statistics, or examples that are not already present in the EXCERPT.",
    "2. You MAY rephrase the excerpt, condense it, or weave the user's concrete inputs into the points the excerpt already makes.",
    "3. For EVERY sentence you output, you MUST include a `quote` field: a verbatim substring of the EXCERPT (at least " +
      MIN_QUOTE_CHARS +
      " characters, copied character-for-character from the excerpt — not paraphrased) that supports the sentence.",
    "4. Output 2 to 4 sentences total. Keep them concise and directly actionable for the user.",
    "5. Call the submit_adapted_guidance tool exactly once. Do not write any prose outside the tool call.",
  ].join("\n");
}

function buildUserPrompt(
  step: Step,
  excerpt: string,
  inputsSoFar: Record<string, unknown>,
): string {
  const inputsJson = JSON.stringify(inputsSoFar, null, 2);
  return [
    "EXCERPT (the only allowed source of advice):",
    "---",
    excerpt,
    "---",
    "",
    `STEP: ${step.title}`,
    `STEP PROMPT TO USER: ${step.prompt}`,
    "",
    "USER INPUTS SO FAR (JSON):",
    inputsJson,
    "",
    "Adapt the excerpt's guidance to this user's specific situation. Substitute their concrete ideas/numbers where natural. Do not invent.",
  ].join("\n");
}

const TOOL: Anthropic.Tool = {
  name: "submit_adapted_guidance",
  description:
    "Submit 2-4 adapted guidance sentences, each with a verbatim supporting quote from the excerpt.",
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
    },
    required: ["sentences"],
  },
};

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function callClaudeOnce(
  step: Step,
  excerpt: string,
  inputsSoFar: Record<string, unknown>,
): Promise<AdaptedSentence[] | null> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: buildSystemPrompt(),
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: buildUserPrompt(step, excerpt, inputsSoFar) }],
  });

  const toolBlock = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) return null;
  const input = toolBlock.input as { sentences?: unknown };
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
  return sentences;
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
): Promise<AdaptResult> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callClaudeOnce(step, excerpt, inputsSoFar);
      if (!raw || raw.length === 0) {
        lastError = new Error("no sentences returned");
        continue;
      }
      const allowedVocab = [excerpt, JSON.stringify(inputsSoFar)];
      const cited = raw.filter(
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
      return {
        sentences: cited,
        fallback: false,
        source: { file: excerptFile },
      };
    } catch (err) {
      lastError = err;
    }
  }
  const fb = fallbackFrom(step, excerptFile);
  fb.reason = lastError instanceof Error ? lastError.message : String(lastError);
  return fb;
}
