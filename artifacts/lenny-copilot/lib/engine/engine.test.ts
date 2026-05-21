import { describe, it, expect } from "vitest";
import { loadSpec } from "../loadSpec";
import {
  Engine,
  ARTIFACT_CURSOR,
  createMemoryStorage,
  saveSnapshot,
  loadSnapshot,
  InputValidationError,
} from "./index";

const ideas = ["A", "B", "C", "D", "E"];
const fullGrid = {
  grid: {
    A: { Reach: "L", Impact: "L", Confidence: "L", Effort: "S" },
    B: { Reach: "M", Impact: "M", Confidence: "M", Effort: "M" },
    C: { Reach: "S", Impact: "S", Confidence: "S", Effort: "L" },
    D: { Reach: "L", Impact: "M", Confidence: "L", Effort: "M" },
    E: { Reach: "M", Impact: "L", Confidence: "M", Effort: "S" },
  },
};

describe("Engine — basic advance", () => {
  it("starts at the first step and advances cursor on valid input", () => {
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    expect(engine.currentStep()?.id).toBe("collect-ideas");

    engine.advance({ items: ideas });
    expect(engine.currentStep()?.id).toBe("rice-score");

    engine.advance(fullGrid);
    expect(engine.currentStep()?.id).toBe("confirm-shortlist");
  });
});

describe("Engine — input validation", () => {
  it("rejects a list with fewer than min_items", () => {
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    expect(() => engine.advance({ items: ["only one"] })).toThrow(
      InputValidationError,
    );
    expect(engine.currentStep()?.id).toBe("collect-ideas");
  });

  it("rejects a list whose items are empty/whitespace-only strings", () => {
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    expect(() =>
      engine.advance({ items: ["", "   ", "", "", ""] }),
    ).toThrow(InputValidationError);
    expect(engine.currentStep()?.id).toBe("collect-ideas");
  });

  it("trims and drops empty strings when storing a valid list", () => {
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    engine.advance({ items: ["  A ", "B", "", "C", "D", "  ", "E"] });
    expect(engine.inputs()["collect-ideas"]).toEqual({
      items: ["A", "B", "C", "D", "E"],
    });
  });

  it("rejects a non-number value for the winrate-gate", () => {
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    engine.advance({ items: ideas });
    engine.advance(fullGrid);
    engine.advance({ selected: ["A", "D"] });
    expect(engine.currentStep()?.id).toBe("winrate-gate");
    expect(() => engine.advance({ value: "high" })).toThrow(
      InputValidationError,
    );
  });

  it("rejects a number outside min/max bounds", () => {
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    engine.advance({ items: ideas });
    engine.advance(fullGrid);
    engine.advance({ selected: ["A", "D"] });
    expect(() => engine.advance({ value: -1 })).toThrow(InputValidationError);
    expect(() => engine.advance({ value: 101 })).toThrow(InputValidationError);
  });

  it("rejects non-finite numbers (Infinity, -Infinity, NaN)", () => {
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    engine.advance({ items: ideas });
    engine.advance(fullGrid);
    engine.advance({ selected: ["A", "D"] });
    expect(() => engine.advance({ value: Infinity })).toThrow(InputValidationError);
    expect(() => engine.advance({ value: -Infinity })).toThrow(InputValidationError);
    expect(() => engine.advance({ value: NaN })).toThrow(InputValidationError);
  });
});

describe("Engine — back navigation", () => {
  it("rolls back the cursor and removes the previous step's input on back()", () => {
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    expect(engine.canGoBack()).toBe(false);
    engine.advance({ items: ideas });
    expect(engine.canGoBack()).toBe(true);
    expect(engine.currentStep()?.id).toBe("rice-score");
    engine.back();
    expect(engine.currentStep()?.id).toBe("collect-ideas");
    expect(engine.inputs()["collect-ideas"]).toBeUndefined();
    expect(engine.canGoBack()).toBe(false);
  });

  it("undoes a branching jump (artifact → back to winrate-gate)", () => {
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    engine.advance({ items: ideas });
    engine.advance(fullGrid);
    engine.advance({ selected: ["A", "D"] });
    engine.advance({ value: 85 });
    expect(engine.isDone()).toBe(true);
    engine.back();
    expect(engine.currentStep()?.id).toBe("winrate-gate");
    expect(engine.isDone()).toBe(false);
  });
});

