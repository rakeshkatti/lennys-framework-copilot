import { z } from "zod";

const kebabId = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const sourceSpanSchema = z
  .object({
    file: z.string().min(1),
    start: z.number().int().min(0),
    end: z.number().int().min(0),
  })
  .strict();

export const guidanceSchema = z
  .object({
    text: z.string().min(1),
    source_span: sourceSpanSchema,
  })
  .strict();

export const exampleSchema = z
  .object({
    company: z.string().min(1),
    text: z.string().min(1),
    source_span: sourceSpanSchema,
  })
  .strict();

export const benchmarkHookSchema = z
  .object({
    metric: z.string().min(1),
    segment_from: z.string().min(1),
  })
  .strict();

export const branchSchema = z
  .object({
    if: z.string().min(1),
    next: z.string().min(1),
  })
  .strict();

const listInputSchema = z
  .object({
    type: z.literal("list"),
    config: z
      .object({
        min_items: z.number().int().optional(),
        item_label: z.string().optional(),
      })
      .passthrough(),
  })
  .strict();

const numberInputSchema = z
  .object({
    type: z.literal("number"),
    config: z
      .object({
        min: z.number().optional(),
        max: z.number().optional(),
        unit: z.string().optional(),
      })
      .passthrough(),
  })
  .strict();

const choiceInputSchema = z
  .object({
    type: z.literal("choice"),
    config: z
      .object({
        options: z.array(z.string()).optional(),
        options_from: z.string().optional(),
      })
      .passthrough(),
  })
  .strict();

const multiChoiceInputSchema = z
  .object({
    type: z.literal("multi-choice"),
    config: z
      .object({
        options: z.array(z.string()).optional(),
        options_from: z.string().optional(),
        preselect: z.string().optional(),
        preselect_multiplier: z.number().optional(),
        score_formula: z.string().optional(),
      })
      .passthrough(),
  })
  .strict();

const textInputSchema = z
  .object({
    type: z.literal("text"),
    config: z
      .object({
        placeholder: z.string().optional(),
        max_len: z.number().int().optional(),
        per_item_from: z.string().optional(),
      })
      .passthrough(),
  })
  .strict();

const scoreGridInputSchema = z
  .object({
    type: z.literal("score-grid"),
    config: z
      .object({
        rows_from: z.string(),
        dimensions: z.array(z.string()).min(1),
        scale: z.array(z.string()).min(1),
      })
      .passthrough(),
  })
  .strict();

export const inputSchema = z.discriminatedUnion("type", [
  listInputSchema,
  numberInputSchema,
  choiceInputSchema,
  multiChoiceInputSchema,
  textInputSchema,
  scoreGridInputSchema,
]);

export const stepSchema = z
  .object({
    id: z.string().regex(kebabId),
    title: z.string().min(1),
    prompt: z.string().min(1),
    input: inputSchema,
    guidance: guidanceSchema,
    examples: z.array(exampleSchema),
    benchmark_hook: z.union([z.null(), benchmarkHookSchema]),
    branching: z.union([z.null(), z.array(branchSchema).min(1)]),
  })
  .strict();

export const artifactSchema = z
  .object({
    type: z.string().min(1),
    template: z.string().min(1),
  })
  .strict();

export const shapeSchema = z.enum([
  "scored-model",
  "diagnostic-tree",
  "sequential-process",
  "checklist",
]);

export const frameworkSpecSchema = z
  .object({
    id: z.string().regex(kebabId),
    name: z.string().min(1),
    category: z.string().min(1),
    shape: shapeSchema,
    source: z.array(z.string().min(1)).min(1),
    summary: z.string().min(1),
    decision_served: z.string().min(1),
    spec_version: z.string().min(1),
    steps: z.array(stepSchema).min(1),
    artifact: artifactSchema,
  })
  .strict();

export type SourceSpan = z.infer<typeof sourceSpanSchema>;
export type Guidance = z.infer<typeof guidanceSchema>;
export type Example = z.infer<typeof exampleSchema>;
export type BenchmarkHook = z.infer<typeof benchmarkHookSchema>;
export type Branch = z.infer<typeof branchSchema>;
export type Input = z.infer<typeof inputSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type Shape = z.infer<typeof shapeSchema>;
export type FrameworkSpec = z.infer<typeof frameworkSpecSchema>;
