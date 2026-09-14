"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { LiveRunState, RunOutcome, RunResult, TestCaseResult } from "@/lib/agents/types";
import { countPassedTestCases, countSteps } from "@/lib/agents/summary";
import { formatDuration } from "@/lib/format";
import { LiveRunModal } from "./live-run-modal";

const LIVE_POLL_INTERVAL_MS = 800;

function caseBadgeClasses(status: TestCaseResult["status"]): string {
  if (status === "passed") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
  }
  if (status === "skipped") {
    return "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500";
  }
  return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
}

function TestCaseBlock({ testCase }: { testCase: TestCaseResult }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400 dark:text-zinc-600">{testCase.id}</span>
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{testCase.name}</span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${caseBadgeClasses(testCase.status)}`}
        >
          {testCase.status.toUpperCase()}
        </span>
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-600">
          {formatDuration(testCase.durationMs)}
        </span>
      </div>
      <ul className="flex flex-col gap-0.5 pl-1 text-sm">
        {testCase.steps.map((step) => (
          <li key={step.id} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span
                className={
                  step.status === "passed"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }
              >
                {step.status === "passed" ? "✓" : "✗"}
              </span>
              <span className="text-zinc-700 dark:text-zinc-300">{step.name}</span>
              <span className="text-xs text-zinc-400 dark:text-zinc-600">
                {formatDuration(step.durationMs)}
              </span>
            </div>
            {step.message ? (
              <p className="pl-6 text-xs text-red-600 dark:text-red-400">{step.message}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunSummary({
  result,
  runId,
  persisted,
  runsBasePath,
}: {
  result: RunResult;
  runId?: string;
  persisted: boolean;
  runsBasePath: string;
}) {
  const passedCases = countPassedTestCases(result);
  const steps = countSteps(result);
  const isPassed = result.status === "passed";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
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
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {passedCases} / {result.testCases.length} test cases
        </span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {steps.passed} / {steps.total} steps
        </span>
        <span className="text-sm text-zinc-500 dark:text-zinc-500">
          Duration: {formatDuration(result.durationMs)}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {result.testCases.map((testCase) => (
          <TestCaseBlock key={testCase.id} testCase={testCase} />
        ))}
      </div>
      {persisted && runId ? (
        <Link
          href={`${runsBasePath}/${runId}`}
          className="text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          View run detail
        </Link>
      ) : (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          This run completed but its result could not be saved to history.
        </p>
      )}
    </div>
  );
}

type RunState = {
  result: RunResult;
  runId?: string;
  persisted: boolean;
};

export function RunAgentButton({
  agentName,
  runAction,
  runsBasePath,
}: {
  agentName: string;
  runAction: (runId: string) => Promise<RunOutcome>;
  runsBasePath: string;
}) {
  const [state, setState] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [liveState, setLiveState] = useState<LiveRunState | null>(null);
  const [frameVersion, setFrameVersion] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const activeRunId = useRef<string | null>(null);
  const pollHandle = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollHandle.current !== null) {
      clearInterval(pollHandle.current);
      pollHandle.current = null;
    }
    activeRunId.current = null;
    setLiveState(null);
  }

  function startPolling(runId: string) {
    activeRunId.current = runId;
    setLiveState(null);
    setFrameVersion(0);

    const poll = async () => {
      if (activeRunId.current !== runId) return;
      try {
        const response = await fetch(`/agents/runs/${runId}/live`, { cache: "no-store" });
        if (activeRunId.current !== runId) return;
        if (response.ok) {
          const data = (await response.json()) as LiveRunState;
          setLiveState(data);
          setFrameVersion((version) => version + 1);
        }
      } catch {
        // Best-effort: a missed poll just tries again on the next tick.
      }
    };

    poll();
    pollHandle.current = setInterval(poll, LIVE_POLL_INTERVAL_MS);
  }

  useEffect(() => {
    return () => {
      if (pollHandle.current !== null) clearInterval(pollHandle.current);
    };
  }, []);

  function handleRun() {
    setError(null);
    setState(null);
    setModalOpen(true);
    const runId = crypto.randomUUID();
    startPolling(runId);

    startTransition(async () => {
      try {
        const outcome = await runAction(runId);
        setState(outcome);
      } catch {
        setState(null);
        setError("The agent run could not be started. Please try again.");
        setModalOpen(false);
      } finally {
        stopPolling();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button
          type="button"
          onClick={handleRun}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending ? "Running…" : "Run Agent"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {modalOpen ? (
        <LiveRunModal
          agentName={agentName}
          phase={isPending ? "running" : "done"}
          liveState={liveState}
          frameSrc={liveState ? `/agents/runs/${liveState.runId}/live/frame?v=${frameVersion}` : null}
          outcome={!isPending ? state : null}
          onDone={() => setModalOpen(false)}
        />
      ) : null}
      {!modalOpen && state ? (
        <RunSummary
          result={state.result}
          runId={state.runId}
          persisted={state.persisted}
          runsBasePath={runsBasePath}
        />
      ) : null}
    </div>
  );
}