describe("Engine — benchmark branching", () => {
  it("evaluates branching conditions against benchmarks set on the engine", () => {
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    engine.setBenchmarks({ winrate: 42 });
    expect(engine.benchmarks()).toEqual({ winrate: 42 });
  });
});

describe("Engine — branching", () => {
  it("skips drice-deepdive when winrate > 70", () => {
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    engine.advance({ items: ideas });
    engine.advance(fullGrid);
    engine.advance({ selected: ["A", "D"] });
    expect(engine.currentStep()?.id).toBe("winrate-gate");
    engine.advance({ value: 85 });
    expect(engine.cursor()).toBe(ARTIFACT_CURSOR);
    expect(engine.isDone()).toBe(true);
  });

  it("falls through to drice-deepdive when winrate <= 70", () => {
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    engine.advance({ items: ideas });
    engine.advance(fullGrid);
    engine.advance({ selected: ["A", "D"] });
    engine.advance({ value: 40 });
    expect(engine.currentStep()?.id).toBe("drice-deepdive");
    expect(engine.isDone()).toBe(false);
  });
});

describe("Engine — persistence", () => {
  it("persists snapshot to storage after each advance", () => {
    const spec = loadSpec("drice");
    const storage = createMemoryStorage();
    const { engine } = Engine.load(spec, { storage });
    engine.advance({ items: ideas });
    const restored = loadSnapshot(storage, spec.id, spec.spec_version);
    expect(restored.snapshot?.cursor).toBe("rice-score");
    expect(restored.snapshot?.inputs["collect-ideas"]).toEqual({ items: ideas });
  });

  it("restores from saved snapshot on Engine.load", () => {
    const spec = loadSpec("drice");
    const storage = createMemoryStorage();
    saveSnapshot(storage, {
      specId: spec.id,
      specVersion: spec.spec_version,
      cursor: "winrate-gate",
      inputs: {
        "collect-ideas": { items: ideas },
        "rice-score": fullGrid,
        "confirm-shortlist": { selected: ["A", "D"] },
      },
      history: ["collect-ideas", "rice-score", "confirm-shortlist"],
    });
    const { engine, notice } = Engine.load(spec, { storage });
    expect(notice).toBeNull();
    expect(engine.currentStep()?.id).toBe("winrate-gate");
    expect(engine.canGoBack()).toBe(true);
    engine.back();
    expect(engine.currentStep()?.id).toBe("confirm-shortlist");
  });

  it("persists history in the snapshot and restores back-navigation after reload", () => {
    const spec = loadSpec("drice");
    const storage = createMemoryStorage();
    const { engine } = Engine.load(spec, { storage });
    engine.advance({ items: ideas });
    engine.advance(fullGrid);
    expect(engine.history()).toEqual(["collect-ideas", "rice-score"]);
    const { engine: reloaded } = Engine.load(spec, { storage });
    expect(reloaded.currentStep()?.id).toBe("confirm-shortlist");
    expect(reloaded.canGoBack()).toBe(true);
    reloaded.back();
    expect(reloaded.currentStep()?.id).toBe("rice-score");
  });

  it("discards saved state with notice when cursor references an unknown step", () => {
    const spec = loadSpec("drice");
    const storage = createMemoryStorage();
    saveSnapshot(storage, {
      specId: spec.id,
      specVersion: spec.spec_version,
      cursor: "not-a-real-step",
      inputs: {},
      history: [],
    });
    const { engine, notice } = Engine.load(spec, { storage });
    expect(notice).toMatch(/unknown step/i);
    expect(engine.currentStep()?.id).toBe("collect-ideas");
  });

  it("discards saved state with notice when spec_version changes", () => {
    const spec = loadSpec("drice");
    const storage = createMemoryStorage();
    saveSnapshot(storage, {
      specId: spec.id,
      specVersion: "0",
      cursor: "winrate-gate",
      inputs: {},
      history: [],
    });
    const { engine, notice } = Engine.load(spec, { storage });
    expect(notice).toMatch(/discarded/i);
    expect(engine.currentStep()?.id).toBe("collect-ideas");
  });
});
