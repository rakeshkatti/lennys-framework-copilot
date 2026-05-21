import { describe, it, expect } from "vitest";
import {
  riceScore,
  rankScoreGrid,
  ricePreselect,
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
      riceScore({ Reach: "L", Impact: "M", Confidence: "L" } as Record<string, "S" | "M" | "L">),
    ).toThrow();
  });
});
