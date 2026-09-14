import type { LiveRunState, RunOutcome } from "@/lib/agents/types";
import { countPassedTestCases, countSteps } from "@/lib/agents/summary";

/**
 * Case-weighted progress: each Test Case is an equal slice of the bar, and
 * within the current case we advance by step position. This only needs the
 * fields LiveRunState already has — getting a true global
 * completed-steps/total-steps figure would need the runners to track and
 * report a running total, which is out of scope for this UI-only change.
 * The result is still real (derived from actual poll data), monotonically
 * non-decreasing, and reaches 100% by the last step of the last case.
 */
function progressPercentFor(liveState: LiveRunState | null): number {
  if (!liveState) return 0;
  const caseFraction =
    liveState.totalStepsInCase > 0 ? liveState.currentStepIndex / liveState.totalStepsInCase : 0;
  const fraction = (liveState.currentCaseIndex - 1 + caseFraction) / liveState.totalCases;
  return Math.round(Math.min(1, Math.max(0, fraction)) * 100);
}

function findFirstFailureMessage(outcome: RunOutcome): string | null {
  for (const testCase of outcome.result.testCases) {
    for (const step of testCase.steps) {
      if (step.status === "failed" && step.message) {
        return `${testCase.id} — ${step.name}: ${step.message}`;
      }
    }
  }
  return null;
}

function ProgressBar({ percent, tone }: { percent: number; tone: "running" | "passed" | "failed" }) {
  const barClasses =
    tone === "passed"
      ? "bg-emerald-500"
      : tone === "failed"
        ? "bg-red-500"
        : "bg-amber-500";

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${barClasses}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        {percent}%
      </span>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "running" | "passed" | "failed" }) {
  const classes =
    tone === "passed"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
      : tone === "failed"
        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}
    >
      {tone === "running" ? (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
      ) : null}
      {label}
    </span>
  );
}

export function LiveRunModal({
  agentName,
  phase,
  liveState,
  frameSrc,
  outcome,
  onDone,
}: {
  agentName: string;
  phase: "running" | "done";
  liveState: LiveRunState | null;
  frameSrc: string | null;
  outcome: RunOutcome | null;
  onDone: () => void;
}) {
  const isDone = phase === "done" && outcome !== null;
  const isPassed = isDone && outcome.result.status === "passed";
  const tone: "running" | "passed" | "failed" = !isDone ? "running" : isPassed ? "passed" : "failed";
  const percent = isDone ? 100 : progressPercentFor(liveState);

  return (
    // No backdrop onClick and no Escape handling: the modal only closes via
    // the "Done" button below, once the run has actually finished.
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${agentName} run progress`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{agentName}</h2>
          <StatusBadge label={tone === "running" ? "RUNNING" : tone === "passed" ? "PASSED" : "FAILED"} tone={tone} />
        </div>

        <ProgressBar percent={percent} tone={tone} />

        {!isDone ? (
          <>
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              {liveState ? (
                <>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    TC {liveState.currentCaseIndex}/{liveState.totalCases} · Step{" "}
                    {liveState.currentStepIndex}/{liveState.totalStepsInCase}
                  </p>
                  <p className="mt-1 font-medium">{liveState.currentCaseName}</p>
                  <p className="text-zinc-600 dark:text-zinc-400">{liveState.currentStepName}</p>
                </>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Starting…</p>
              )}
            </div>

            <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
              {liveState?.frameAvailable && frameSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- authenticated, constantly-changing local file, not a static asset Next can optimize
                <img
                  src={frameSrc}
                  alt="Live browser preview"
                  className="max-h-[28rem] w-full object-contain"
                />
              ) : (
                <p className="p-6 text-xs text-zinc-400 dark:text-zinc-600">Waiting for browser preview…</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              <p>
                {countPassedTestCases(outcome.result)} / {outcome.result.testCases.length} test cases ·{" "}
                {countSteps(outcome.result).passed} / {countSteps(outcome.result).total} steps
              </p>
              {!isPassed ? (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {findFirstFailureMessage(outcome) ?? "One or more steps failed."}
                </p>
              ) : null}
              {!outcome.persisted ? (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  This run completed but its result could not be saved to history.
                </p>
              ) : null}
            </div>

            <div>
              <button
                type="button"
                onClick={onDone}
                className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
