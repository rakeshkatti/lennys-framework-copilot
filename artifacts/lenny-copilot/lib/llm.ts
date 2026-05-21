import Anthropic from "@anthropic-ai/sdk";

/**
 * Default models per call kind. Routing uses the cheaper/faster Haiku model;
 * step guidance uses Sonnet. Both can be overridden via env vars.
 */
const DEFAULT_MODEL_ROUTER = "claude-haiku-4-5-20251001";
const DEFAULT_MODEL_STEP = "claude-sonnet-4-6";

export type CallKind = "router" | "step";

/** A system prompt: either a plain string or an array of system blocks. */
export type SystemPrompt = string | Anthropic.TextBlockParam[];

export interface CallClaudeOptions {
  /** Selects which model to use (`router` → Haiku, `step` → Sonnet). */
  kind: CallKind;
  /** System prompt — plain string or pre-built system blocks. */
  system: SystemPrompt;
  /** Conversation messages passed straight to the SDK. */
  messages: Anthropic.MessageParam[];
  /** Optional tool definitions. */
  tools?: Anthropic.Tool[];
  /** Optional tool-choice constraint. */
  toolChoice?: Anthropic.MessageCreateParams["tool_choice"];
  /** Max output tokens (default 8192). */
  maxTokens?: number;
  /**
   * When true, the system content is sent as a block array with
   * `cache_control: { type: "ephemeral" }` on the last system block so
   * Anthropic prompt caching applies to the static context.
   */
  cacheableSystem?: boolean;
}

const DEFAULT_MAX_TOKENS = 8192;

/** Resolve the model id for a given call kind, honoring env overrides. */
export function modelForKind(kind: CallKind): string {
  if (kind === "router") {
    return process.env.MODEL_ROUTER ?? DEFAULT_MODEL_ROUTER;
  }
  return process.env.MODEL_STEP ?? DEFAULT_MODEL_STEP;
}

/**
 * Convert a system prompt into the SDK's `system` parameter shape, optionally
 * marking the last block as cacheable for Anthropic prompt caching.
 */
function buildSystem(
  system: SystemPrompt,
  cacheableSystem: boolean,
): string | Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] =
    typeof system === "string"
      ? [{ type: "text", text: system }]
      : system.map((block) => ({ ...block }));

  if (!cacheableSystem) {
    return typeof system === "string" ? system : blocks;
  }

  if (blocks.length === 0) {
    return blocks;
  }

  const lastIndex = blocks.length - 1;
  blocks[lastIndex] = {
    ...blocks[lastIndex],
    cache_control: { type: "ephemeral" },
  };
  return blocks;
}

/**
 * Thin provider adapter over `@anthropic-ai/sdk`. The Anthropic client is
 * created lazily inside this call, so importing this module never throws when
 * `ANTHROPIC_API_KEY` is absent — only the actual network call fails.
 */
export async function callClaude(
  opts: CallClaudeOptions,
): Promise<Anthropic.Message> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: modelForKind(opts.kind),
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: buildSystem(opts.system, opts.cacheableSystem ?? false),
    messages: opts.messages,
  };

  if (opts.tools) {
    params.tools = opts.tools;
  }
  if (opts.toolChoice) {
    params.tool_choice = opts.toolChoice;
  }

  return client.messages.create(params);
}
