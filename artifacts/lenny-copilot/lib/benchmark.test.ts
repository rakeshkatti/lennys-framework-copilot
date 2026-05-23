import { describe, it, expect, beforeEach } from "vitest";
import { parseThreshold } from "./benchmark";
import {
  loadBenchmarks,
  computeVerdict,
  _resetBenchmarksCache,
} from "./benchmark.server";

beforeEach(() => {
  _resetBenchmarksCache();
});

describe("loadBenchmarks", () => {
  it("loads and Zod-validates the benchmarks file", () => {
    const benchmarks = loadBenchmarks();
    expect(benchmarks.monthly_churn).toBeDefined();
    expect(benchmarks.monthly_churn.metric_label).toBe("Monthly churn");
    expect(benchmarks.monthly_churn.segments).toHaveLength(3);
    const segNames = benchmarks.monthly_churn.segments.map((s) => s.segment);
    expect(segNames).toContain("B2B SMB + Mid-Market");
  });

  it("includes every metric the catalog uses", () => {
    const benchmarks = loadBenchmarks();
    expect(Object.keys(benchmarks).sort()).toEqual(
      [
        "activation_rate",
        "consumer_subscription_health",
        "free_to_paid_conversion",
        "growth_rate",
        "monthly_churn",
        "net_revenue_retention",
        "payback_period",
        "user_retention",
        "waitlist_conversion",
      ].sort(),
    );
  });
});

describe("parseThreshold", () => {
  it("parses a percent range '3-5%'", () => {
    const p = parseThreshold("3-5%");
    expect(p).toMatchObject({ low: 3, high: 5 });
  });

  it("parses '<2%' as upper-bound-only", () => {
    const p = parseThreshold("<2%");
    expect(p?.openLow).toBe(true);
    expect(p?.high).toBe(2);
  });

  it("parses '<1.5%' (decimal)", () => {
    const p = parseThreshold("<1.5%");
    expect(p?.high).toBe(1.5);
  });

  it("parses '>20%' as lower-bound-only", () => {
    const p = parseThreshold(">20%");
    expect(p?.openHigh).toBe(true);
    expect(p?.low).toBe(20);
  });

  it("parses '>1.0' (no percent)", () => {
    const p = parseThreshold(">1.0");
    expect(p?.low).toBe(1.0);
    expect(p?.openHigh).toBe(true);
  });

  it("parses '~50%' as an approximate point", () => {
    const p = parseThreshold("~50%");
    expect(p?.fuzzy).toBe(true);
    expect(p?.low).toBe(50);
    expect(p?.high).toBe(50);
  });

  it("parses '15-25% MoM' (range with trailing unit)", () => {
    const p = parseThreshold("15-25% MoM");
    expect(p).toMatchObject({ low: 15, high: 25 });
  });

  it("parses '4-5x' (range with trailing 'x' multiplier)", () => {
    const p = parseThreshold("4-5x");
    expect(p).toMatchObject({ low: 4, high: 5 });
  });

  it("parses '3x' (single multiplier)", () => {
    const p = parseThreshold("3x");
    expect(p).toMatchObject({ low: 3, high: 3 });
  });

  it("returns null for dollar/time growth-rate descriptions", () => {
    expect(parseThreshold("$1M ARR within 12 months of launch")).toBeNull();
    expect(parseThreshold("$1M ARR within 9 months of launch")).toBeNull();
  });

  it("returns null for descriptive multi-clause bands (waitlist / activation)", () => {
    expect(
      parseThreshold("25-85% range, ~50% average if invited within a month"),
    ).toBeNull();
    expect(parseThreshold("34% average, 25% median")).toBeNull();
  });

  it("returns null for empty / non-string input", () => {
    expect(parseThreshold("")).toBeNull();
    expect(parseThreshold("   ")).toBeNull();
  });
});

