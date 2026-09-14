export type StepStatus = "passed" | "failed";

export type StepResult = {
  id: number;
  name: string;
  status: StepStatus;
  durationMs: number;
  message?: string;
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
