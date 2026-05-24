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
  it("advances a list below min_items without throwing (soft guideline only)", () => {
    // Plan 5 change: min_items is a soft UI nudge, not a hard block. The
    // ListInput UI shows the count badge in rose when below, but Continue
    // is always enabled so the user can advance and return later.
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    expect(() => engine.advance({ items: ["only one"] })).not.toThrow();
    expect(engine.currentStep()?.id).not.toBe("collect-ideas");
  });

  it("trims and drops empty/whitespace-only strings, advancing with whatever survives", () => {
    // All-whitespace inputs collapse to an empty list after trim+filter.
    // The engine no longer blocks on this; the artifact just shows an
    // empty collection that the user can return to.
    const spec = loadSpec("drice");
    const engine = new Engine(spec);
    expect(() =>
      engine.advance({ items: ["", "   ", "", "", ""] }),
    ).not.toThrow();
    expect(engine.currentStep()?.id).not.toBe("collect-ideas");
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

describe("Engine — Strategy Blocks (sum scoring + sum_top preselect)", () => {
  it("walks problem-dump → cluster → score-clusters and validates the 1/2/3 grid", () => {
    const spec = loadSpec("strategy-blocks");
    const engine = new Engine(spec);
    expect(engine.currentStep()?.id).toBe("problem-dump");

    const problems = ["p1", "p2", "p3", "p4", "p5"];
    engine.advance({ items: problems });
    expect(engine.currentStep()?.id).toBe("cluster");

    const clusters = ["Discovery", "Relevance", "Trust", "Onboarding"];
    engine.advance({ items: clusters });
    expect(engine.currentStep()?.id).toBe("score-clusters");

    const grid = {
      Discovery: {
        "Expected impact": "3",
        "Certainty of impact": "3",
        "Clarity of levers": "2",
        "Uniqueness of levers": "3",
      },
      Relevance: {
        "Expected impact": "2",
        "Certainty of impact": "2",
        "Clarity of levers": "2",
        "Uniqueness of levers": "2",
      },
      Trust: {
        "Expected impact": "1",
        "Certainty of impact": "1",
        "Clarity of levers": "1",
        "Uniqueness of levers": "1",
      },
      Onboarding: {
        "Expected impact": "3",
        "Certainty of impact": "2",
        "Clarity of levers": "3",
        "Uniqueness of levers": "2",
      },
    };
    engine.advance({ grid });
    expect(engine.currentStep()?.id).toBe("pillars");

    const stored = engine.inputs()["score-clusters"] as { grid: typeof grid };
    expect(stored.grid.Discovery["Expected impact"]).toBe("3");
  });

  it("rejects a grid cell value that's not in the 1/2/3 scale", () => {
    const spec = loadSpec("strategy-blocks");
    const engine = new Engine(spec);
    engine.advance({ items: ["a", "b", "c", "d", "e"] });
    engine.advance({ items: ["X", "Y", "Z"] });
    expect(() =>
      engine.advance({
        grid: {
          X: {
            "Expected impact": "L",
            "Certainty of impact": "2",
            "Clarity of levers": "2",
            "Uniqueness of levers": "2",
          },
          Y: {
            "Expected impact": "1",
            "Certainty of impact": "1",
            "Clarity of levers": "1",
            "Uniqueness of levers": "1",
          },
          Z: {
            "Expected impact": "1",
            "Certainty of impact": "1",
            "Clarity of levers": "1",
            "Uniqueness of levers": "1",
          },
        },
      }),
    ).toThrow(InputValidationError);
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
