import { loadCatalog, loadQuestionBank } from "@lib/catalog";
import { loadSourcesIndex } from "@lib/sources";
import { loadBenchmarks } from "@lib/benchmark.server";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function Home() {
  const catalog = loadCatalog();
  const questionBank = loadQuestionBank();
  const sourcesIndex = loadSourcesIndex();
  const benchmarks = loadBenchmarks();

  return (
    <AppShell
      catalog={catalog}
      questionBank={questionBank}
      sourcesIndex={sourcesIndex}
      benchmarks={benchmarks}
    />
  );
}
