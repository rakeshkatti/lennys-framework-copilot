import { NextResponse } from "next/server";
import { z } from "zod";
import { loadCatalog } from "@lib/catalog";
import { triangulate } from "@lib/triangulate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const kebabId = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const bodySchema = z.object({
  primaryFrameworkId: z
    .string()
    .regex(kebabId, "primaryFrameworkId must be kebab-case"),
  challengerFrameworkId: z
    .string()
    .regex(kebabId, "challengerFrameworkId must be kebab-case"),
  primaryArtifactMarkdown: z.string().min(1),
  userInputs: z.record(z.string(), z.unknown()).default({}),
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

  const {
    primaryFrameworkId,
    challengerFrameworkId,
    primaryArtifactMarkdown,
    userInputs,
  } = parsed.data;

  if (primaryFrameworkId === challengerFrameworkId) {
    return NextResponse.json(
      { error: "challenger_must_differ_from_primary" },
      { status: 400 },
    );
  }

  const catalog = loadCatalog();
  const primary = catalog.find((e) => e.id === primaryFrameworkId);
  if (!primary) {
    return NextResponse.json(
      { error: "primary_framework_not_found" },
      { status: 404 },
    );
  }
  const challenger = catalog.find((e) => e.id === challengerFrameworkId);
  if (!challenger) {
    return NextResponse.json(
      { error: "challenger_framework_not_found" },
      { status: 404 },
    );
  }

  // `triangulate` is resilient by construction: any LLM error degrades to a
  // fallback result, so this call does not throw.
  const result = await triangulate({
    primary,
    primaryArtifactMarkdown,
    userInputs,
    challenger,
  });
  return NextResponse.json(result, { status: 200 });
}
