import { describe, it, expect } from "vitest";
import { loadSpec } from "./loadSpec";

describe("loadSpec", () => {
  it("loads a hand-authored golden spec from data/frameworks/<id>.json", () => {
    const spec = loadSpec("drice");
    expect(spec.id).toBe("drice");
    expect(spec.spec_version).toBe("1");
  });

  it("synthesizes a spec from the catalog when no JSON exists", () => {
    // 'rice-prioritization' is guidance-tier in the catalog, no JSON file.
    const spec = loadSpec("rice-prioritization");
    expect(spec.id).toBe("rice-prioritization");
    expect(spec.spec_version).toBe("synth-1");
    expect(spec.steps.length).toBeGreaterThan(0);
  });

  it("throws when the id is in neither the JSON nor the catalog", () => {
    expect(() => loadSpec("totally-made-up-framework")).toThrow(
      /not found|unknown framework/i,
    );
  });
});
