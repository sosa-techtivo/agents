export type StepStatus = "passed" | "failed";

export type StepResult = {
  id: number;
  name: string;
  status: StepStatus;
  durationMs: number;
  message?: string;
};

export type RunStatus = "passed" | "failed";

export type RunResult = {
  status: RunStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: StepResult[];
};
