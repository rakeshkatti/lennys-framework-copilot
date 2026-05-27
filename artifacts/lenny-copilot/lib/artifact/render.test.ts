import { describe, it, expect } from "vitest";
import {
  formatStepOutput,
  formatStepOutputAsTable,
  renderArtifactMarkdown,
  resolveArtifactBody,
} from "./render";
import type { FrameworkSpec, Step } from "../spec";

const listStep: Step = {
  id: "collect-ideas",
  title: "Ideas",
  prompt: "p",
  input: { type: "list", config: { min_items: 1 } },
  guidance: {
    text: "g",
    source_span: { file: "f.md", start: 0, end: 1 },
  },
} as unknown as Step;

const gridStep: Step = {
  id: "rice-score",
  title: "Score",
  prompt: "p",
  input: {
    type: "score-grid",
    config: { dimensions: ["Reach", "Impact", "Confidence", "Effort"] },
  },
  guidance: {
    text: "g",
    source_span: { file: "f.md", start: 0, end: 1 },
  },
} as unknown as Step;

const textStep: Step = {
  id: "drice-deepdive",
  title: "Deepdive",
  prompt: "p",
  input: { type: "text", config: { per_item_from: "confirm-shortlist.selected" } },
  guidance: {
    text: "g",
    source_span: { file: "f.md", start: 0, end: 1 },
  },
} as unknown as Step;

const numberStep: Step = {
  id: "winrate-gate",
  title: "Winrate",
  prompt: "p",
  input: { type: "number", config: { unit: "%" } },
  guidance: { text: "g", source_span: { file: "f.md", start: 0, end: 1 } },
} as unknown as Step;

const spec: FrameworkSpec = {
  id: "drice",
  name: "DRICE",
  category: "Prioritization",
  shape: "scored-model",
  source: ["a.md", "b.md", "a.md"],
  summary: "s",
  decision_served: "d",
  spec_version: "1",
  steps: [listStep, gridStep, textStep, numberStep],
  artifact: {
    type: "scored-table",
    template:
      "## Result\n\n### Ranked\n{{table:steps.rice-score.output}}\n\n### Detail\n{{steps.drice-deepdive.output}}\n\n### Winrate (skipped sometimes)\n{{steps.winrate-gate.output}}",
  },
} as unknown as FrameworkSpec;

const inputs = {
  "collect-ideas": { items: ["A", "B", "C"] },
  "rice-score": {
    grid: {
      A: { Reach: "L", Impact: "L", Confidence: "L", Effort: "S" },
      B: { Reach: "M", Impact: "M", Confidence: "M", Effort: "M" },
      C: { Reach: "S", Impact: "S", Confidence: "S", Effort: "L" },
    },
  },
  "drice-deepdive": {
    values: { A: "Big win for A.", B: "Modest for B." },
  },
  // winrate-gate intentionally absent (simulating skipped branch).
};

describe("formatStepOutput", () => {
  it("formats a list as bullets", () => {
    expect(
      formatStepOutput(listStep, inputs["collect-ideas"]),
    ).toBe("- A\n- B\n- C");
  });

  it("formats a number with unit", () => {
    expect(formatStepOutput(numberStep, { value: 65 })).toBe("65 %");
  });

  it("formats per-item text as labeled blocks", () => {
    const out = formatStepOutput(textStep, inputs["drice-deepdive"]);
    expect(out).toContain("**A**");
    expect(out).toContain("Big win for A.");
    expect(out).toContain("**B**");
  });

  it("returns empty string for null value", () => {
    expect(formatStepOutput(listStep, null)).toBe("");
  });
});

describe("formatStepOutputAsTable", () => {
  it("renders a score-grid as a ranked markdown table with dimensions", () => {
    const out = formatStepOutputAsTable(gridStep, inputs["rice-score"]);
    const lines = out.split("\n");
    expect(lines[0]).toBe("| Idea | Reach | Impact | Confidence | Effort | Score |");
    expect(lines[1]).toBe("| --- | --- | --- | --- | --- | --- |");
    // 3 data rows
    expect(lines.length).toBe(5);
    // First data row should be the highest-scoring item.
    expect(lines[2].startsWith("| ")).toBe(true);
  });

  it("falls back to a one-column table for a list step", () => {
    const out = formatStepOutputAsTable(listStep, inputs["collect-ideas"]);
    expect(out).toBe("| Idea |\n| --- |\n| A |\n| B |\n| C |");
  });
});

