import { notFound } from "next/navigation";
import { getRun } from "@/lib/db/runs";
import { RunDetailView } from "../../../_components/run-detail-view";

const AGENT_ID = "jirita";

export default async function JiritaRunDetailPage({
  params,
}: PageProps<"/agents/jirita/runs/[runId]">) {
  const { runId } = await params;
  const run = getRun(runId);

  if (!run || run.agentId !== AGENT_ID) {
    notFound();
  }

  return <RunDetailView agentName="JIRITA QA Agent" run={run} />;
}
