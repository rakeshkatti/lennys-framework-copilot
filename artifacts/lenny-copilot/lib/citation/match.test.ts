import { describe, it, expect } from "vitest";
import {
  citationMatches,
  contentCoverage,
  MIN_CONTENT_COVERAGE,
  normalizeForMatch,
} from "./match";

const excerpt =
  "As a rule of thumb, you'll want to have at least 5x as many ideas as you could reasonably build in the next time period (typically a quarter) before starting to prioritize.";

describe("citationMatches", () => {
  it("accepts a verbatim substring of the excerpt", () => {
    const quote = "at least 5x as many ideas as you could reasonably build";
    expect(citationMatches(quote, excerpt)).toBe(true);
  });

  it("accepts a substring with different whitespace/punctuation", () => {
    // Extra spaces, smart-quote substitution, capitalization differences.
    const quote = "At least 5x as many ideas — as you could  reasonably build";
    expect(citationMatches(quote, excerpt)).toBe(true);
  });

  it("rejects an invented sentence not present in the excerpt", () => {
    const quote =
      "You should always interview at least ten customers before scoring any idea.";
    expect(citationMatches(quote, excerpt)).toBe(false);
  });

  it("rejects a too-short quote (would match trivially)", () => {
    expect(citationMatches("a quarter", excerpt)).toBe(false);
  });

  it("rejects empty / whitespace-only / non-string quotes", () => {
    expect(citationMatches("", excerpt)).toBe(false);
    expect(citationMatches("   \n  \t  ", excerpt)).toBe(false);
    // @ts-expect-error — runtime guard
    expect(citationMatches(null, excerpt)).toBe(false);
    // @ts-expect-error — runtime guard
    expect(citationMatches(undefined, excerpt)).toBe(false);
  });

  it("rejects a long sentence that mixes real and invented content", () => {
    const quote =
      "at least 5x as many ideas as you could reasonably build, then rank them with the MoSCoW method.";
    expect(citationMatches(quote, excerpt)).toBe(false);
  });

  it("normalizeForMatch collapses whitespace and lowercases", () => {
    expect(normalizeForMatch("  Hello,   WORLD!\n\nFoo. ")).toBe(
      "hello world foo",
    );
  });
});

describe("contentCoverage", () => {
  it("a faithful rephrase of the excerpt has high coverage", () => {
    const text =
      "Aim for at least 5x more ideas than you can reasonably build in a quarter before prioritizing.";
    const cov = contentCoverage(text, [excerpt]);
    expect(cov).toBeGreaterThanOrEqual(MIN_CONTENT_COVERAGE);
  });

  it("an invented sentence with a faked theme has low coverage", () => {
    const text =
      "Always interview ten paying customers and run controlled experiments with statistical significance.";
    const cov = contentCoverage(text, [excerpt]);
    expect(cov).toBeLessThan(MIN_CONTENT_COVERAGE);
  });

  it("user-input tokens (idea names) are allowed even if absent from excerpt", () => {
    const text =
      "For PayPal checkout and Dropbox onboarding, gather at least 5x more ideas before you prioritize.";
    const lowCov = contentCoverage(text, [excerpt]);
    const withInputs = contentCoverage(text, [
      excerpt,
      "PayPal checkout, Dropbox onboarding",
    ]);
    expect(withInputs).toBeGreaterThan(lowCov);
    expect(withInputs).toBeGreaterThanOrEqual(MIN_CONTENT_COVERAGE);
  });

});
