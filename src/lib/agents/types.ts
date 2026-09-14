export type StepStatus = "passed" | "failed";

export type StepResult = {
  id: number;
  name: string;
  status: StepStatus;
  durationMs: number;
  message?: string;
  /** Relative path (under .data/artifacts) to a failure screenshot, if one was captured. */
  artifactPath?: string;
};

export type TestCaseStatus = "passed" | "failed" | "skipped";

export type TestCaseResult = {
  id: string;
  name: string;
  status: TestCaseStatus;
  durationMs: number;
  steps: StepResult[];
};

export type RunStatus = "passed" | "failed";

export type RunResult = {
  status: RunStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  testCases: TestCaseResult[];
};

/** What a "Run Agent" server action returns to the client for any agent. */
export type RunOutcome = {
  result: RunResult;
  persisted: boolean;
  runId?: string;
};

/**
 * Shape polled from GET /agents/runs/<runId>/live while a manual run is in
 * progress. Pure data — safe to import from client components, unlike
 * src/lib/agents/live-state.ts which also has the server-only read/write
 * functions.
 */
export type LiveRunState = {
  runId: string;
  agentId: string;
  status: "running";
  currentCaseId: string;
  currentCaseName: string;
  currentStepId: number;
  currentStepName: string;
  currentCaseIndex: number;
  totalCases: number;
  currentStepIndex: number;
  totalStepsInCase: number;
  updatedAt: string;
  frameAvailable: boolean;
};
