import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { loadCatalog } from "@lib/catalog";
import { loadSpec } from "@lib/loadSpec";
import { loadSourcesIndex } from "@lib/sources";
import { loadBenchmarks } from "@lib/benchmark.server";
import { consume, extractIpFromHeaders } from "@lib/ratelimit";
import { FrameworkRunner } from "./FrameworkRunner";

export const dynamic = "force-dynamic";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Direct-launch page for a single framework. Reached by clicking any card on
 * `/frameworks`. Skips the home-page routing step — the user already chose
 * the framework, so the `describe-decision` intro step captures their
 * situation directly.
 *
 * Server component: loads spec (golden hand-authored OR synthesized via the
 * Slice 1 fallback) and the data WorkflowRunner needs, then hands off to a
 * thin client wrapper. Rate-limited on render so the catalog-direct-launch
 * path counts against the same daily quota as routing-from-home.
 */
export default function FrameworkRunnerPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  if (!KEBAB.test(id)) notFound();

  const catalog = loadCatalog();
  const entry = catalog.find((e) => e.id === id);
  if (!entry) notFound();

  // Rate-limit the direct-launch path. Counts against the same daily quota
  // as POST /api/route so a visitor can't bypass the cap by clicking
  // catalog cards in a loop.
  const ip = extractIpFromHeaders(headers());
  const rl = consume(ip);
  if (!rl.allowed) {
    return <RateLimitedView reason={rl.reason} resetAt={rl.resetAt} />;
  }

  // loadSpec falls back to synthesizeSpec for non-golden catalog ids, so
  // this never throws for a real catalog entry. Defensive guard just in case.
  let spec;
  try {
    spec = loadSpec(id);
  } catch {
    notFound();
  }

  return (
    <FrameworkRunner
      spec={spec!}
      catalog={catalog}
      sourcesIndex={loadSourcesIndex()}
      benchmarks={loadBenchmarks()}
    />
  );
}

function RateLimitedView({
  reason,
  resetAt,
}: {
  reason?: "per_ip" | "global";
  resetAt: string;
}) {
  // `resetAt` is an ISO timestamp at midnight UTC of the next day. We render
  // it directly; the user knows their own timezone better than we do.
  const body =
    reason === "global"
      ? "We've hit today's total across all users — a small daily ceiling keeps this archived project from melting under a traffic spike."
      : "You've hit today's limit of 5 framework runs per visitor — a small daily ceiling keeps this archived project from melting under a traffic spike.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cream to-peach px-6 py-16">
      <article className="w-full max-w-md rounded-card-hero border border-border-warm bg-white p-8 text-center shadow-soft-lg lg:p-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Daily limit reached
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-ink-strong sm:text-3xl">
          Come back tomorrow.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-body">{body}</p>
        <p className="mt-3 text-xs text-ink-muted">
          Resets at midnight UTC ({resetAt}).
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/frameworks"
            className="rounded-chip border border-border-warm bg-white px-4 py-2 text-sm font-medium text-ink-body shadow-sm transition hover:border-ink-subtle hover:text-ink-strong"
          >
            ← Browse frameworks
          </Link>
          <Link
            href="/"
            className="rounded-chip bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
          >
            Home →
          </Link>
        </div>
      </article>
    </main>
  );
}
