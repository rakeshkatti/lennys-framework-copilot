import { loadSpec } from "@lib/loadSpec";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function Home() {
  const spec = loadSpec("drice");
  return <AppShell spec={spec} />;
}
