import type { RunResult } from "./types";

export function countPassedTestCases(run: Pick<RunResult, "testCases">): number {
  return run.testCases.filter((testCase) => testCase.status === "passed").length;
}

export function countSteps(run: Pick<RunResult, "testCases">): { passed: number; total: number } {
  let passed = 0;
  let total = 0;
  for (const testCase of run.testCases) {
    for (const step of testCase.steps) {
      total += 1;
      if (step.status === "passed") passed += 1;
    }
  }
  return { passed, total };
}
