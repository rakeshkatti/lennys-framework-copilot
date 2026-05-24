import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCatalog } from "./catalog";
import { synthesizeSpec } from "./spec/synthesize";
import { frameworkSpecSchema, type FrameworkSpec } from "./spec";

/**
 * Load a FrameworkSpec by id. Resolution order:
 *  1. `data/frameworks/<id>.json` — hand-authored golden spec.
 *  2. Catalog entry → `synthesizeSpec` — generic adapted workflow.
 *
 * Throws when the id matches neither. The 4 golden workflows
 * (drice, stalled-growth-diagnostic, strategy-blocks, b2b-pmf-diagnostic)
 * take the first branch; the other 117 catalog entries take the second.
 */
export function loadSpec(id: string): FrameworkSpec {
  const jsonPath = join(process.cwd(), "data", "frameworks", `${id}.json`);

  if (existsSync(jsonPath)) {
    const raw = readFileSync(jsonPath, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `Framework spec at ${jsonPath} is not valid JSON: ${(err as Error).message}`,
      );
    }
    const result = frameworkSpecSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Framework spec at ${jsonPath} failed schema validation:\n${JSON.stringify(
          result.error.issues,
          null,
          2,
        )}`,
      );
    }
    return result.data;
  }

  // Fallback: synthesize from the catalog.
  const catalog = loadCatalog();
  const entry = catalog.find((e) => e.id === id);
  if (!entry) {
    throw new Error(
      `Unknown framework "${id}": no spec at ${jsonPath} and no catalog entry.`,
    );
  }
  return synthesizeSpec(entry);
}
