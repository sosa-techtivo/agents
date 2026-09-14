import type { PersistedRun } from "@/lib/db/runs";
import { RunHistory } from "./run-history";
import { TestCasePlan, type TestCasePlanItem } from "./test-case-plan";

// Dashboard-style two-column layout: Test Cases (~60%) on the left, Run
// History (~40%) on the right, stacking to one column on narrow viewports.
export function AgentWorkspace({
  testCases,
  runs,
  runsBasePath,
  agentName,
}: {
  testCases: TestCasePlanItem[];
  runs: PersistedRun[];
  runsBasePath: string;
  agentName: string;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] lg:gap-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">Test Cases</h2>
        <div className="mt-2">
          <TestCasePlan testCases={testCases} />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">Run History</h2>
        <RunHistory runs={runs} runsBasePath={runsBasePath} agentName={agentName} />
      </section>
    </div>
  );
}
