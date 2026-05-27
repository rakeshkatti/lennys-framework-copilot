import { notFound } from "next/navigation";
import { loadCatalog } from "@lib/catalog";
import { loadSpec } from "@lib/loadSpec";
import { loadSourcesIndex } from "@lib/sources";
import { loadBenchmarks } from "@lib/benchmark.server";
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
 * thin client wrapper.
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
