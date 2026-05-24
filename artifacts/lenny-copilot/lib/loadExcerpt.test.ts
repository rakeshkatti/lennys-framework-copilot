import { describe, it, expect } from "vitest";
import { loadExcerpt } from "./loadExcerpt";

describe("loadExcerpt", () => {
  it("returns the hand-authored excerpt when one exists (golden frameworks)", () => {
    const excerpt = loadExcerpt("drice", "collect-ideas");
    expect(excerpt).not.toBeNull();
    expect(excerpt!.file).toContain("introducing-drice");
    // Hand-authored excerpts are short and focused, not the full ~3k-word post.
    expect(excerpt!.excerpt.length).toBeLessThan(2000);
  });

  it("falls back to the full source markdown for a synthesized spec", () => {
    // rice-prioritization is a guidance-tier catalog entry — no excerpts JSON.
    // The first step of its synthesized spec is 'describe-decision'.
    const excerpt = loadExcerpt("rice-prioritization", "step-1");
    expect(excerpt).not.toBeNull();
    expect(excerpt!.file).toMatch(/(newsletters|podcasts)\//);
    // Full markdown is large compared to a hand-authored excerpt.
    expect(excerpt!.excerpt.length).toBeGreaterThan(2000);
  });

  it("returns null when the framework id is unknown to both excerpts and catalog", () => {
    expect(loadExcerpt("totally-made-up-framework", "step-1")).toBeNull();
  });
});
