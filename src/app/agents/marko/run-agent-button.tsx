"use client";

import { useState, useTransition } from "react";
import { runMarko } from "./actions";
import type { RunResult } from "@/lib/marko/types";

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function RunSummary({ result }: { result: RunResult }) {
  const passedCount = result.steps.filter((step) => step.status === "passed").length;
  const isPassed = result.status === "passed";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
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
          {passedCount} / {result.steps.length} steps passed
        </span>
        <span className="text-sm text-zinc-500 dark:text-zinc-500">
          Duration: {formatDuration(result.durationMs)}
        </span>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {result.steps.map((step) => (
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

export function RunAgentButton() {
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    setError(null);
    startTransition(async () => {
      try {
        const runResult = await runMarko();
        setResult(runResult);
      } catch {
        setResult(null);
        setError("The agent run could not be started. Please try again.");
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
      {result ? <RunSummary result={result} /> : null}
    </div>
  );
}
