"use client";

import { useMemo } from "react";
import type { CatalogEntry } from "@lib/catalog";
import type { RouteResult } from "@lib/route/router";
import type { SourceEntry, SourcesIndex } from "@lib/sources";

const CONFIDENCE_FLOOR = 0.6;

/** Resolve a framework id to its catalog entry via a prebuilt lookup map. */
function entryFor(
  id: string,
  byId: Map<string, CatalogEntry>,
): CatalogEntry | null {
  return byId.get(id) ?? null;
}

/** Resolve the source chip for a framework: its first source file → SourceEntry. */
function sourceFor(
  entry: CatalogEntry | null,
  sourcesIndex: SourcesIndex,
): SourceEntry | null {
  const file = entry?.source[0];
  if (!file) return null;
  return sourcesIndex[file] ?? null;
}

/**
 * Source chip. When `post_url` is set, renders a link to the original article;
 * when `null` (most podcast sources), renders the title as plain text so we
 * never produce a broken or empty link.
 */
function SourceChip({ source }: { source: SourceEntry | null }) {
  if (!source) return null;

  const base =
    "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600";

  if (source.post_url) {
    return (
      <a
        href={source.post_url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} transition hover:border-slate-400 hover:text-slate-900`}
      >
        <span aria-hidden>↗</span>
        {source.title}
      </a>
    );
  }

  return (
    <span className={base}>
      <span aria-hidden>◆</span>
      {source.title}
    </span>
  );
}

/** A selectable framework option with a Start action. Used in normal + low-confidence states. */
function FrameworkChoice({
  entry,
  source,
  onStart,
  emphasis,
}: {
  entry: CatalogEntry;
  source: SourceEntry | null;
  onStart: () => void;
  emphasis: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        emphasis
          ? "border-slate-300 bg-white shadow-sm"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            {entry.category}
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {entry.name}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {entry.summary}
          </p>
        </div>
        <button
          onClick={onStart}
          className="mt-1 shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Start →
        </button>
      </div>
      {source && (
        <div className="mt-3">
          <SourceChip source={source} />
        </div>
      )}
    </div>
  );
}

export function RoutingCard({
  result,
  catalog,
  sourcesIndex,
  onStart,
  onReset,
}: {
  result: RouteResult;
  catalog: CatalogEntry[];
  sourcesIndex: SourcesIndex;
  onStart: (frameworkId: string) => void;
  onReset: () => void;
}) {
  const byId = useMemo(
    () => new Map(catalog.map((e) => [e.id, e])),
    [catalog],
  );

  const picked = result.framework_id
    ? entryFor(result.framework_id, byId)
    : null;

  // Alternatives that resolve to a real catalog entry.
  const alternatives = useMemo(
    () =>
      result.alternatives
        .map((id) => entryFor(id, byId))
        .filter((e): e is CatalogEntry => e !== null),
    [result.alternatives, byId],
  );

  // Nearest reading suggestions for the cold-start state.
  const nearest = useMemo(
    () =>
      result.nearest
        .map((id) => entryFor(id, byId))
        .filter((e): e is CatalogEntry => e !== null),
    [result.nearest, byId],
  );

  const isColdStart = result.framework_id === null || picked === null;
  const isLowConfidence =
    !isColdStart && result.confidence < CONFIDENCE_FLOOR;

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 lg:px-10">
        <button
          onClick={onReset}
          className="mb-4 self-start text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Start over
        </button>

        {isColdStart ? (
          <ColdStart nearest={nearest} sourcesIndex={sourcesIndex} />
        ) : isLowConfidence ? (
          <LowConfidence
            picked={picked}
            alternatives={alternatives}
            sourcesIndex={sourcesIndex}
            onStart={onStart}
          />
        ) : (
          <Normal
            picked={picked}
            result={result}
            alternatives={alternatives}
            sourcesIndex={sourcesIndex}
            onStart={onStart}
          />
        )}
      </div>
    </main>
  );
}

/** Normal state: one confident pick, alternatives shown as an "also considered" line. */
function Normal({
  picked,
  result,
  alternatives,
  sourcesIndex,
  onStart,
}: {
  picked: CatalogEntry;
  result: RouteResult;
  alternatives: CatalogEntry[];
  sourcesIndex: SourcesIndex;
  onStart: (frameworkId: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Recommended framework
      </p>
      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
          {picked.category}
        </p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight text-slate-900">
          {picked.name}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          {result.reasoning}
        </p>

        <div className="mt-5">
          <SourceChip source={sourceFor(picked, sourcesIndex)} />
        </div>

        <button
          onClick={() => onStart(picked.id)}
          className="mt-6 rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Start →
        </button>
      </div>

      {alternatives.length > 0 && (
        <p className="mt-4 text-sm text-slate-600">
          Also considered:{" "}
          {alternatives.map((alt, i) => (
            <span key={alt.id}>
              {i > 0 && ", "}
              <button
                onClick={() => onStart(alt.id)}
                className="font-medium text-slate-700 underline hover:no-underline"
              >
                {alt.name}
              </button>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}

/** Low-confidence state: pick + alternatives presented as equal-weight choices. */
function LowConfidence({
  picked,
  alternatives,
  sourcesIndex,
  onStart,
}: {
  picked: CatalogEntry;
  alternatives: CatalogEntry[];
  sourcesIndex: SourcesIndex;
  onStart: (frameworkId: string) => void;
}) {
  // De-duplicate in case an alternative repeats the pick.
  const seen = new Set<string>();
  const choices = [picked, ...alternatives].filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        A few frameworks could fit — pick one
      </p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight text-slate-900">
        Your decision spans a few frameworks
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        We weren&apos;t confident enough to pick just one. These are the
        closest matches — choose whichever fits best.
      </p>

      <div className="mt-6 space-y-3">
        {choices.map((entry) => (
          <FrameworkChoice
            key={entry.id}
            entry={entry}
            source={sourceFor(entry, sourcesIndex)}
            onStart={() => onStart(entry.id)}
            emphasis={false}
          />
        ))}
      </div>
    </div>
  );
}

/** Cold-start state: no clean match — show nearest related reading. */
function ColdStart({
  nearest,
  sourcesIndex,
}: {
  nearest: CatalogEntry[];
  sourcesIndex: SourcesIndex;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        No clean match
      </p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight text-slate-900">
        No clean match — here&apos;s the closest related reading
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        We couldn&apos;t route this decision to a framework. These pieces from
        the archive are the closest related reading.
      </p>

      {nearest.length > 0 ? (
        <div className="mt-6 space-y-3">
          {nearest.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                {entry.category}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {entry.name}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {entry.summary}
              </p>
              <div className="mt-3">
                <SourceChip source={sourceFor(entry, sourcesIndex)} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm italic text-slate-500">
          Try describing your decision in more detail and routing again.
        </p>
      )}
    </div>
  );
}
