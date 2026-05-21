import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: createMock };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

import { adaptStepGuidance } from "./adapt";
import { loadSpec } from "../loadSpec";

const spec = loadSpec("drice");
const step = spec.steps.find((s) => s.id === "collect-ideas")!;
const excerpt =
  "As a rule of thumb, you'll want to have at least 5x as many ideas as you could reasonably build in the next time period (typically a quarter) before starting to prioritize.";
const excerptFile = "newsletters/introducing-drice.md";

function toolReply(sentences: Array<{ text: string; quote: string }>) {
  return {
    content: [
      {
        type: "tool_use",
        id: "t1",
        name: "submit_adapted_guidance",
        input: { sentences },
      },
    ],
  };
}

beforeEach(() => {
  createMock.mockReset();
});

describe("adaptStepGuidance — adversarial citation filtering", () => {
  it("rejects a sentence whose text is invented even if the quote is real", async () => {
    createMock.mockResolvedValueOnce(
      toolReply([
        {
          // Invented advice — not present in excerpt and no overlap with it.
          text: "Always interview ten paying customers and run statistically significant A/B tests before scoring any idea.",
          // Valid verbatim quote from the excerpt.
          quote: "at least 5x as many ideas as you could reasonably build",
        },
      ]),
    );
    // Second call (retry) returns the same garbage.
    createMock.mockResolvedValueOnce(
      toolReply([
        {
          text: "Always interview ten paying customers and run statistically significant A/B tests before scoring any idea.",
          quote: "at least 5x as many ideas as you could reasonably build",
        },
      ]),
    );

    const result = await adaptStepGuidance(step, excerpt, excerptFile, {});
    expect(result.fallback).toBe(true);
    expect(result.sentences).toHaveLength(1);
    expect(result.sentences[0].text).toBe(step.guidance.text);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a sentence whose quote is fabricated even if the text looks reasonable", async () => {
    createMock.mockResolvedValue(
      toolReply([
        {
          text: "Aim for at least 5x more ideas than you can reasonably build.",
          quote: "this exact wording is nowhere in the source excerpt at all",
        },
      ]),
    );

    const result = await adaptStepGuidance(step, excerpt, excerptFile, {});
    expect(result.fallback).toBe(true);
  });

  it("retries once on a thrown error, then succeeds on the second call", async () => {
    createMock.mockRejectedValueOnce(new Error("transient 500"));
    createMock.mockResolvedValueOnce(
      toolReply([
        {
          text: "Aim for at least 5x more ideas than you can reasonably build in a quarter before prioritizing.",
          quote:
            "at least 5x as many ideas as you could reasonably build in the next time period",
        },
      ]),
    );

    const result = await adaptStepGuidance(step, excerpt, excerptFile, {});
    expect(result.fallback).toBe(false);
    expect(result.sentences).toHaveLength(1);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to verbatim guidance if both attempts error", async () => {
    createMock.mockRejectedValue(new Error("API down"));
    const result = await adaptStepGuidance(step, excerpt, excerptFile, {});
    expect(result.fallback).toBe(true);
    expect(result.sentences[0].text).toBe(step.guidance.text);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("passes through faithful adapted sentences", async () => {
    createMock.mockResolvedValueOnce(
      toolReply([
        {
          text: "Aim for at least 5x more ideas than you can reasonably build in a quarter before prioritizing.",
          quote:
            "at least 5x as many ideas as you could reasonably build in the next time period",
        },
      ]),
    );
    const result = await adaptStepGuidance(step, excerpt, excerptFile, {});
    expect(result.fallback).toBe(false);
    expect(result.sentences).toHaveLength(1);
  });
});
