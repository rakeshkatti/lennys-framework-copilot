import { describe, it, expect } from "vitest";
import { loadSpec } from "./loadSpec";

describe("drice framework spec", () => {
  it("validates against the Zod schema and has 5 steps", () => {
    const spec = loadSpec("drice");
    expect(spec.id).toBe("drice");
    expect(spec.steps).toHaveLength(5);
  });
});
