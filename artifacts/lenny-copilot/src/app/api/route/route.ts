import { NextResponse } from "next/server";
import { z } from "zod";
import { routeDecision } from "@lib/route/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().min(1, "text must not be empty"),
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

  // `routeDecision` is resilient by construction: any LLM error degrades to a
  // lexical fallback, so this call does not throw.
  const result = await routeDecision(parsed.data.text);
  return NextResponse.json(result, { status: 200 });
}
