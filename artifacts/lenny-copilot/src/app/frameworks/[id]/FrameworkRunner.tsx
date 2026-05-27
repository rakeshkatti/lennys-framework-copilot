"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { clearSnapshot } from "@lib/engine";
import type { CatalogEntry } from "@lib/catalog";
import type { Benchmarks } from "@lib/benchmark";
import type { SourcesIndex } from "@lib/sources";
import type { FrameworkSpec } from "@lib/spec";
import { WorkflowRunner } from "@/components/WorkflowRunner";

/**
 * Thin client wrapper around WorkflowRunner for the direct-launch route.
 *
 * - `routeAlternatives` is `[]` because there's no prior route result; the
 *   triangulation challenger is picked by category proximity in WorkflowRunner.
 * - On exit, navigates back to the catalog page. Also clears the engine's
 *   localStorage snapshot so re-opening the same framework starts fresh —
 *   same behavior as AppShell's Start.
 */
export function FrameworkRunner({
  spec,
  catalog,
  sourcesIndex,
  benchmarks,
}: {
  spec: FrameworkSpec;
  catalog: CatalogEntry[];
  sourcesIndex: SourcesIndex;
  benchmarks: Benchmarks;
}) {
  const router = useRouter();
  const onExit = useCallback(() => {
    if (typeof window !== "undefined") {
      clearSnapshot(window.localStorage, spec.id);
    }
    router.push("/frameworks");
  }, [router, spec.id]);

  return (
    <WorkflowRunner
      spec={spec}
      sourcesIndex={sourcesIndex}
      benchmarks={benchmarks}
      catalog={catalog}
      routeAlternatives={[]}
      onExit={onExit}
    />
  );
}
