"use client";

import { useState } from "react";

export type TestCasePlanItem = {
  id: string;
  name: string;
  steps: string[];
};

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-150 dark:text-zinc-600 ${open ? "rotate-180" : ""}`}
    >
      <path d="M5 7.5L10 12.5L15 7.5" />
    </svg>
  );
}

// All closed by default; opening one closes any other (single-open accordion).
export function TestCasePlan({ testCases }: { testCases: TestCasePlanItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
      {testCases.map((testCase) => {
        const isOpen = openId === testCase.id;
        const panelId = `test-case-steps-${testCase.id}`;

        return (
          <div key={testCase.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : testCase.id)}
              className="flex w-full items-center gap-2 py-3 text-left"
            >
              <span className="text-xs text-zinc-400 dark:text-zinc-600">{testCase.id}</span>
              <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {testCase.name}
              </span>
              <ChevronIcon open={isOpen} />
            </button>
            {isOpen ? (
              <ol
                id={panelId}
                className="list-decimal space-y-1 pb-4 pl-9 text-sm text-zinc-700 dark:text-zinc-300"
              >
                {testCase.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
