"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FrameworkSpec } from "@lib/spec";
import {
  renderArtifactMarkdown,
  type TriangulationRenderBlock,
} from "@lib/artifact/render";
import type { SourcesIndex } from "@lib/sources";

/**
 * Plan 5 — rendered artifact view.
 *
 * The existing renderArtifactMarkdown produces a single markdown string.
 * We split it at the triangulation boundary so the challenger block can
 * render with its own visually-distinct treatment (violet left border +
 * label), then re-join for Copy/Download (the exported file is still one
 * markdown document — splitting is purely a display concern).
 */

const TRIANGULATION_HEADER = /(^|\n)## Counter-perspective\b/m;

function splitArtifact(markdown: string): {
  primary: string;
  challenger: string | null;
} {
  const match = TRIANGULATION_HEADER.exec(markdown);
  if (!match || match.index === undefined) {
    return { primary: markdown, challenger: null };
  }
  // Keep the header on the challenger half; trim the leading newline if any.
  const idx = match.index + (match[1] ? 1 : 0);
  return {
    primary: markdown.slice(0, idx).trimEnd(),
    challenger: markdown.slice(idx).trimEnd(),
  };
}

/**
 * Markdown components map. Forces the Geist scale onto every node so the
 * artifact reads like a Lenny essay, not a default react-markdown render.
 */
const MD_COMPONENTS = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className="mt-0 text-3xl font-semibold leading-tight text-ink-strong sm:text-4xl"
      {...props}
    />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className="mt-8 text-xl font-semibold leading-tight text-ink-strong sm:text-2xl"
      {...props}
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className="mt-6 text-base font-semibold uppercase tracking-wide text-ink-muted"
      {...props}
    />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mt-3 text-[15px] leading-[1.7] text-ink-body" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className="mt-3 list-disc space-y-1 pl-6 text-[15px] leading-[1.7] text-ink-body"
      {...props}
    />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className="mt-3 list-decimal space-y-1 pl-6 text-[15px] leading-[1.7] text-ink-body"
      {...props}
    />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="mt-4 border-l-2 border-border-warm pl-4 text-[15px] italic leading-[1.7] text-ink-body"
      {...props}
    />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-brand underline-offset-2 hover:underline"
      {...props}
    />
  ),
  code: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => {
    // Inline code only — fenced blocks come through as <pre><code>; the
    // <pre> renderer below catches those. Use a chip-style background.
    const isInline = !className?.includes("language-");
    if (isInline) {
      return (
        <code
          className="rounded bg-peach px-1.5 py-0.5 font-mono text-[13px] text-ink-strong"
          {...props}
        />
      );
    }
    return <code className={className} {...props} />;
  },
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="mt-4 overflow-x-auto rounded-md bg-code-bg px-4 py-3 font-mono text-[13px] leading-relaxed text-code-text"
      {...props}
    />
  ),
  hr: () => <hr className="my-8 border-border-warm" />,
};

export function ArtifactExport({
  spec,
  inputs,
  sourcesIndex,
  triangulation,
}: {
  spec: FrameworkSpec;
  inputs: Record<string, unknown>;
  sourcesIndex?: SourcesIndex;
  triangulation?: TriangulationRenderBlock;
}) {
  const markdown = useMemo(
    () =>
      renderArtifactMarkdown(
        spec,
        inputs,
        {
          completedStepIds: new Set(
            Object.keys(inputs).filter((k) => inputs[k] !== undefined),
          ),
        },
        sourcesIndex,
        triangulation,
      ),
    [spec, inputs, sourcesIndex, triangulation],
  );

  const { primary, challenger } = useMemo(() => splitArtifact(markdown), [markdown]);

  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function handleDownload() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${spec.id}-artifact.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-10">
      <div className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded-card border border-border-warm bg-white/95 px-4 py-3 shadow-soft backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Final artifact
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="rounded-chip border border-border-warm bg-white px-3 py-1.5 text-xs font-medium text-ink-body shadow-sm transition hover:border-ink-subtle hover:text-ink-strong"
          >
            {copied ? "Copied!" : "Copy as Markdown"}
          </button>
          <button
            onClick={handleDownload}
            className="rounded-chip bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-hover"
          >
            Download .md
          </button>
        </div>
      </div>

      <article className="rounded-card-hero border border-border-warm bg-white px-6 py-8 shadow-soft sm:px-10 sm:py-10">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
          {primary}
        </ReactMarkdown>
      </article>

      {challenger && (
        <aside className="mt-6 rounded-card border-l-4 border-triangulation bg-triangulation-soft/40 px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-triangulation">
            Counter-perspective
          </p>
          <div className="mt-2">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                ...MD_COMPONENTS,
                // Demote the H2 inside the challenger block since the
                // "Counter-perspective" eyebrow above already labels the
                // section.
                h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
                  <h3
                    className="mt-0 text-lg font-semibold text-ink-strong"
                    {...props}
                  />
                ),
              }}
            >
              {challenger}
            </ReactMarkdown>
          </div>
        </aside>
      )}
    </section>
  );
}
