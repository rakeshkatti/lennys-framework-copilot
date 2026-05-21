import { loadCatalog, loadQuestionBank } from "@lib/catalog";
import { loadSourcesIndex } from "@lib/sources";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function Home() {
  const catalog = loadCatalog();
  const questionBank = loadQuestionBank();
  const sourcesIndex = loadSourcesIndex();

  return (
    <AppShell
      catalog={catalog}
      questionBank={questionBank}
      sourcesIndex={sourcesIndex}
    />
  );
}
