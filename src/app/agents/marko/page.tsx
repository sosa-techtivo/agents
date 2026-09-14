import { runMarko } from "./actions";
import { listRuns } from "@/lib/db/runs";
import { RunAgentButton } from "../_components/run-agent-button";
import { AgentWorkspace } from "../_components/agent-workspace";

const AGENT_ID = "marko";
const RUNS_BASE_PATH = "/agents/marko/runs";

const testCases = [
  { id: "TC-01", name: "Authentication", steps: ["Open MARKO", "Sign in"] },
  {
    id: "TC-02",
    name: "Sites Dashboard",
    steps: ["Validate Sites dashboard", "Open Techtivo.com report"],
  },
  {
    id: "TC-03",
    name: "SEO Report",
    steps: [
      "Validate SEO health",
      "Validate MARKO Insights",
      "Validate Analysis history",
      "Validate Search Console",
    ],
  },
  { id: "TC-04", name: "Sign Out", steps: ["Sign out"] },
];

export default function MarkoAgentPage() {
  const runs = listRuns(AGENT_ID);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">MARKO QA Agent</h1>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Ready
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Functional product QA for MARKO.
        </p>
      </div>

      <RunAgentButton agentName="MARKO QA Agent" runAction={runMarko} />

      <AgentWorkspace
        testCases={testCases}
        runs={runs}
        runsBasePath={RUNS_BASE_PATH}
        agentName="MARKO QA Agent"
      />
    </div>
  );
}
