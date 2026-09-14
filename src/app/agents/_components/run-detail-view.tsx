"use client";

import { useState } from "react";
import type { PersistedRun } from "@/lib/db/runs";
import { countPassedTestCases, countSteps } from "@/lib/agents/summary";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { StepResult, TestCaseResult, TestCaseStatus } from "@/lib/agents/types";
import { ChevronIcon } from "./test-case-plan";

// A step after a blocking failure is recorded as "failed" with this exact
// message by the runner. The owning Test Case's status already says whether
// the case ran at all; this only refines how an individual step within it
// is labeled.
const SKIPPED_MESSAGE = "Skipped after an earlier step failed.";

type StepDisplayStatus = "passed" | "failed" | "skipped";

function stepDisplayStatus(step: StepResult, caseStatus: TestCaseStatus): StepDisplayStatus {
  if (step.status === "passed") return "passed";
  // A step whose Test Case never ran at all (e.g. it depended on another
  // Test Case that failed) is "skipped" regardless of its own message text.
  if (caseStatus === "skipped") return "skipped";
  return step.message === SKIPPED_MESSAGE ? "skipped" : "failed";
}

function OverallBadge({ status }: { status: "passed" | "failed" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        status === "passed"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
      }`}
    >
      {status === "passed" ? "PASSED" : "FAILED"}
    </span>
  );
}

function CaseBadge({ status }: { status: TestCaseStatus }) {
  const classes: Record<TestCaseStatus, string> = {
    passed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    failed: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
    skipped: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${classes[status]}`}
    >
      {status.toUpperCase()}
    </span>
  );
}

function StepStatusLabel({ status }: { status: StepDisplayStatus }) {
  const styles: Record<StepDisplayStatus, string> = {
    passed: "text-emerald-600 dark:text-emerald-400",
    failed: "text-red-600 dark:text-red-400",
    skipped: "text-zinc-400 dark:text-zinc-600",
  };
  const symbols: Record<StepDisplayStatus, string> = {
    passed: "✓",
    failed: "✗",
    skipped: "–",
  };
  const labels: Record<StepDisplayStatus, string> = {
    passed: "Passed",
    failed: "Failed",
    skipped: "Skipped",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${styles[status]}`}>
      <span aria-hidden="true">{symbols[status]}</span>
      {labels[status]}
    </span>
  );
}

function FailureScreenshot({ artifactPath }: { artifactPath: string }) {
  const src = `/agents/artifacts/${artifactPath}`;
  return (
    <div className="pl-7">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Failure screenshot</p>
      <a href={src} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, dynamically-served local file, not a static asset Next can optimize */}
        <img
          src={src}
          alt="Failure screenshot"
          className="h-24 w-auto rounded border border-zinc-200 object-cover object-top transition-opacity hover:opacity-80 dark:border-zinc-700"
        />
      </a>
    </div>
  );
}

function TestCaseAccordionItem({
  testCase,
  isOpen,
  onToggle,
}: {
  testCase: TestCaseResult;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const panelId = `run-detail-steps-${testCase.id}`;

  return (
    <div>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-3 py-3 text-left"
      >
        <span className="text-xs text-zinc-400 dark:text-zinc-600">{testCase.id}</span>
        <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">{testCase.name}</span>
        <CaseBadge status={testCase.status} />
        <span className="text-xs text-zinc-400 dark:text-zinc-600">{formatDuration(testCase.durationMs)}</span>
        <ChevronIcon open={isOpen} />
      </button>
      {isOpen ? (
        <ol id={panelId} className="flex flex-col divide-y divide-zinc-100 pb-4 dark:divide-zinc-800">
          {testCase.steps.map((step) => {
            const displayStatus = stepDisplayStatus(step, testCase.status);
            return (
              <li key={step.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 dark:text-zinc-600">{step.id}</span>
                  <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{step.name}</span>
                  <StepStatusLabel status={displayStatus} />
                  <span className="text-xs text-zinc-400 dark:text-zinc-600">
                    {formatDuration(step.durationMs)}
                  </span>
                </div>
                {step.message ? (
                  <p className="pl-7 text-xs text-red-600 dark:text-red-400">{step.message}</p>
                ) : null}
                {displayStatus === "failed" && step.artifactPath ? (
                  <FailureScreenshot artifactPath={step.artifactPath} />
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

export function RunDetailView({ agentName, run }: { agentName: string; run: PersistedRun }) {
  const passedCases = countPassedTestCases(run);
  const steps = countSteps(run);

  // FAILED runs open directly on the first Test Case that actually failed,
  // so the user lands on the problem area immediately. PASSED runs (and the
  // rare case where no case is marked "failed") start fully collapsed.
  const firstFailedCase = run.status === "failed" ? run.testCases.find((tc) => tc.status === "failed") : undefined;
  const [openId, setOpenId] = useState<string | null>(firstFailedCase?.id ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{agentName}</h1>
          <OverallBadge status={run.status} />
        </div>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">Run {run.id}</p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">{formatDateTime(run.startedAt)}</span>
          <span className="text-zinc-500 dark:text-zinc-400">{formatDuration(run.durationMs)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-400">
          <span>
            {passedCases} / {run.testCases.length} test cases
          </span>
          <span>
            {steps.passed} / {steps.total} steps
          </span>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">Test Cases</h2>
        <div className="mt-2 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
          {run.testCases.map((testCase) => (
            <TestCaseAccordionItem
              key={testCase.id}
              testCase={testCase}
              isOpen={openId === testCase.id}
              onToggle={() => setOpenId((current) => (current === testCase.id ? null : testCase.id))}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
