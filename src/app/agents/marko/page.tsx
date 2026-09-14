import Link from "next/link";
import { RunAgentButton } from "./run-agent-button";
import { listRuns } from "@/lib/db/runs";
import { countPassedTestCases, countSteps } from "@/lib/marko/summary";
import { formatDateTime, formatDuration } from "@/lib/format";

const AGENT_ID = "marko";

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

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">Test Cases</h2>
        <div className="mt-4 flex flex-col gap-4">
          {testCases.map((testCase) => (
            <div key={testCase.id}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 dark:text-zinc-600">{testCase.id}</span>
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {testCase.name}
                </span>
              </div>
              <ol className="mt-1.5 list-decimal space-y-1 pl-9 text-sm text-zinc-700 dark:text-zinc-300">
                {testCase.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <RunAgentButton />

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">Run History</h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No runs yet</p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {runs.map((run) => {
              const passedCases = countPassedTestCases(run);
              const steps = countSteps(run);
              const isPassed = run.status === "passed";

              return (
                <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isPassed
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
                      }`}
                    >
                      {isPassed ? "PASSED" : "FAILED"}
                    </span>
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {formatDateTime(run.startedAt)}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-500">
                      {passedCases} / {run.testCases.length} test cases
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-500">
                      {steps.passed} / {steps.total} steps
                    </span>
                    <span className="text-zinc-400 dark:text-zinc-600">
                      {formatDuration(run.durationMs)}
                    </span>
                  </div>
                  <Link
                    href={`/agents/marko/runs/${run.id}`}
                    className="text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                  >
                    View
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
