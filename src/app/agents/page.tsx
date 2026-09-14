import { getLastRun } from "@/lib/db/runs";
import { AgentCard } from "./_components/agent-card";

export default function AgentsPage() {
  const lastMarkoRun = getLastRun("marko");
  const lastJiritaRun = getLastRun("jirita");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Agents</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Functional QA agents for Techtivo products.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <AgentCard name="MARKO QA Agent" project="MARKO" href="/agents/marko" lastRun={lastMarkoRun} />
        <AgentCard
          name="JIRITA QA Agent"
          project="JIRITA"
          href="/agents/jirita"
          lastRun={lastJiritaRun}
        />
      </div>
    </div>
  );
}
