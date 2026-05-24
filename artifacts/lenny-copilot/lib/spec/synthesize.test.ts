import { describe, it, expect } from "vitest";
import { synthesizeSpec } from "./synthesize";
import { frameworkSpecSchema } from "@lib/spec";
import type { CatalogEntry } from "@lib/catalog";

const SAMPLE: CatalogEntry = {
  id: "jobs-to-be-done",
  name: "Jobs To Be Done",
  category: "Research & Discovery",
  decision_served: "Understanding the underlying job a customer hires a product to do.",
  source: ["podcasts/bob-moesta.md"],
  summary:
    "Jobs To Be Done reframes products as tools customers hire to make progress in their lives. Interviews focus on the moment of switch.",
  key_steps: [
    "Identify a recent customer who switched to your product",
    "Interview them about the four forces at the moment of switch",
    "Map the push and pull behind the switch",
    "Extract the underlying job statement",
  ],
  tier: "guidance",
};

describe("synthesizeSpec", () => {
  it("produces a Zod-valid FrameworkSpec", () => {
    const spec = synthesizeSpec(SAMPLE);
    const parsed = frameworkSpecSchema.safeParse(spec);
    expect(parsed.success).toBe(true);
  });

  it("creates one freeform-text step per key_step plus a decision-context step", () => {
    const spec = synthesizeSpec(SAMPLE);
    // 1 decision-context step + 4 key_steps = 5 total
    expect(spec.steps.length).toBe(SAMPLE.key_steps.length + 1);
    expect(spec.steps[0].id).toBe("describe-decision");
    expect(spec.steps[0].input.type).toBe("text");
    for (let i = 0; i < SAMPLE.key_steps.length; i++) {
      const step = spec.steps[i + 1];
      expect(step.input.type).toBe("text");
      expect(step.prompt).toContain(SAMPLE.key_steps[i]);
      // ID is kebab-case and stable: step-1, step-2, ...
      expect(step.id).toBe(`step-${i + 1}`);
    }
  });

  it("uses the catalog id, name, category, summary, decision_served verbatim", () => {
    const spec = synthesizeSpec(SAMPLE);
    expect(spec.id).toBe(SAMPLE.id);
    expect(spec.name).toBe(SAMPLE.name);
    expect(spec.category).toBe(SAMPLE.category);
    expect(spec.summary).toBe(SAMPLE.summary);
    expect(spec.decision_served).toBe(SAMPLE.decision_served);
  });

  it("uses the first catalog source as the spec source and as every step's guidance source_span", () => {
    const spec = synthesizeSpec(SAMPLE);
    expect(spec.source).toEqual([SAMPLE.source[0]]);
    for (const step of spec.steps) {
      expect(step.guidance.source_span.file).toBe(SAMPLE.source[0]);
    }
  });

  it("marks the spec as synthesized via spec_version and shape", () => {
    const spec = synthesizeSpec(SAMPLE);
    expect(spec.spec_version).toBe("synth-1");
    expect(spec.shape).toBe("sequential-process");
  });

  it("provides a non-empty artifact template that references each step id", () => {
    const spec = synthesizeSpec(SAMPLE);
    expect(spec.artifact.type).toBe("synthesized-markdown");
    for (const step of spec.steps) {
      expect(spec.artifact.template).toContain(`{{${step.id}}}`);
    }
  });

  it("throws when key_steps is empty (caller should filter these out)", () => {
    const bad: CatalogEntry = { ...SAMPLE, key_steps: [] };
    expect(() => synthesizeSpec(bad)).toThrow(/at least one key_step/i);
  });
});
