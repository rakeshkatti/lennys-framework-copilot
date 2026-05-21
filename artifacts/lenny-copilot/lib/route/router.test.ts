import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchCatalog } from "@lib/search";
import { loadQuestionBank } from "@lib/catalog";

/**
 * Deterministic router eval — runs in CI with no live LLM.
 *
 * Two layers are checked:
 *
 *  1. `searchCatalog(question)` recall — does the lexical retrieval layer
 *     surface the expected framework in its top 15 for every known question?
 *     This is the regression guard for the MiniSearch index wiring.
 *
 *  2. Truncated-query recall — the same check but with each question cut to
 *     its first 8 words. This is non-circular: the index can no longer echo
 *     the exact stored string, so it proves the lexical layer generalizes to
 *     partial / paraphrased input rather than just memorizing.
 *
 * The design §11 target is recall >= 0.85; both layers must clear it.
 */

const RECALL_TARGET = 0.85;
const CANDIDATE_LIMIT = 15;

function recallOver(transform: (question: string) => string): {
  recall: number;
  hits: number;
  total: number;
  misses: string[];
} {
  const bank = loadQuestionBank();
  let hits = 0;
  const misses: string[] = [];

  for (const entry of bank) {
    const candidates = searchCatalog(transform(entry.question), CANDIDATE_LIMIT);
    if (candidates.includes(entry.framework_id)) {
      hits++;
    } else {
      misses.push(entry.framework_id);
    }
  }

  return { recall: hits / bank.length, hits, total: bank.length, misses };
}

describe("router eval — lexical recall", () => {
  it("recalls the expected framework for full questions (>= 0.85)", () => {
    const { recall, hits, total } = recallOver((q) => q);
    // eslint-disable-next-line no-console
    console.log(
      `[router eval] full-question recall: ${(recall * 100).toFixed(1)}% (${hits}/${total})`,
    );
    expect(recall).toBeGreaterThanOrEqual(RECALL_TARGET);
  });

  it("recalls the expected framework for truncated questions (>= 0.85)", () => {
    const truncate = (q: string) => q.split(/\s+/).slice(0, 8).join(" ");
    const { recall, hits, total, misses } = recallOver(truncate);
    // eslint-disable-next-line no-console
    console.log(
      `[router eval] truncated-question recall: ${(recall * 100).toFixed(1)}% (${hits}/${total})` +
        (misses.length ? ` — missed: ${[...new Set(misses)].join(", ")}` : ""),
    );
    expect(recall).toBeGreaterThanOrEqual(RECALL_TARGET);
  });
});

/* ------------------------------------------------------------------------ *
 * routeDecision unit tests — `callClaude` mocked for determinism.
 * ------------------------------------------------------------------------ */

const callClaudeMock = vi.fn();
vi.mock("@lib/llm", () => ({
  callClaude: (...args: unknown[]) => callClaudeMock(...args),
}));

import { routeDecision } from "./router";

/** Build a Claude message containing a single `select_framework` tool call. */
function toolReply(input: unknown) {
  return {
    content: [
      { type: "tool_use", id: "t1", name: "select_framework", input },
    ],
  };
}

beforeEach(() => {
  callClaudeMock.mockReset();
});

describe("routeDecision — candidate constraining", () => {
  it("returns the model's pick when it is within the candidate set", async () => {
    const candidates = searchCatalog(
      "which projects should the team build next this quarter",
      CANDIDATE_LIMIT,
    );
    expect(candidates).toContain("drice");

    callClaudeMock.mockResolvedValueOnce(
      toolReply({
        framework_id: "drice",
        confidence: 0.92,
        reasoning: "DRICE prioritizes a quarter's roadmap.",
        alternatives: candidates.filter((id) => id !== "drice").slice(0, 2),
      }),
    );

    const result = await routeDecision(
      "which projects should the team build next this quarter",
    );
    expect(result.framework_id).toBe("drice");
    expect(result.confidence).toBeCloseTo(0.92);
    expect(result.alternatives.length).toBeLessThanOrEqual(2);
  });

  it("drops a framework_id outside the candidate set and falls back to lexical", async () => {
    const candidates = searchCatalog(
      "which projects should the team build next this quarter",
      CANDIDATE_LIMIT,
    );
    callClaudeMock.mockResolvedValueOnce(
      toolReply({
        framework_id: "totally-made-up-framework",
        confidence: 0.99,
        reasoning: "Hallucinated id.",
        alternatives: [],
      }),
    );

    const result = await routeDecision(
      "which projects should the team build next this quarter",
    );
    // Pick was invalid → lexical fallback (top candidate, confidence 0).
    expect(result.framework_id).toBe(candidates[0]);
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toContain("Lexical match");
  });

  it("drops alternatives that are not in the candidate set", async () => {
    const candidates = searchCatalog(
      "which projects should the team build next this quarter",
      CANDIDATE_LIMIT,
    );
    const validAlt = candidates.find((id) => id !== "drice")!;

    callClaudeMock.mockResolvedValueOnce(
      toolReply({
        framework_id: "drice",
        confidence: 0.8,
        reasoning: "Roadmap prioritization.",
        alternatives: [validAlt, "not-a-real-id", "drice"],
      }),
    );

    const result = await routeDecision(
      "which projects should the team build next this quarter",
    );
    expect(result.framework_id).toBe("drice");
    expect(result.alternatives).toEqual([validAlt]);
  });

  it("clamps confidence into the 0..1 range", async () => {
    callClaudeMock.mockResolvedValueOnce(
      toolReply({
        framework_id: searchCatalog(
          "which projects should the team build next this quarter",
          CANDIDATE_LIMIT,
        )[0],
        confidence: 5,
        reasoning: "Out-of-range confidence.",
        alternatives: [],
      }),
    );

    const result = await routeDecision(
      "which projects should the team build next this quarter",
    );
    expect(result.confidence).toBe(1);
  });

  it("falls back to lexical when the model throws", async () => {
    const candidates = searchCatalog(
      "which projects should the team build next this quarter",
      CANDIDATE_LIMIT,
    );
    callClaudeMock.mockRejectedValueOnce(new Error("API down"));

    const result = await routeDecision(
      "which projects should the team build next this quarter",
    );
    expect(result.framework_id).toBe(candidates[0]);
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toContain("Lexical match");
  });

  it("falls back to lexical when the model returns no tool call", async () => {
    callClaudeMock.mockResolvedValueOnce({ content: [] });

    const result = await routeDecision(
      "which projects should the team build next this quarter",
    );
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toContain("Lexical match");
  });
});

describe("routeDecision — cold start", () => {
  it("returns a null framework_id when no candidate matches", async () => {
    const result = await routeDecision("zzzzqqqq xkcd nonsense gibberish");
    expect(result.framework_id).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.alternatives).toEqual([]);
    expect(result.nearest).toEqual([]);
    // The LLM is never called when there are no lexical candidates.
    expect(callClaudeMock).not.toHaveBeenCalled();
  });
});
