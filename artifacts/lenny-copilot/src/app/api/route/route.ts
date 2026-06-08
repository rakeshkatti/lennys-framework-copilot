import { NextResponse } from "next/server";
import { z } from "zod";
import { routeDecision } from "@lib/route/router";
import { consume, extractIp } from "@lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().min(1, "text must not be empty"),
});

export async function POST(req: Request) {
  // Daily rate limit (per-IP + global cap) — see lib/ratelimit.ts.
  // Checked BEFORE body parsing so a flood of malformed requests can't
  // bypass the cap by failing validation early. Each accepted call
  // consumes one slot.
  const ip = extractIp(req);
  const rl = consume(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit",
        reason: rl.reason,
        resetAt: rl.resetAt,
        message:
          rl.reason === "global"
            ? "Daily total reached across all users. Resets at midnight UTC."
            : "You've hit today's limit of 5 framework runs. Resets at midnight UTC.",
      },
      { status: 429, headers: { "Retry-After": rl.resetAt } },
    );
  }

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
