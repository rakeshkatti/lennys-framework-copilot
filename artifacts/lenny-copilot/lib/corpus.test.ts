import { describe, it, expect } from "vitest";
import { loadCorpusFile } from "./corpus";

describe("loadCorpusFile", () => {
  it("returns markdown body for a referenced newsletter, frontmatter stripped", () => {
    const text = loadCorpusFile(
      "newsletters/introducing-drice-a-modern-prioritization-framework.md",
    );
    expect(text).not.toBeNull();
    // Frontmatter MUST be stripped — no YAML keys leak into the body.
    expect(text!.startsWith("---")).toBe(false);
    // Body content must include a known phrase from the DRICE post.
    expect(text!).toContain("prioritizing");
    // Reasonable length sanity check (DRICE post is ~3k words / ~20k chars).
    expect(text!.length).toBeGreaterThan(2000);
  });

  it("returns null for a path that does not exist", () => {
    expect(loadCorpusFile("newsletters/does-not-exist.md")).toBeNull();
  });

  it("rejects paths that try to escape the corpus directory", () => {
    expect(loadCorpusFile("../../../etc/passwd")).toBeNull();
    expect(loadCorpusFile("newsletters/../../etc/passwd")).toBeNull();
  });
});
