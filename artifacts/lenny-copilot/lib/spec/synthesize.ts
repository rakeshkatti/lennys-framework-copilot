import type { CatalogEntry } from "@lib/catalog";
import type { FrameworkSpec, Step } from "@lib/spec";

/**
 * Synthesize a FrameworkSpec from a catalog entry. The result is a
 * sequential-process workflow with one freeform-text step per
 * `key_steps[]`, prefixed by a decision-context capture step. Each step
 * reuses the catalog entry's first source file as its `guidance.source_span`
 * so the existing /api/step + adaptStepGuidance + citation pipeline works
 * unchanged.
 *
 * Synthesized specs are marked with `spec_version: "synth-1"` and
 * `shape: "sequential-process"` so other layers (artifact renderer,
 * triangulation, analytics) can tell them apart from hand-authored specs.
 *
 * NOT included (intentional — see Plan 4 §non-goals):
 *  - no benchmark hooks, no branching, no dimension scoring
 *  - no examples (hand-curated examples don't exist for guidance entries)
 *  - no excerpt selection per step — loadExcerpt falls back to the full
 *    source markdown for synthesized specs.
 */
export function synthesizeSpec(entry: CatalogEntry): FrameworkSpec {
  if (entry.key_steps.length === 0) {
    throw new Error(
      `Cannot synthesize a spec for "${entry.id}": catalog entry has at least one key_step required (got 0).`,
    );
  }

  const primarySource = entry.source[0];
  if (!primarySource) {
    throw new Error(
      `Cannot synthesize a spec for "${entry.id}": catalog entry has no source file.`,
    );
  }

  // Reused as every step's guidance source_span. The 0..1 range is a
  // placeholder; the citation layer doesn't enforce span bounds, only file.
  const sourceSpan = { file: primarySource, start: 0, end: 1 };

  const introStep: Step = {
    id: "describe-decision",
    title: "Describe the decision you're facing",
    prompt: [
      "Describe the specific situation you're trying to figure out. Include your role,",
      "what you're deciding, what's already been tried, and what success looks like.",
      "Sonnet will use this context to tailor every following step to your situation.",
    ].join(" "),
    input: {
      type: "text",
      config: {
        placeholder:
          "e.g. We're a 12-person Series A startup, our DAU has been flat for 6 weeks despite shipping features. I'm the head of product trying to decide where to focus next.",
        max_len: 2000,
      },
    },
    guidance: {
      text: `Apply ${entry.name} to your situation: ${entry.decision_served}`,
      source_span: sourceSpan,
    },
    examples: [],
    benchmark_hook: null,
    branching: null,
  };

  const stepFromKey = (keyStep: string, index: number): Step => ({
    id: `step-${index + 1}`,
    title: `${index + 1}. ${truncateForTitle(keyStep)}`,
    prompt: keyStep,
    input: {
      type: "text",
      config: {
        // "Notes" rather than "Your answer" — many synthesized steps invite
        // observations or draft thinking, not a single crisp answer. The
        // engine already allows empty text (see validateStepInput for
        // type "text"), so leaving a step blank is a valid path through
        // the workflow — the artifact just shows that section empty.
        placeholder:
          "Notes for this step — observations, decisions, or your answer. Leave blank to skip.",
        max_len: 2000,
      },
    },
    // The static fallback text — used verbatim if the LLM call fails or
    // returns un-citable output. References the framework so the user knows
    // what's being applied even when adaptation is offline.
    guidance: {
      text: `${entry.name} step ${index + 1}: ${keyStep}`,
      source_span: sourceSpan,
    },
    examples: [],
    benchmark_hook: null,
    branching: null,
  });

  const steps: Step[] = [
    introStep,
    ...entry.key_steps.map(stepFromKey),
  ];

  const template = buildArtifactTemplate(entry, steps);

  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    shape: "sequential-process",
    source: [primarySource],
    summary: entry.summary,
    decision_served: entry.decision_served,
    spec_version: "synth-1",
    steps,
    artifact: {
      type: "synthesized-markdown",
      template,
    },
  };
}

/** Keep step titles short enough for the UI; truncate at the first sentence. */
function truncateForTitle(text: string): string {
  const firstSentence = text.split(/[.!?]/)[0];
  return firstSentence.length > 80
    ? firstSentence.slice(0, 77).trim() + "…"
    : firstSentence.trim();
}

/** Build a markdown artifact template that the renderer can fill from inputs. */
function buildArtifactTemplate(entry: CatalogEntry, steps: Step[]): string {
  const stepBlocks = steps
    .map((s) => `### ${s.title}\n\n{{${s.id}}}`)
    .join("\n\n");
  return [
    `# ${entry.name}`,
    "",
    `_${entry.decision_served}_`,
    "",
    stepBlocks,
  ].join("\n");
}
