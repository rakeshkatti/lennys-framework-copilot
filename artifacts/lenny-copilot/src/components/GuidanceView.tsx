"use client";

import { useMemo } from "react";
import type { CatalogEntry } from "@lib/catalog";
import type { SourceEntry, SourcesIndex } from "@lib/sources";

/**
 * One resolved reference: the catalog source filename paired with its
 * SourceEntry (or null when the file isn't in the index).
 */
interface ResolvedReference {
  file: string;
  source: SourceEntry | null;
}

/**
 * "Read the full piece" reference. When `post_url` is set, renders a link to
 * the original article; when `null` (most podcast sources) or unresolved,
 * renders plain text so we never produce a broken or empty link.
 */
function ReferenceLink({ reference }: { reference: ResolvedReference }) {
  const { file, source } = reference;
  const label = source?.title ?? file;

  const base =
    "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600";

  if (source?.post_url) {
    return (
      <a
        href={source.post_url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} transition hover:border-slate-400 hover:text-slate-900`}
      >
        <span aria-hidden>↗</span>
        Read the full piece — {label}
      </a>
    );
  }

  return (
    <span className={base}>
      <span aria-hidden>◆</span>
      {label}
    </span>
  );
}

/**
 * Read-only guidance view for a `tier: "guidance"` catalog entry. Renders the
 * framework's already-extracted content (name, category, summary, key steps,
 * decision served) plus reference links to the original archive pieces. No
 * interactive workflow and no LLM generation.
 */
export function GuidanceView({
  entry,
  sourcesIndex,
  onReset,
}: {
  entry: CatalogEntry;
  sourcesIndex: SourcesIndex;
  onReset: () => void;
}) {
  const references = useMemo<ResolvedReference[]>(
    () =>
      entry.source.map((file) => ({
        file,
        source: sourcesIndex[file] ?? null,
      })),
    [entry.source, sourcesIndex],
  );

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 lg:px-10">
        <button
          onClick={onReset}
          className="mb-4 self-start text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Start over
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            {entry.category}
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight text-slate-900">
            {entry.name}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-700">
            {entry.summary}
          </p>

          {entry.key_steps.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Key steps
              </p>
              <ol className="mt-3 space-y-2">
                {entry.key_steps.map((stepText, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-slate-700">
                      {stepText}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              When to use it
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {entry.decision_served}
            </p>
          </div>

          {references.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {references.length > 1 ? "Read the full pieces" : "Read more"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {references.map((reference) => (
                  <ReferenceLink key={reference.file} reference={reference} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