describe("resolveArtifactBody", () => {
  it("resolves table and inline placeholders", () => {
    const body = resolveArtifactBody(spec, inputs, {
      completedStepIds: new Set([
        "collect-ideas",
        "rice-score",
        "drice-deepdive",
      ]),
    });
    expect(body).toContain("| Idea | Reach | Impact | Confidence | Effort | Score |");
    expect(body).toContain("**A**");
    expect(body).toContain("### Detail");
    // Skipped step's placeholder must not leave its raw text behind.
    expect(body).not.toContain("{{");
    // Heading for the skipped step remains, but the placeholder line is gone.
    expect(body).toContain("### Winrate (skipped sometimes)");
  });

  it("renders nothing for a step value the user never submitted", () => {
    const body = resolveArtifactBody(spec, inputs, {
      completedStepIds: new Set([
        "collect-ideas",
        "rice-score",
        "drice-deepdive",
      ]),
    });
    // winrate-gate has no value and isn't in completedStepIds; its slot is blank.
    const winratePart = body.split("### Winrate (skipped sometimes)")[1] ?? "";
    expect(winratePart.trim()).toBe("");
  });

  it("ignores unknown step ids in the template", () => {
    const weirdSpec = {
      ...spec,
      artifact: {
        ...spec.artifact,
        template: "Hello {{steps.does-not-exist.output}} world",
      },
    } as FrameworkSpec;
    const body = resolveArtifactBody(weirdSpec, inputs, {
      completedStepIds: new Set(["does-not-exist"]),
    });
    expect(body).toBe("Hello  world");
  });
});

describe("renderArtifactMarkdown", () => {
  it("appends a deduplicated Sources section with per-step spans", () => {
    const md = renderArtifactMarkdown(spec, inputs, {
      completedStepIds: new Set([
        "collect-ideas",
        "rice-score",
        "drice-deepdive",
      ]),
    });
    expect(md).toContain("## Sources");
    expect(md).toContain("- a.md");
    expect(md).toContain("- b.md");
    // a.md is listed once at the top-level even though spec.source repeats it.
    expect(md.match(/^- a\.md$/gm)?.length).toBe(1);
    // Per-step spans for completed steps are nested under their source file.
    expect(md).toContain("- f.md");
    // Per-step lines list the step title only; raw char offsets from
    // source_span are intentionally omitted — they were spec-author /
    // audit metadata, not reader-facing detail.
    expect(md).toContain("  - Ideas");
    expect(md).toContain("  - Score");
    expect(md).toContain("  - Deepdive");
    expect(md).not.toMatch(/chars\s+\d+/);
    // Skipped step is NOT in the sources.
    expect(md).not.toContain("  - Winrate");
  });
});

describe("table cell escaping", () => {
  it("escapes pipe characters and newlines in score-grid item names", () => {
    const out = formatStepOutputAsTable(gridStep, {
      grid: {
        "Search | redesign\nphase 2": {
          Reach: "L",
          Impact: "L",
          Confidence: "L",
          Effort: "S",
        },
      },
    });
    const dataRow = out.split("\n")[2];
    // Pipe is escaped, newline collapsed to a space — table structure intact.
    expect(dataRow).toContain("Search \\| redesign phase 2");
    // Exactly one literal pipe is escaped; six are unescaped column separators
    // (leading + 5 cells + trailing).
    expect((dataRow.match(/\\\|/g) ?? []).length).toBe(1);
    // 6 columns → 7 unescaped pipe separators (leading + 5 between + trailing).
    expect((dataRow.match(/(?<!\\)\|/g) ?? []).length).toBe(7);
  });

  it("escapes pipes in list and multi-choice table fallbacks", () => {
    const listOut = formatStepOutputAsTable(listStep, {
      items: ["a | b", "c\nd"],
    });
    expect(listOut).toContain("| a \\| b |");
    expect(listOut).toContain("| c d |");
  });
});

describe("malformed persisted input shape", () => {
  it("treats a non-object completed value as missing instead of crashing", () => {
    const body = resolveArtifactBody(
      spec,
      // Simulates corrupted/legacy storage: a step key with a primitive value.
      { "rice-score": "garbage" as unknown as Record<string, unknown> },
      { completedStepIds: new Set(["rice-score"]) },
    );
    expect(body).not.toContain("garbage");
    expect(body).not.toContain("{{");
  });

  it("renders an empty score-grid as nothing rather than throwing", () => {
    expect(formatStepOutputAsTable(gridStep, { grid: {} })).toBe("");
    expect(formatStepOutput(gridStep, { grid: {} })).toBe("");
  });

  it("returns empty for a partial score-grid missing required dimensions", () => {
    // rankScoreGrid throws when Reach/Impact/Confidence/Effort isn't complete.
    expect(
      formatStepOutput(gridStep, {
        grid: { A: { Reach: "L" } as Record<string, "S" | "M" | "L"> },
      }),
    ).toBe("");
    expect(
      formatStepOutputAsTable(gridStep, {
        grid: { A: { Reach: "L" } as Record<string, "S" | "M" | "L"> },
      }),
    ).toBe("");
  });
});
