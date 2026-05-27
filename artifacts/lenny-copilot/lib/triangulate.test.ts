import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: createMock };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

import { pickChallenger, triangulate } from "./triangulate";
import type { CatalogEntry } from "./catalog";

function entry(
  id: string,
  category: string,
  overrides: Partial<CatalogEntry> = {},
): CatalogEntry {
  return {
    id,
    name: id.replace(/-/g, " "),
    category,
    decision_served: `decision for ${id}`,
    source: [`sources/${id}.md`],
    summary: `summary for ${id}`,
    key_steps: [`step 1 of ${id}`, `step 2 of ${id}`],
    tier: "guidance",
    ...overrides,
  };
}

function toolReply(payload: {
  counterargument?: unknown;
  what_would_change_my_mind?: unknown;
}) {
  return {
    content: [
      {
        type: "tool_use",
        id: "t1",
        name: "submit_triangulation",
        input: payload,
      },
    ],
  };
}

describe("pickChallenger", () => {
  const catalog: CatalogEntry[] = [
    entry("drice", "Prioritization & Planning"),
    entry("racecar", "Growth"),
    entry("seven-powers", "Strategy"),
    entry("gain-feedback", "Communication & Influence"),
    entry("foundation-sprint", "Strategy"),
    entry("crossing-the-chasm", "GTM & Sales"),
  ];

  it("prefers an alternative whose category differs from the primary", () => {
    // alternatives are router-ranked, best first; we want the first
    // *different-category* one, not the highest-ranked overall.
    const picked = pickChallenger(
      "drice",
      ["foundation-sprint", "racecar", "seven-powers"],
      // foundation-sprint differs from Prioritization & Planning, so it wins.
      catalog,
    );
    expect(picked).toBe("foundation-sprint");
  });

  it("skips same-category alternatives and picks the next different one", () => {
    // First alternative is in the same category as primary; skip it.
    const sameCat = entry("rice-only", "Prioritization & Planning");
    const cat = [...catalog, sameCat];
    const picked = pickChallenger(
      "drice",
      ["rice-only", "racecar"],
      cat,
    );
    expect(picked).toBe("racecar");
  });

  it("falls back to the contrast map when no alternatives qualify", () => {
    // No alternatives at all → drice (Prioritization & Planning) should land
    // in its contrast set (Research & Discovery, Strategy). Catalog has
    // Strategy entries but no Research & Discovery, so pick the first Strategy.
    const picked = pickChallenger("drice", [], catalog);
    expect(picked).toBe("seven-powers");
  });

  it("falls back to any other-category framework when contrast map misses", () => {
    // Use a primary whose category isn't in CATEGORY_CONTRAST (e.g. an unknown
    // category). The function should land on the first catalog entry from a
    // different category.
    const cat: CatalogEntry[] = [
      entry("weird-one", "Made-Up Category"),
      entry("other-one", "Different Category"),
    ];
    const picked = pickChallenger("weird-one", [], cat);
    expect(picked).toBe("other-one");
  });

  it("never returns the primary id even when listed in alternatives", () => {
    const picked = pickChallenger(
      "drice",
      ["drice", "racecar"],
      catalog,
    );
    expect(picked).not.toBe("drice");
    expect(picked).toBe("racecar");
  });

  it("returns null when the catalog has no usable contrasting entry", () => {
    // Only the primary exists.
    const picked = pickChallenger("solo", [], [entry("solo", "Strategy")]);
    expect(picked).toBeNull();
  });

  it("returns null when the primary isn't in the catalog", () => {
    const picked = pickChallenger("ghost", [], [entry("drice", "X")]);
    expect(picked).toBeNull();
  });
});

describe("triangulate", () => {
  const primary = entry("drice", "Prioritization & Planning");
  const challenger = entry("racecar", "Growth");

  beforeEach(() => {
    createMock.mockReset();
  });

  it("returns a structured result on a successful LLM call", async () => {
    createMock.mockResolvedValueOnce(
      toolReply({
        counterargument:
          "Through the growth-engine lens, prioritizing by RICE ignores the compounding flywheel — the top-ranked idea may not feed the engine at all.",
        what_would_change_my_mind:
          "If the chosen idea were shown to directly reinforce the primary acquisition loop, the growth-engine objection would dissolve.",
      }),
    );

    const result = await triangulate({
      primary,
      primaryArtifactMarkdown: "# DRICE results\n\nTop idea: launch X.",
      userInputs: { idea: "launch X" },
      challenger,
    });

    expect(result.fallback).toBe(false);
    expect(result.challenger_id).toBe("racecar");
    expect(result.challenger_name).toBe(challenger.name);
    expect(result.counterargument).toContain("growth-engine");
    expect(result.what_would_change_my_mind).toContain(
      "primary acquisition loop",
    );
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on a thrown error, then succeeds", async () => {
    createMock.mockRejectedValueOnce(new Error("transient 500"));
    createMock.mockResolvedValueOnce(
      toolReply({
        counterargument: "A second-pass counterargument.",
        what_would_change_my_mind: "A second-pass mind-changer.",
      }),
    );

    const result = await triangulate({
      primary,
      primaryArtifactMarkdown: "# artifact",
      userInputs: {},
      challenger,
    });

    expect(result.fallback).toBe(false);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("returns a fallback result when both attempts error", async () => {
    createMock.mockRejectedValue(new Error("API down"));

    const result = await triangulate({
      primary,
      primaryArtifactMarkdown: "# artifact",
      userInputs: {},
      challenger,
    });

    expect(result.fallback).toBe(true);
    expect(result.challenger_id).toBe("racecar");
    expect(result.counterargument).toBe("");
    expect(result.what_would_change_my_mind).toBe("");
    expect(result.reason).toContain("API down");
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("falls back on a schema-mismatched (empty) tool response", async () => {
    // Both attempts return a response that lacks both required fields.
    createMock.mockResolvedValue(toolReply({}));

    const result = await triangulate({
      primary,
      primaryArtifactMarkdown: "# artifact",
      userInputs: {},
      challenger,
    });

    expect(result.fallback).toBe(true);
    expect(result.reason).toMatch(/empty|invalid/);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("falls back when only one of the two fields is present", async () => {
    createMock.mockResolvedValue(
      toolReply({
        counterargument: "Only half the payload.",
        // what_would_change_my_mind missing
      }),
    );

    const result = await triangulate({
      primary,
      primaryArtifactMarkdown: "# artifact",
      userInputs: {},
      challenger,
    });

    expect(result.fallback).toBe(true);
  });
});
