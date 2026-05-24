import Link from "next/link";
import { loadCatalog, type CatalogEntry } from "@lib/catalog";
import { resolveSource } from "@lib/sources";

/**
 * Catalog page: every framework the router can match, grouped by category.
 *
 * Server component — `loadCatalog()` reads `data/catalog.json` at request
 * time, no client bundle cost. Each card is a clickable link to
 * `/frameworks/[id]`, which opens the framework directly in WorkflowRunner
 * (skipping the home-page routing step, since the user explicitly chose).
 *
 * The source-piece link inside each card uses `relative z-10` to stay
 * clickable above the card-wide overlay link.
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
          Click any framework to apply it to a decision you&apos;re working on.
          You&apos;ll walk through it as an interactive workflow and finish
          with a cited artifact you can copy or download.
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

  // Card-link pattern: the whole card navigates to /frameworks/<id> via an
  // absolutely-positioned overlay on the title link. The source link below
  // sits at `relative z-10` so it stays clickable above the overlay and
  // opens in a new tab.
  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400 hover:shadow-md focus-within:border-slate-400 focus-within:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-tight text-slate-900">
          <Link
            href={`/frameworks/${entry.id}`}
            className="before:absolute before:inset-0 before:content-[''] focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 group-hover:text-slate-700"
          >
            {entry.name}
          </Link>
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
      <div className="mt-3 flex items-center justify-between gap-3">
        {primarySource ? (
          <a
            href={primarySource.post_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 inline-block text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            ↳ {primarySource.title}
          </a>
        ) : (
          <span />
        )}
        <span
          aria-hidden="true"
          className="text-[11px] font-medium text-slate-400 transition group-hover:text-slate-900"
        >
          Start →
        </span>
      </div>
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
