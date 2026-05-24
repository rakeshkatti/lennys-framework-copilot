import Link from "next/link";
import { loadCatalog, type CatalogEntry } from "@lib/catalog";
import { resolveSource } from "@lib/sources";

/**
 * Plan 5 — catalog page redesign (Slice 3 / Explore).
 *
 * Cream-to-peach gradient page background; white header card with H1 +
 * benefit-led description + category jump-nav as a pill strip; each
 * category section as a labeled block with a 2-col (md) / 3-col (lg)
 * card grid; cards have hover-lift + explicit Start affordance.
 *
 * Card-link pattern: title link gets an absolute overlay so the whole
 * card navigates to /frameworks/<id>; source-link sits at z-10 to stay
 * clickable above the overlay.
 */

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
    if (list) list.push(entry);
    else groups.set(entry.category, [entry]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function FrameworksPage() {
  const catalog = loadCatalog();
  const groups = groupByCategory(catalog);
  const orderedCategories = [...groups.keys()].sort((a, b) => {
    const rank = categoryRank(a) - categoryRank(b);
    return rank !== 0 ? rank : a.localeCompare(b);
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-cream to-peach">
      <div className="mx-auto w-full max-w-5xl px-6 py-12 lg:px-8 lg:py-16">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-medium text-ink-muted underline-offset-2 transition hover:text-ink-strong hover:underline"
          >
            ← Back to copilot
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {catalog.length} frameworks · {orderedCategories.length} categories
          </p>
        </div>

        <section className="mt-4 rounded-card-hero border border-border-warm bg-white p-8 shadow-soft-lg lg:p-10">
          <h1 className="text-3xl font-semibold leading-tight text-ink-strong sm:text-4xl">
            All frameworks
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-body">
            Click any framework to apply it to a decision you&apos;re working on.
            You&apos;ll walk through it as an interactive workflow and finish
            with a cited artifact you can copy or download.
          </p>
          <nav
            aria-label="Jump to category"
            className="mt-5 flex flex-wrap gap-2"
          >
            {orderedCategories.map((cat) => (
              <a
                key={cat}
                href={`#${slugify(cat)}`}
                className="rounded-chip border border-border-warm bg-white px-3 py-1 text-[11px] font-medium text-ink-body shadow-sm transition hover:border-brand-accent hover:text-ink-strong"
              >
                {cat}{" "}
                <span className="text-ink-subtle">
                  ({groups.get(cat)!.length})
                </span>
              </a>
            ))}
          </nav>
        </section>

        {orderedCategories.map((cat) => {
          const entries = groups.get(cat)!;
          return (
            <section
              key={cat}
              id={slugify(cat)}
              className="mt-12 scroll-mt-24"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                {cat}{" "}
                <span className="ml-1 font-normal text-ink-subtle">
                  ({entries.length})
                </span>
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  const primarySource = entry.source[0] ? resolveSource(entry.source[0]) : null;

  return (
    // Whole-card focus/hover: hover/focus-within lift the card, swap to
    // brand-accent border, and draw a brand-orange ring around the entire
    // article when the inner title link is focused (keyboard or click).
    // The title link itself has its native outline suppressed so the only
    // visible focus affordance is the card-wide ring — clicking anywhere
    // on the card therefore highlights the card, not the title.
    <article className="group relative flex h-full flex-col rounded-card border border-border-warm bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-accent hover:shadow-soft-lg focus-within:-translate-y-0.5 focus-within:border-brand-accent focus-within:shadow-soft-lg focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 focus-within:ring-offset-cream">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold leading-tight text-ink-strong">
          <Link
            href={`/frameworks/${entry.id}`}
            className="before:absolute before:inset-0 before:content-[''] focus:outline-none"
          >
            {entry.name}
          </Link>
        </h3>
        {entry.tier === "workflow" && (
          <span className="shrink-0 rounded-chip border border-brand-soft bg-peach px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-hover">
            Workflow
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[11px] italic text-ink-muted">
        {entry.decision_served}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-body">
        {entry.summary}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
        {primarySource ? (
          <a
            href={primarySource.post_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 inline-block text-[11px] font-medium text-ink-muted underline-offset-2 transition hover:text-ink-strong hover:underline"
          >
            ↳ {primarySource.title}
          </a>
        ) : (
          <span />
        )}
        <span
          aria-hidden="true"
          className="text-[11px] font-semibold text-ink-subtle transition group-hover:text-brand group-focus-within:text-brand"
        >
          Start →
        </span>
      </div>
    </article>
  );
}
