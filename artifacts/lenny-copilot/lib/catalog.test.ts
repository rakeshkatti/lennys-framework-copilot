import { describe, it, expect } from "vitest";
import { loadCatalog, loadQuestionBank } from "./catalog";

describe("loadCatalog", () => {
  it("returns 121 validated entries", () => {
    const catalog = loadCatalog();
    expect(catalog).toHaveLength(121);
  });

  it("has exactly 4 workflow-tier frameworks with the expected ids", () => {
    const catalog = loadCatalog();
    const workflowIds = catalog
      .filter((entry) => entry.tier === "workflow")
      .map((entry) => entry.id)
      .sort();
    expect(workflowIds).toEqual(
      [
        "b2b-pmf-diagnostic",
        "drice",
        "stalled-growth-diagnostic",
        "strategy-blocks",
      ].sort(),
    );
  });
});

describe("loadQuestionBank", () => {
  it("returns 143 validated entries", () => {
    // 140 initial entries from Plan 2 + 3 DRICE-flavored questions added
    // in commit 07f7c02 so the pinned-golden home-page chip can route to
    // DRICE (previously 0 entries pointed to drice).
    const questionBank = loadQuestionBank();
    expect(questionBank).toHaveLength(143);
  });

  it("references only framework ids that exist in the catalog", () => {
    const catalogIds = new Set(loadCatalog().map((entry) => entry.id));
    const questionBank = loadQuestionBank();
    for (const entry of questionBank) {
      expect(catalogIds.has(entry.framework_id)).toBe(true);
    }
  });
});
