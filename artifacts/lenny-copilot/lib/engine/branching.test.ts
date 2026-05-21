import { describe, it, expect } from "vitest";
import { evalBranch, tokenize, parse } from "./branching";

describe("branching parser", () => {
  it("tokenizes paths with dashes", () => {
    const toks = tokenize("inputs.winrate-gate.value > 70");
    expect(toks).toEqual([
      { type: "path", path: ["inputs", "winrate-gate", "value"] },
      { type: "op", op: ">" },
      { type: "number", value: 70 },
    ]);
  });

  it("parses comparison expressions", () => {
    const node = parse(tokenize("inputs.foo.bar >= 5"));
    expect(node.kind).toBe("cmp");
  });

  it("rejects unexpected characters", () => {
    expect(() => tokenize("inputs.foo & 1")).toThrow();
  });
});

describe("branching evaluator", () => {
  it("evaluates the DRICE winrate gate when above 70", () => {
    const ctx = { inputs: { "winrate-gate": { value: 80 } } };
    expect(evalBranch("inputs.winrate-gate.value > 70", ctx)).toBe(true);
  });

  it("evaluates the DRICE winrate gate when not above 70", () => {
    const ctx = { inputs: { "winrate-gate": { value: 50 } } };
    expect(evalBranch("inputs.winrate-gate.value > 70", ctx)).toBe(false);
  });

  it("supports and / or composition", () => {
    const ctx = {
      inputs: { a: { x: 5 }, b: { y: "hello" } },
    };
    expect(
      evalBranch('inputs.a.x > 3 and inputs.b.y == "hello"', ctx),
    ).toBe(true);
    expect(
      evalBranch('inputs.a.x > 10 or inputs.b.y == "hello"', ctx),
    ).toBe(true);
    expect(
      evalBranch('inputs.a.x > 10 and inputs.b.y == "hello"', ctx),
    ).toBe(false);
  });

  it("rejects paths that do not start with inputs or benchmarks", () => {
    expect(() =>
      evalBranch("foo.bar > 1", { inputs: {} }),
    ).toThrow();
  });

  it("does not invoke eval — refuses arbitrary JS", () => {
    expect(() =>
      evalBranch("constructor.constructor('return 1')()", { inputs: {} }),
    ).toThrow();
  });
});
