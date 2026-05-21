import type { Step } from "../spec";
import type { SML } from "./scoring";

export class InputValidationError extends Error {
  constructor(
    public stepId: string,
    message: string,
  ) {
    super(`[${stepId}] ${message}`);
    this.name = "InputValidationError";
  }
}

function getItemsFromList(input: unknown): string[] | null {
  if (!input || typeof input !== "object") return null;
  const items = (input as Record<string, unknown>).items;
  if (!Array.isArray(items)) return null;
  if (!items.every((v) => typeof v === "string")) return null;
  return items as string[];
}

function getSelectedFromMulti(input: unknown): string[] | null {
  if (!input || typeof input !== "object") return null;
  const sel = (input as Record<string, unknown>).selected;
  if (!Array.isArray(sel)) return null;
  if (!sel.every((v) => typeof v === "string")) return null;
  return sel as string[];
}

export function validateStepInput(
  step: Step,
  input: unknown,
  allInputs: Record<string, unknown>,
): unknown {
  const { type, config } = step.input;
  switch (type) {
    case "list": {
      if (!input || typeof input !== "object") {
        throw new InputValidationError(step.id, "list input must be an object with `items`");
      }
      const items = (input as Record<string, unknown>).items;
      if (!Array.isArray(items) || !items.every((v) => typeof v === "string")) {
        throw new InputValidationError(step.id, "`items` must be an array of strings");
      }
      const trimmed = (items as string[])
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const minItems = typeof config.min_items === "number" ? config.min_items : 0;
      if (trimmed.length < minItems) {
        const label = typeof config.item_label === "string" ? config.item_label : "item";
        throw new InputValidationError(
          step.id,
          `at least ${minItems} non-empty ${label}(s) required, got ${trimmed.length}`,
        );
      }
      return { items: trimmed };
    }
    case "number": {
      if (!input || typeof input !== "object") {
        throw new InputValidationError(step.id, "number input must be an object with `value`");
      }
      const value = (input as Record<string, unknown>).value;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new InputValidationError(step.id, "`value` must be a finite number");
      }
      if (typeof config.min === "number" && value < config.min) {
        throw new InputValidationError(
          step.id,
          `value ${value} below min ${config.min}${config.unit ? ` ${config.unit}` : ""}`,
        );
      }
      if (typeof config.max === "number" && value > config.max) {
        throw new InputValidationError(
          step.id,
          `value ${value} above max ${config.max}${config.unit ? ` ${config.unit}` : ""}`,
        );
      }
      return { value };
    }
    case "choice": {
      if (!input || typeof input !== "object") {
        throw new InputValidationError(step.id, "choice input must be an object with `value`");
      }
      const value = (input as Record<string, unknown>).value;
      if (typeof value !== "string") {
        throw new InputValidationError(step.id, "`value` must be a string");
      }
      if (Array.isArray(config.options) && !config.options.includes(value)) {
        throw new InputValidationError(
          step.id,
          `value "${value}" is not in allowed options`,
        );
      }
      return { value };
    }
    case "multi-choice": {
      const selected = getSelectedFromMulti(input);
      if (!selected) {
        throw new InputValidationError(
          step.id,
          "multi-choice input must be an object with `selected: string[]`",
        );
      }
      let allowed: string[] | null = null;
      if (Array.isArray(config.options)) {
        allowed = config.options.filter((v): v is string => typeof v === "string");
      } else if (typeof config.options_from === "string") {
        const src = allInputs[config.options_from];
        const items = getItemsFromList(src);
        if (!items) {
          throw new InputValidationError(
            step.id,
            `options_from references step "${config.options_from}" which has no list items`,
          );
        }
        allowed = items;
      }
      if (allowed) {
        const bad = selected.find((v) => !allowed!.includes(v));
        if (bad) {
          throw new InputValidationError(
            step.id,
            `"${bad}" is not in allowed options`,
          );
        }
      }
      return { selected };
    }
    case "text": {
      if (!input || typeof input !== "object") {
        throw new InputValidationError(step.id, "text input must be an object");
      }
      const maxLen = typeof config.max_len === "number" ? config.max_len : Infinity;
      if (typeof config.per_item_from === "string") {
        const src = allInputs[config.per_item_from];
        const items =
          getItemsFromList(src) ?? getSelectedFromMulti(src) ?? null;
        if (!items) {
          throw new InputValidationError(
            step.id,
            `per_item_from references step "${config.per_item_from}" which has no items/selection`,
          );
        }
        const values = (input as Record<string, unknown>).values;
        if (!values || typeof values !== "object") {
          throw new InputValidationError(
            step.id,
            "text input with per_item_from must have `values` object keyed by item",
          );
        }
        const out: Record<string, string> = {};
        for (const item of items) {
          const v = (values as Record<string, unknown>)[item];
          if (typeof v !== "string") {
            throw new InputValidationError(
              step.id,
              `missing or non-string value for item "${item}"`,
            );
          }
          if (v.length > maxLen) {
            throw new InputValidationError(
              step.id,
              `value for "${item}" exceeds max_len ${maxLen}`,
            );
          }
          out[item] = v;
        }
        return { values: out };
      }
      const value = (input as Record<string, unknown>).value;
      if (typeof value !== "string") {
        throw new InputValidationError(step.id, "`value` must be a string");
      }
      if (value.length > maxLen) {
        throw new InputValidationError(
          step.id,
          `value exceeds max_len ${maxLen}`,
        );
      }
      return { value };
    }
    case "score-grid": {
      if (!input || typeof input !== "object") {
        throw new InputValidationError(step.id, "score-grid input must be an object with `grid`");
      }
      const grid = (input as Record<string, unknown>).grid;
      if (!grid || typeof grid !== "object") {
        throw new InputValidationError(step.id, "`grid` must be an object keyed by row");
      }
      const rowsFrom = typeof config.rows_from === "string" ? config.rows_from : null;
      const dimensions = Array.isArray(config.dimensions)
        ? config.dimensions.filter((d): d is string => typeof d === "string")
        : [];
      const scale = Array.isArray(config.scale)
        ? config.scale.filter((s): s is string => typeof s === "string")
        : ["S", "M", "L"];
      let requiredRows: string[] | null = null;
      if (rowsFrom) {
        const src = allInputs[rowsFrom];
        const items = getItemsFromList(src);
        if (!items) {
          throw new InputValidationError(
            step.id,
            `rows_from references step "${rowsFrom}" which has no list items`,
          );
        }
        requiredRows = items;
      }
      const cleaned: Record<string, Record<string, SML>> = {};
      const rowsToCheck = requiredRows ?? Object.keys(grid);
      for (const row of rowsToCheck) {
        const rowScores = (grid as Record<string, unknown>)[row];
        if (!rowScores || typeof rowScores !== "object") {
          throw new InputValidationError(
            step.id,
            `missing scores for row "${row}"`,
          );
        }
        const rowOut: Record<string, SML> = {};
        for (const dim of dimensions) {
          const v = (rowScores as Record<string, unknown>)[dim];
          if (typeof v !== "string" || !scale.includes(v)) {
            throw new InputValidationError(
              step.id,
              `row "${row}" dimension "${dim}" must be one of ${scale.join("/")}`,
            );
          }
          rowOut[dim] = v as SML;
        }
        cleaned[row] = rowOut;
      }
      return { grid: cleaned };
    }
  }
}
