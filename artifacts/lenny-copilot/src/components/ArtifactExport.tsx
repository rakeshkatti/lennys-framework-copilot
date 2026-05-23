"use client";

import { useMemo, useState } from "react";
import type { FrameworkSpec } from "@lib/spec";
import {
  renderArtifactMarkdown,
  type TriangulationRenderBlock,
} from "@lib/artifact/render";
import type { SourcesIndex } from "@lib/sources";

export function ArtifactExport({
  spec,
  inputs,
  sourcesIndex,
  triangulation,
}: {
  spec: FrameworkSpec;
  inputs: Record<string, unknown>;
  /** When provided, the exported "## Sources" block links each source file to
   *  its original article. When absent, sources render as filenames. */
  sourcesIndex?: SourcesIndex;
  /** When provided, the markdown export appends the triangulation 3-block.
   *  When absent, output is byte-identical to the pre-triangulation form. */
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

  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: a textarea selection trick is overkill — the user can
      // download instead.
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
    <section className="mt-8 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Final artifact
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {copied ? "Copied!" : "Copy as Markdown"}
          </button>
          <button
            onClick={handleDownload}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Download .md
          </button>
        </div>
      </div>
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words px-4 py-4 text-xs leading-relaxed text-slate-800">
        {markdown}
      </pre>
    </section>
  );
}
