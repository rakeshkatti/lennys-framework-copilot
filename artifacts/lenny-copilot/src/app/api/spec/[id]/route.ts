import { NextResponse } from "next/server";
import { loadSpec } from "@lib/loadSpec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const kebabId = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  if (!kebabId.test(id)) {
    return NextResponse.json(
      { error: "invalid_id", message: "id must be kebab-case" },
      { status: 400 },
    );
  }

  let spec;
  try {
    spec = loadSpec(id);
  } catch {
    return NextResponse.json({ error: "framework_not_found" }, { status: 404 });
  }

  return NextResponse.json(spec, { status: 200 });
}
