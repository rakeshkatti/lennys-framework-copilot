import { readFileSync } from "node:fs";
import { join } from "node:path";
import { frameworkSpecSchema, type FrameworkSpec } from "./spec";

export function loadSpec(id: string): FrameworkSpec {
  const path = join(process.cwd(), "data", "frameworks", `${id}.json`);

  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read framework spec at ${path}: ${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Framework spec at ${path} is not valid JSON: ${(err as Error).message}`,
    );
  }

  const result = frameworkSpecSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Framework spec at ${path} failed schema validation:\n${JSON.stringify(
        result.error.issues,
        null,
        2,
      )}`,
    );
  }

  return result.data;
}
