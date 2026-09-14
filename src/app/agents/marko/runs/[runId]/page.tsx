import { notFound } from "next/navigation";
import { getRun } from "@/lib/db/runs";
import { countPassedTestCases, countSteps } from "@/lib/marko/summary";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { StepResult, TestCaseResult, TestCaseStatus } from "@/lib/marko/types";

const AGENT_ID = "marko";

// A step after a blocking failure is recorded as "failed" with this exact
// message by the runner (src/lib/marko/runner.ts). The owning Test Case's
// status already says whether the case ran at all; this only refines how an
// individual step within it is labeled.
const SKIPPED_MESSAGE = "Skipped after an earlier step failed.";

type StepDisplayStatus = "passed" | "failed" | "skipped";

function stepDisplayStatus(step: StepResult): StepDisplayStatus {
  if (step.status === "passed") return "passed";
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

function TestCaseSection({ testCase }: { testCase: TestCaseResult }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-zinc-400 dark:text-zinc-600">{testCase.id}</span>
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">{testCase.name}</h2>
        <CaseBadge status={testCase.status} />
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-600">
          {formatDuration(testCase.durationMs)}
        </span>
      </div>
      <ol className="mt-4 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
        {testCase.steps.map((step) => (
          <li key={step.id} className="flex flex-col gap-1 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 dark:text-zinc-600">{step.id}</span>
              <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{step.name}</span>
              <StepStatusLabel status={stepDisplayStatus(step)} />
              <span className="text-xs text-zinc-400 dark:text-zinc-600">
                {formatDuration(step.durationMs)}
              </span>
            </div>
            {step.message ? (
              <p className="pl-7 text-xs text-red-600 dark:text-red-400">{step.message}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function MarkoRunDetailPage({
  params,
}: PageProps<"/agents/marko/runs/[runId]">) {
  const { runId } = await params;
  const run = getRun(runId);

  if (!run || run.agentId !== AGENT_ID) {
    notFound();
  }

  const passedCases = countPassedTestCases(run);
  const steps = countSteps(run);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">MARKO QA Agent</h1>
          <OverallBadge status={run.status} />
        </div>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">Run {run.id}</p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
          <dt className="text-zinc-500 dark:text-zinc-400">Started at</dt>
          <dd className="text-zinc-700 dark:text-zinc-300 sm:col-span-3">
            {formatDateTime(run.startedAt)}
          </dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Completed at</dt>
          <dd className="text-zinc-700 dark:text-zinc-300 sm:col-span-3">
            {formatDateTime(run.completedAt)}
          </dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Duration</dt>
          <dd className="text-zinc-700 dark:text-zinc-300 sm:col-span-3">
            {formatDuration(run.durationMs)}
          </dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Test Cases</dt>
          <dd className="text-zinc-700 dark:text-zinc-300 sm:col-span-3">
            {passedCases} / {run.testCases.length} passed
          </dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Steps</dt>
          <dd className="text-zinc-700 dark:text-zinc-300 sm:col-span-3">
            {steps.passed} / {steps.total} passed
          </dd>
        </dl>
      </section>

      {run.testCases.map((testCase) => (
        <TestCaseSection key={testCase.id} testCase={testCase} />
      ))}
    </div>
  );
}
