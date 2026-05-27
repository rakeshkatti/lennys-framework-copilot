import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: createMock };
    constructor(_opts: unknown) {}
  }
  return { default: MockAnthropic };
});

import { callClaude, modelForKind } from "./llm";

const ENV_KEYS = ["MODEL_ROUTER", "MODEL_STEP"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue({ content: [] });
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

describe("modelForKind", () => {
  it("defaults router to Haiku and step to Sonnet", () => {
    expect(modelForKind("router")).toBe("claude-haiku-4-5-20251001");
    expect(modelForKind("step")).toBe("claude-sonnet-4-6");
  });

  it("honors MODEL_ROUTER and MODEL_STEP env overrides", () => {
    process.env.MODEL_ROUTER = "custom-router";
    process.env.MODEL_STEP = "custom-step";
    expect(modelForKind("router")).toBe("custom-router");
    expect(modelForKind("step")).toBe("custom-step");
  });
});

describe("callClaude — model selection", () => {
  it("uses the router model for kind 'router'", async () => {
    await callClaude({ kind: "router", system: "s", messages: [] });
    expect(createMock.mock.calls[0][0].model).toBe("claude-haiku-4-5-20251001");
  });

  it("uses the step model for kind 'step'", async () => {
    await callClaude({ kind: "step", system: "s", messages: [] });
    expect(createMock.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
  });
});

describe("callClaude — cacheableSystem", () => {
  it("sends a plain string system when cacheableSystem is falsy", async () => {
    await callClaude({ kind: "step", system: "static rules", messages: [] });
    expect(createMock.mock.calls[0][0].system).toBe("static rules");
  });

  it("inserts cache_control on the last system block when cacheableSystem is true", async () => {
    await callClaude({
      kind: "step",
      system: "static rules",
      cacheableSystem: true,
      messages: [],
    });
    const system = createMock.mock.calls[0][0].system;
    expect(Array.isArray(system)).toBe(true);
    expect(system[system.length - 1].cache_control).toEqual({
      type: "ephemeral",
    });
    expect(system[system.length - 1].text).toBe("static rules");
  });

  it("marks only the last block of a multi-block system as cacheable", async () => {
    await callClaude({
      kind: "step",
      system: [
        { type: "text", text: "block one" },
        { type: "text", text: "block two" },
      ],
      cacheableSystem: true,
      messages: [],
    });
    const system = createMock.mock.calls[0][0].system;
    expect(system[0].cache_control).toBeUndefined();
    expect(system[1].cache_control).toEqual({ type: "ephemeral" });
  });

  it("passes through tools and toolChoice when provided", async () => {
    const tools = [{ name: "t", description: "d", input_schema: { type: "object" as const } }];
    await callClaude({
      kind: "step",
      system: "s",
      messages: [],
      tools,
      toolChoice: { type: "tool", name: "t" },
    });
    expect(createMock.mock.calls[0][0].tools).toEqual(tools);
    expect(createMock.mock.calls[0][0].tool_choice).toEqual({
      type: "tool",
      name: "t",
    });
  });
});
