"use client";

import { useState } from "react";
import type { PersistedRun } from "@/lib/db/runs";
import { countPassedTestCases, countSteps } from "@/lib/agents/summary";
import { formatDateTime, formatDuration } from "@/lib/format";
import { RunDetailModal } from "./run-detail-modal";

export function RunHistory({
  runs,
  runsBasePath,
  agentName,
}: {
  runs: PersistedRun[];
  runsBasePath: string;
  agentName: string;
}) {
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  if (runs.length === 0) {
    return <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No runs yet</p>;
  }

  return (
    <>
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
                <span className="text-zinc-700 dark:text-zinc-300">{formatDateTime(run.startedAt)}</span>
                <span className="text-zinc-500 dark:text-zinc-500">
                  {passedCases} / {run.testCases.length} test cases
                </span>
                <span className="text-zinc-500 dark:text-zinc-500">
                  {steps.passed} / {steps.total} steps
                </span>
                <span className="text-zinc-400 dark:text-zinc-600">{formatDuration(run.durationMs)}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpenRunId(run.id)}
                className="text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                View
              </button>
            </li>
          );
        })}
      </ul>
      {openRunId ? (
        <RunDetailModal
          agentName={agentName}
          runId={openRunId}
          runsBasePath={runsBasePath}
          onClose={() => setOpenRunId(null)}
        />
      ) : null}
    </>
  );
}
