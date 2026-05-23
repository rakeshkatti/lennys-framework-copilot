import Link from "next/link";
import { loadCatalog, type CatalogEntry } from "@lib/catalog";
import { resolveSource } from "@lib/sources";

/**
 * Catalog page: every framework the router can match, grouped by category.
 *
 * This is a server component — `loadCatalog()` reads `data/catalog.json` at
 * request time, no client bundle cost. The page is read-only by design: this
 * is the "what's in the box" view; the interactive workflow / guidance is
 * accessed via the home-page entry → routing flow, not direct deep links.
 *
 * Source links route through `resolveSource`, which returns a Google
 * site-search URL (Lenny's Substack truncates post slugs, so direct
 * filename-based URLs from `index.json` 404 too often to be useful).
 */

/** Stable category order; unknowns sort alphabetically at the end. */
const CATEGORY_ORDER: readonly string[] = [
  "Strategy",
  "Product-Market Fit",
  "Growth",
  "GTM & Sales",
  "Prioritization & Planning",
  "Metrics & Benchmarks",
  "Pricing",
  "Research & Discovery",
  "Communication & Influence",
  "Team & Operating Model",
  "Hiring",
  "Fundraising",
  "Career & Self-management",
];

function categoryRank(name: string): number {
  const i = CATEGORY_ORDER.indexOf(name);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

function groupByCategory(catalog: CatalogEntry[]): Map<string, CatalogEntry[]> {
  const groups = new Map<string, CatalogEntry[]>();
  for (const entry of catalog) {
    const list = groups.get(entry.category);
    if (list) {
      list.push(entry);
    } else {
      groups.set(entry.category, [entry]);
    }
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}

export default function FrameworksPage() {
  const catalog = loadCatalog();
  const groups = groupByCategory(catalog);
  const orderedCategories = [...groups.keys()].sort((a, b) => {
    const rank = categoryRank(a) - categoryRank(b);
    return rank !== 0 ? rank : a.localeCompare(b);
  });
  const workflowCount = catalog.filter((e) => e.tier === "workflow").length;

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <div className="mx-auto w-full max-w-5xl px-6 py-12 lg:px-10">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            ← Back to copilot
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {catalog.length} frameworks &middot; {orderedCategories.length}{" "}
            categories
          </p>
        </div>

        <h1 className="mt-4 text-3xl font-semibold text-slate-900 lg:text-4xl">
          All frameworks
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Every framework the router can match, extracted from Lenny&apos;s
          newsletter &amp; podcast archive.{" "}
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Workflow
          </span>{" "}
          frameworks ({workflowCount}) ship as interactive guided runs with a
          finished cited artifact; the rest show as read-only guidance with a
          link to the source piece.
        </p>

        <nav
          aria-label="Jump to category"
          className="mt-6 flex flex-wrap gap-2"
        >
          {orderedCategories.map((cat) => (
            <a
              key={cat}
              href={`#${slugify(cat)}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:border-slate-400 hover:text-slate-900"
            >
              {cat}{" "}
              <span className="text-slate-400">
                ({groups.get(cat)!.length})
              </span>
            </a>
          ))}
        </nav>

        {orderedCategories.map((cat) => {
          const entries = groups.get(cat)!;
          return (
            <section
              key={cat}
              id={slugify(cat)}
              className="mt-10 scroll-mt-6"
            >
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {cat}{" "}
                <span className="ml-1 font-normal text-slate-400">
                  ({entries.length})
                </span>
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {entries.map((entry) => (
                  <FrameworkCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function FrameworkCard({ entry }: { entry: CatalogEntry }) {
  // Each catalog entry can carry 1+ source files; surface the first as the
  // canonical link. The rest are searchable via the home-page routing flow.
  const primarySource = entry.source[0] ? resolveSource(entry.source[0]) : null;

  return (
    <article className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-tight text-slate-900">
          {entry.name}
        </h3>
        {entry.tier === "workflow" && (
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Workflow
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[11px] italic text-slate-500">
        {entry.decision_served}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-700">
        {entry.summary}
      </p>
      {primarySource && (
        <a
          href={primarySource.post_url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block self-start text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
        >
          ↳ {primarySource.title}
        </a>
      )}
    </article>
  );
}

/** Convert a category name to a URL-safe anchor id. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
