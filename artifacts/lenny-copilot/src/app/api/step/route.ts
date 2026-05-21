import { NextResponse } from "next/server";
import { z } from "zod";
import { loadSpec } from "@lib/loadSpec";
import { loadExcerpt } from "@lib/loadExcerpt";
import { adaptStepGuidance } from "@lib/adapt/adapt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const kebabId = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const bodySchema = z.object({
  frameworkId: z.string().regex(kebabId, "frameworkId must be kebab-case"),
  stepId: z.string().regex(kebabId, "stepId must be kebab-case"),
  inputsSoFar: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { frameworkId, stepId, inputsSoFar } = parsed.data;

  let spec;
  try {
    spec = loadSpec(frameworkId);
  } catch {
    return NextResponse.json({ error: "framework_not_found" }, { status: 404 });
  }
  const step = spec.steps.find((s) => s.id === stepId);
  if (!step) {
    return NextResponse.json({ error: "step_not_found" }, { status: 404 });
  }

  const excerpt = loadExcerpt(frameworkId, stepId);
  if (!excerpt) {
    return NextResponse.json(
      {
        sentences: [
          { text: step.guidance.text, quote: step.guidance.text },
        ],
        fallback: true,
        source: { file: step.guidance.source_span.file },
        reason: "no_excerpt",
      },
      { status: 200 },
    );
  }

  const result = await adaptStepGuidance(
    step,
    excerpt.excerpt,
    excerpt.file,
    inputsSoFar,
  );
  return NextResponse.json(result, { status: 200 });
}
