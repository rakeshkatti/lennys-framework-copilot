import { describe, it, expect } from "vitest";
import { searchCatalog } from "./search";
import { loadCatalog } from "./catalog";

const PRICING_IDS = new Set(
  loadCatalog()
    .filter((entry) => entry.category === "Pricing")
    .map((entry) => entry.id),
);

const GROWTH_OR_METRICS_IDS = new Set(
  loadCatalog()
    .filter(
      (entry) =>
        entry.category === "Growth" ||
        entry.category === "Metrics & Benchmarks",
    )
    .map((entry) => entry.id),
);

describe("searchCatalog", () => {
  it("returns at most the requested number of ids", () => {
    const results = searchCatalog("prioritization", 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("returns unique framework ids", () => {
    const results = searchCatalog("growth metrics retention");
    expect(new Set(results).size).toBe(results.length);
  });

  it("surfaces a Pricing framework for a pricing question", () => {
    const results = searchCatalog(
      "how should we figure out how much customers are willing to pay for our product",
    );
    expect(results.some((id) => PRICING_IDS.has(id))).toBe(true);
  });

  it("surfaces a Growth or Metrics framework for an activation question", () => {
    const results = searchCatalog(
      "our activation has been flat at 18% and growth has stalled",
    );
    expect(results.some((id) => GROWTH_OR_METRICS_IDS.has(id))).toBe(true);
  });

  it("finds DRICE for a prioritization query", () => {
    const results = searchCatalog(
      "which projects should the team build next this quarter",
    );
    expect(results).toContain("drice");
  });

  it("returns an empty list for a query with no lexical overlap", () => {
    const results = searchCatalog("zzzzqqqq xkcd nonsense gibberish");
    expect(results).toEqual([]);
  });
});
