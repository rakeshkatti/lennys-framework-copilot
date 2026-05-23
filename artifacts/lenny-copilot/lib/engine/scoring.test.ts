import { describe, it, expect } from "vitest";
import {
  riceScore,
  rankScoreGrid,
  ricePreselect,
  sumScore,
  rankByDimensionSum,
  sumPreselect,
  SML_PERCENT,
  SML_EFFORT_WEEKS,
} from "./scoring";

describe("RICE scoring", () => {
  it("computes (R% * I% * C%) / Effort", () => {
    const score = riceScore({
      Reach: "L",
      Impact: "M",
      Confidence: "L",
      Effort: "M",
    });
    const expected =
      ((SML_PERCENT.L / 100) *
        (SML_PERCENT.M / 100) *
        (SML_PERCENT.L / 100)) /
      SML_EFFORT_WEEKS.M;
    expect(score).toBeCloseTo(expected, 10);
  });

  it("ranks rows highest score first", () => {
    const ranked = rankScoreGrid({
      "PayPal checkout": { Reach: "L", Impact: "S", Confidence: "L", Effort: "M" },
      "New nav": { Reach: "S", Impact: "S", Confidence: "S", Effort: "L" },
      "Pricing test": { Reach: "L", Impact: "L", Confidence: "M", Effort: "S" },
    });
    expect(ranked[0].item).toBe("Pricing test");
    expect(ranked[ranked.length - 1].item).toBe("New nav");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("defaults to RICE scoring when no opts.scoring is provided (back-compat)", () => {
    const ranked = rankScoreGrid({
      a: { Reach: "L", Impact: "L", Confidence: "L", Effort: "S" },
      b: { Reach: "S", Impact: "S", Confidence: "S", Effort: "L" },
    });
    expect(ranked[0].item).toBe("a");
    expect(ranked[1].item).toBe("b");
  });

  it("preselects top N by multiplier × capacity", () => {
    const ranked = rankScoreGrid({
      a: { Reach: "L", Impact: "L", Confidence: "L", Effort: "S" },
      b: { Reach: "M", Impact: "M", Confidence: "M", Effort: "M" },
      c: { Reach: "S", Impact: "S", Confidence: "S", Effort: "L" },
      d: { Reach: "L", Impact: "M", Confidence: "L", Effort: "M" },
    });
    expect(ricePreselect(ranked, 2, 1)).toHaveLength(2);
    expect(ricePreselect(ranked, 2, 2)).toHaveLength(4);
  });

  it("throws if a required dimension is missing", () => {
    expect(() =>
      riceScore({ Reach: "L", Impact: "M", Confidence: "L" }),
    ).toThrow();
  });
});

describe("sum scoring", () => {
  const dims = [
    "Expected impact",
    "Certainty of impact",
    "Clarity of levers",
    "Uniqueness of levers",
  ];
  const scale = ["1", "2", "3"];

  it("sums a row by mapping each cell's scale position (1-indexed) to its value", () => {
    expect(
      sumScore(
        {
          "Expected impact": "3",
          "Certainty of impact": "2",
          "Clarity of levers": "1",
          "Uniqueness of levers": "3",
        },
        dims,
        scale,
      ),
    ).toBe(3 + 2 + 1 + 3);
  });

  it("works with arbitrary scales (S/M/L maps to 1/2/3)", () => {
    expect(
      sumScore(
        { Reach: "L", Impact: "S", Confidence: "M", Effort: "L" },
        ["Reach", "Impact", "Confidence", "Effort"],
        ["S", "M", "L"],
      ),
    ).toBe(3 + 1 + 2 + 3);
  });

  it("treats unknown cell values and missing dimensions as 0", () => {
    expect(
      sumScore(
        { "Expected impact": "3", "Clarity of levers": "bogus" },
        dims,
        scale,
      ),
    ).toBe(3);
  });

  it("ranks the Strategy Blocks 4-dim 1/2/3 grid highest-sum first", () => {
    const grid = {
      Discovery: {
        "Expected impact": "3",
        "Certainty of impact": "3",
        "Clarity of levers": "2",
        "Uniqueness of levers": "3",
      },
      Relevance: {
        "Expected impact": "2",
        "Certainty of impact": "2",
        "Clarity of levers": "2",
        "Uniqueness of levers": "2",
      },
      Trust: {
        "Expected impact": "1",
        "Certainty of impact": "1",
        "Clarity of levers": "1",
        "Uniqueness of levers": "1",
      },
      Onboarding: {
        "Expected impact": "3",
        "Certainty of impact": "2",
        "Clarity of levers": "3",
        "Uniqueness of levers": "2",
      },
    };
    const ranked = rankByDimensionSum(grid, dims, scale);
    expect(ranked[0].item).toBe("Discovery");
    expect(ranked[0].score).toBe(11);
    expect(ranked[1].item).toBe("Onboarding");
    expect(ranked[1].score).toBe(10);
    expect(ranked[ranked.length - 1].item).toBe("Trust");
    expect(ranked[ranked.length - 1].score).toBe(4);
  });

  it("rankScoreGrid dispatches to sum when scoring:'sum'", () => {
    const grid = {
      Discovery: {
        "Expected impact": "3",
        "Certainty of impact": "3",
        "Clarity of levers": "2",
        "Uniqueness of levers": "3",
      },
      Trust: {
        "Expected impact": "1",
        "Certainty of impact": "1",
        "Clarity of levers": "1",
        "Uniqueness of levers": "1",
      },
    };
    const ranked = rankScoreGrid(grid, {
      scoring: "sum",
      dimensions: dims,
      scale,
    });
    expect(ranked[0].item).toBe("Discovery");
    expect(ranked[0].score).toBe(11);
  });

  it("preserves order for ties (stable on insertion order)", () => {
    const grid = {
      First: {
        "Expected impact": "2",
        "Certainty of impact": "2",
        "Clarity of levers": "2",
        "Uniqueness of levers": "2",
      },
      Second: {
        "Expected impact": "2",
        "Certainty of impact": "2",
        "Clarity of levers": "2",
        "Uniqueness of levers": "2",
      },
      Third: {
        "Expected impact": "3",
        "Certainty of impact": "3",
        "Clarity of levers": "3",
        "Uniqueness of levers": "3",
      },
    };
    const ranked = rankByDimensionSum(grid, dims, scale);
    expect(ranked[0].item).toBe("Third");
    expect(ranked[0].score).toBe(12);
    // Both First and Second tied at 8 — both present, order preserved from insertion.
    expect(ranked[1].score).toBe(8);
    expect(ranked[2].score).toBe(8);
    expect([ranked[1].item, ranked[2].item].sort()).toEqual(["First", "Second"]);
  });

  it("sumPreselect picks the top N items", () => {
    const ranked = rankByDimensionSum(
      {
        a: { "Expected impact": "3", "Certainty of impact": "3", "Clarity of levers": "3", "Uniqueness of levers": "3" },
        b: { "Expected impact": "2", "Certainty of impact": "2", "Clarity of levers": "2", "Uniqueness of levers": "2" },
        c: { "Expected impact": "1", "Certainty of impact": "1", "Clarity of levers": "1", "Uniqueness of levers": "1" },
        d: { "Expected impact": "3", "Certainty of impact": "2", "Clarity of levers": "2", "Uniqueness of levers": "2" },
      },
      dims,
      scale,
    );
    expect(sumPreselect(ranked, 3)).toEqual(["a", "d", "b"]);
    expect(sumPreselect(ranked, 1)).toEqual(["a"]);
    // Floor at 1 even if count is 0 or negative.
    expect(sumPreselect(ranked, 0)).toHaveLength(1);
  });

  it("rankScoreGrid throws if sum mode is requested without dimensions or scale", () => {
    expect(() => rankScoreGrid({}, { scoring: "sum" })).toThrow(/dimensions/);
    expect(() =>
      rankScoreGrid({}, { scoring: "sum", dimensions: ["A"] }),
    ).toThrow(/scale/);
  });
});
