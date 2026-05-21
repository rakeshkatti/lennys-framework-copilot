import { loadSpec } from "@lib/loadSpec";
import { WorkflowRunner } from "@/components/WorkflowRunner";

export const dynamic = "force-dynamic";

export default function Home() {
  const spec = loadSpec("drice");
  return <WorkflowRunner spec={spec} />;
}
