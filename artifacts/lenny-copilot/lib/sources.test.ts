import { describe, it, expect } from "vitest";
import { loadSourcesIndex, resolveSource } from "./sources";

describe("loadSourcesIndex", () => {
  it("returns a non-empty map", () => {
    const index = loadSourcesIndex();
    expect(Object.keys(index).length).toBeGreaterThan(0);
  });
});

describe("resolveSource", () => {
  it("resolves a known newsletter filename to an entry with a real title", () => {
    const entry = resolveSource(
      "newsletters/introducing-drice-a-modern-prioritization-framework.md",
    );
    expect(entry).not.toBeNull();
    expect(entry?.title).toMatch(/DRICE/i);
  });

  it("returns null for a filename not in the index", () => {
    expect(resolveSource("newsletters/this-does-not-exist.md")).toBeNull();
  });
});