describe("computeVerdict — monthly_churn (lower-is-better)", () => {
  it("classifies 1.0% as great for B2B SMB + Mid-Market (great: <1.5%)", () => {
    const v = computeVerdict("monthly_churn", "B2B SMB + Mid-Market", 1.0);
    expect(v).not.toBeNull();
    expect(v!.band).toBe("great");
    expect(v!.label).toMatch(/great threshold \(<1\.5%\)/);
  });

  it("classifies 3.5% as good for B2B SMB + Mid-Market (good: 2.5-5%)", () => {
    const v = computeVerdict("monthly_churn", "B2B SMB + Mid-Market", 3.5);
    expect(v!.band).toBe("good");
    expect(v!.label).toMatch(/2\.5-5%/);
    expect(v!.label).toContain("3.5%");
  });

  it("classifies 7% as below for B2B SMB + Mid-Market", () => {
    const v = computeVerdict("monthly_churn", "B2B SMB + Mid-Market", 7);
    expect(v!.band).toBe("below");
    expect(v!.label).toMatch(/below the great threshold/);
  });

  it("returns null when value is non-finite", () => {
    expect(computeVerdict("monthly_churn", "B2C SaaS", NaN)).toBeNull();
    expect(computeVerdict("monthly_churn", "B2C SaaS", Infinity)).toBeNull();
  });
});

describe("computeVerdict — higher-is-better metrics", () => {
  it("net_revenue_retention 125% is great for Enterprise SaaS (great: ~130%)", () => {
    // 125 < 130 → not great, but >= good (~110%) → good
    const v = computeVerdict("net_revenue_retention", "Enterprise SaaS", 125);
    expect(v!.band).toBe("good");
  });

  it("net_revenue_retention 135% is great for Enterprise SaaS", () => {
    const v = computeVerdict("net_revenue_retention", "Enterprise SaaS", 135);
    expect(v!.band).toBe("great");
  });

  it("user_retention 22% for Consumer social is below the good band (~25%)", () => {
    const v = computeVerdict("user_retention", "Consumer social", 22);
    expect(v!.band).toBe("below");
    expect(v!.label).toMatch(/below the great threshold|below the good threshold/);
  });

  it("free_to_paid_conversion 4% for Freemium self-serve is in good (3-5%)", () => {
    const v = computeVerdict(
      "free_to_paid_conversion",
      "Freemium self-serve",
      4,
    );
    expect(v!.band).toBe("good");
  });

  it("free_to_paid_conversion 7% for Freemium self-serve hits the great band (6-8%)", () => {
    const v = computeVerdict(
      "free_to_paid_conversion",
      "Freemium self-serve",
      7,
    );
    expect(v!.band).toBe("great");
  });
});

describe("computeVerdict — missing metric or segment", () => {
  it("returns null for an unknown metric", () => {
    expect(computeVerdict("not_a_metric", "anything", 5)).toBeNull();
  });

  it("returns null for an unknown segment", () => {
    expect(
      computeVerdict("monthly_churn", "Not A Real Segment", 3),
    ).toBeNull();
  });

  it("returns null when the segment has no parseable thresholds (growth_rate dollar-time)", () => {
    const v = computeVerdict(
      "growth_rate",
      "Early-stage B2B (time to $1M ARR after launch)",
      0.5,
    );
    expect(v).toBeNull();
  });

  it("works for growth_rate MoM segment which has only `good`", () => {
    const v = computeVerdict(
      "growth_rate",
      "Month-over-month growth below $1M ARR",
      20,
    );
    expect(v!.band).toBe("good");
  });
});

describe("computeVerdict — edge values", () => {
  it("monthly_churn exactly at the great boundary 1.5% lands in great (<=)", () => {
    const v = computeVerdict("monthly_churn", "B2B SMB + Mid-Market", 1.5);
    expect(v!.band).toBe("great");
  });

  it("monthly_churn at the good upper boundary 5% lands in good", () => {
    const v = computeVerdict("monthly_churn", "B2B SMB + Mid-Market", 5);
    expect(v!.band).toBe("good");
  });

  it("net_revenue_retention exactly at the good boundary lands in good", () => {
    // Bottom-up SaaS good ~100% → 100 should land in good (not great)
    const v = computeVerdict("net_revenue_retention", "Bottom-up SaaS", 100);
    expect(v!.band).toBe("good");
  });
});
