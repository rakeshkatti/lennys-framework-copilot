import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cream to-peach px-6 py-16">
      <article className="w-full max-w-md rounded-card-hero border border-border-warm bg-white p-8 text-center shadow-soft-lg lg:p-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Hmm
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-ink-strong sm:text-3xl">
          We don&apos;t have that one in the archive yet.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-body">
          The page you were looking for isn&apos;t a framework we know about —
          or it never existed. Head back to the copilot and route a decision
          from scratch.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="rounded-chip bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
          >
            Back to the co-pilot →
          </Link>
        </div>
      </article>
    </main>
  );
}
