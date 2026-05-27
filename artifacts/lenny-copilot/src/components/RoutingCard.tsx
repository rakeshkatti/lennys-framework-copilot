"use client";

import { useMemo } from "react";
import type { CatalogEntry } from "@lib/catalog";
import type { RouteResult } from "@lib/route/router";
import type { SourceEntry, SourcesIndex } from "@lib/sources";

const CONFIDENCE_FLOOR = 0.6;

function entryFor(
  id: string,
  byId: Map<string, CatalogEntry>,
): CatalogEntry | null {
  return byId.get(id) ?? null;
}

function sourceFor(
  entry: CatalogEntry | null,
  sourcesIndex: SourcesIndex,
): SourceEntry | null {
  const file = entry?.source[0];
  if (!file) return null;
  return sourcesIndex[file] ?? null;
}

/**
 * Source-piece chip. Links to a working URL via `loadSourcesIndex` which
 * rewrites every `post_url` to a Google site-search URL (Lenny's Substack
 * truncates filename slugs and the direct URLs 404).
 */
function SourceChip({ source }: { source: SourceEntry | null }) {
  if (!source) return null;
  const base =
    "inline-flex items-center gap-1 rounded-chip border border-border-warm bg-white px-3 py-1 text-xs text-ink-body";
  if (source.post_url) {
    return (
      <a
        href={source.post_url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} transition hover:border-ink-subtle hover:text-ink-strong`}
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

/**
 * Primary picked framework — editorial card. Used when confidence >= floor.
 * Uses the `card-hero` radius + soft-lg shadow per DESIGN.md.
 */
function PrimaryPick({
  entry,
  source,
  reasoning,
  onStart,
}: {
  entry: CatalogEntry;
  source: SourceEntry | null;
  reasoning: string;
  onStart: () => void;
}) {
  return (
    <article className="rounded-card-hero border border-border-warm bg-white p-8 shadow-soft-lg lg:p-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">
        {entry.category}
      </p>
      <h2 className="mt-2 text-2xl font-semibold leading-tight text-ink-strong sm:text-3xl">
        {entry.name}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-body">
        This fits because {reasoning.charAt(0).toLowerCase() + reasoning.slice(1)}
      </p>
      {source && (
        <div className="mt-4">
          <SourceChip source={source} />
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <button
          onClick={onStart}
          className="rounded-chip bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
        >
          Start →
        </button>
      </div>
    </article>
  );
}

/**
 * Alternatives chip strip. Each chip is clickable; selecting an alternative
 * fires `onStart(id)` directly (no extra confirmation — user has already
 * committed to a framework by clicking).
 */
function AlternativesStrip({
  ids,
  byId,
  onStart,
}: {
  ids: string[];
  byId: Map<string, CatalogEntry>;
  onStart: (id: string) => void;
}) {
  if (ids.length === 0) return null;
  const entries = ids.map((id) => byId.get(id)).filter(Boolean) as CatalogEntry[];
  if (entries.length === 0) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        Also considered:
      </span>
      {entries.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => onStart(e.id)}
          className="rounded-chip border border-border-warm bg-white px-3 py-1 text-xs font-medium text-ink-body shadow-sm transition hover:border-ink-subtle hover:text-ink-strong hover:shadow"
        >
          {e.name}
        </button>
      ))}
    </div>
  );
}

/**
 * Low-confidence state — show top 2-3 candidates as equal choices.
 * Each rendered with the same editorial card treatment but smaller.
 */
function LowConfidence({
  candidates,
  sourcesIndex,
  onStart,
}: {
  candidates: CatalogEntry[];
  sourcesIndex: SourcesIndex;
  onStart: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-border-warm bg-white/60 p-4 text-sm text-ink-body">
        <p className="font-medium text-ink-strong">
          A few frameworks could fit this — pick one to start.
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          We weren&apos;t fully confident about a single match. These are the
          closest candidates in the catalog.
        </p>
      </div>
      {candidates.map((entry) => (
        <article
          key={entry.id}
          className="rounded-card border border-border-warm bg-white p-5 shadow-soft"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                {entry.category}
              </p>
              <h3 className="mt-1 text-base font-semibold text-ink-strong">
                {entry.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-body">
                {entry.summary}
              </p>
            </div>
            <button
              onClick={() => onStart(entry.id)}
              className="mt-1 shrink-0 rounded-chip bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover"
            >
              Start →
            </button>
          </div>
          {sourceFor(entry, sourcesIndex) && (
            <div className="mt-3">
              <SourceChip source={sourceFor(entry, sourcesIndex)} />
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

/**
 * Cold-start (no framework match). Shows nearest related reading and a
 * friendly nudge.
 */
function ColdStart({
  nearest,
  sourcesIndex,
  byId,
  onReset,
}: {
  nearest: string[];
  sourcesIndex: SourcesIndex;
  byId: Map<string, CatalogEntry>;
  onReset: () => void;
}) {
  const entries = nearest
    .map((id) => byId.get(id))
    .filter(Boolean) as CatalogEntry[];
  return (
    <article className="rounded-card-hero border border-border-warm bg-white p-8 shadow-soft-lg lg:p-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Hmm
      </p>
      <h2 className="mt-2 text-2xl font-semibold leading-tight text-ink-strong">
        No clean framework match for that decision.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-body">
        Try describing the decision in a bit more detail — what role you&apos;re
        in, what you&apos;ve already tried, and what success looks like — and
        we&apos;ll route it again.
      </p>
      {entries.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Closest related reading
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {entries.map((e) => (
              <SourceChip key={e.id} source={sourceFor(e, sourcesIndex)} />
            ))}
          </div>
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <button
          onClick={onReset}
          className="rounded-chip border border-border-warm bg-white px-5 py-2.5 text-sm font-medium text-ink-body shadow-sm transition hover:border-ink-subtle hover:text-ink-strong"
        >
          ← Try a different decision
        </button>
      </div>
    </article>
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

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-cream to-peach">
      <div className="mx-auto w-full max-w-3xl px-6 py-12 lg:px-8 lg:py-16">
        <button
          onClick={onReset}
          className="text-xs font-medium text-ink-muted underline-offset-2 transition hover:text-ink-strong hover:underline"
        >
          ← Back to the entry
        </button>

        <div className="mt-4">
          {result.framework_id === null ? (
            <ColdStart
              nearest={result.nearest}
              sourcesIndex={sourcesIndex}
              byId={byId}
              onReset={onReset}
            />
          ) : result.confidence < CONFIDENCE_FLOOR ? (
            <LowConfidence
              candidates={[result.framework_id, ...result.alternatives]
                .map((id) => entryFor(id, byId))
                .filter(Boolean) as CatalogEntry[]}
              sourcesIndex={sourcesIndex}
              onStart={onStart}
            />
          ) : (
            <>
              <PrimaryPick
                entry={entryFor(result.framework_id, byId)!}
                source={sourceFor(entryFor(result.framework_id, byId), sourcesIndex)}
                reasoning={result.reasoning}
                onStart={() => onStart(result.framework_id!)}
              />
              <AlternativesStrip
                ids={result.alternatives}
                byId={byId}
                onStart={onStart}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
