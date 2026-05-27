import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const kebabId = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const catalogEntrySchema = z
  .object({
    id: z.string().regex(kebabId),
    name: z.string().min(1),
    category: z.string().min(1),
    decision_served: z.string().min(1),
    source: z.array(z.string().min(1)),
    summary: z.string().min(1),
    key_steps: z.array(z.string().min(1)),
    tier: z.enum(["workflow", "guidance"]),
  })
  .strict();

export const questionBankEntrySchema = z
  .object({
    question: z.string().min(1),
    category: z.string().min(1),
    framework_id: z.string().regex(kebabId),
    verbatim: z.boolean(),
    source: z.union([z.string().min(1), z.null()]),
  })
  .strict();

export type CatalogEntry = z.infer<typeof catalogEntrySchema>;
export type QuestionBankEntry = z.infer<typeof questionBankEntrySchema>;

function loadJsonArray<T>(
  relativePath: string,
  schema: z.ZodType<T>,
  label: string,
): T[] {
  const path = join(process.cwd(), "data", relativePath);

  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read ${label} at ${path}: ${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${label} at ${path} is not valid JSON: ${(err as Error).message}`,
    );
  }

  const result = z.array(schema).safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `${label} at ${path} failed schema validation:\n${JSON.stringify(
        result.error.issues,
        null,
        2,
      )}`,
    );
  }

  return result.data;
}

export function loadCatalog(): CatalogEntry[] {
  return loadJsonArray("catalog.json", catalogEntrySchema, "Catalog");
}

export function loadQuestionBank(): QuestionBankEntry[] {
  return loadJsonArray(
    "question-bank.json",
    questionBankEntrySchema,
    "Question bank",
  );
}
