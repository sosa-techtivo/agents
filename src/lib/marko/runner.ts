import { chromium, type Page } from "playwright";
import type { RunResult, StepResult, TestCaseResult, TestCaseStatus } from "@/lib/agents/types";
import { safeErrorMessage } from "@/lib/agents/errors";
import { captureFailureScreenshot } from "@/lib/agents/artifacts";
import { captureLiveFrame, updateLiveRunState } from "@/lib/agents/live-state";

const NAV_TIMEOUT_MS = 20_000;
const ACTION_TIMEOUT_MS = 15_000;

type StepContext = {
  baseUrl: string;
  email: string;
  password: string;
};

type StepDefinition = {
  name: string;
  run: (page: Page, ctx: StepContext) => Promise<void>;
};

type TestCaseDefinition = {
  id: string;
  name: string;
  steps: StepDefinition[];
};

// The 9 real steps, grouped into the 4 functional Test Cases MARKO is
// organized around. Selectors and behavior are unchanged from the flat
// list this replaces — only the grouping/return shape changed.
const testCases: TestCaseDefinition[] = [
  {
    id: "TC-01",
    name: "Authentication",
    steps: [
      {
        name: "Open MARKO",
        async run(page, { baseUrl }) {
          await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
          await page
            .getByRole("banner")
            .getByRole("link", { name: "Sign in" })
            .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
        },
      },
      {
        name: "Sign in",
        async run(page, { email, password }) {
          await page.getByRole("banner").getByRole("link", { name: "Sign in" }).click();
          await page.waitForURL("**/login", { timeout: NAV_TIMEOUT_MS });
          // The login form is client-rendered; filling before hydration completes
          // can submit an empty value, so wait for the network to settle first.
          await page.waitForLoadState("networkidle");

          await page.getByRole("textbox", { name: "Email" }).fill(email);
          await page.getByRole("textbox", { name: "Password" }).fill(password);
          await page.getByRole("button", { name: "Sign in" }).click();
          await page.waitForURL("**/dashboard", { timeout: NAV_TIMEOUT_MS });
        },
      },
    ],
  },
  {
    id: "TC-02",
    name: "Sites Dashboard",
    steps: [
      {
        name: "Validate Sites dashboard",
        async run(page) {
          await page
            .getByRole("heading", { name: "Sites", level: 1 })
            .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });

          const anySite = page
            .getByRole("link")
            .filter({ has: page.getByRole("button", { name: "Site actions" }) });
          if ((await anySite.count()) < 1) {
            throw new Error("No sites are listed on the dashboard.");
          }

          await page
            .getByText("Techtivo.com", { exact: true })
            .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
        },
      },
      {
        name: "Open Techtivo.com report",
        async run(page) {
          const siteCard = page
            .getByText("Techtivo.com", { exact: true })
            .locator("xpath=ancestor::a[1]");
          await siteCard.waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });

          await Promise.all([
            page.waitForURL("**/dashboard/sites/**", { timeout: NAV_TIMEOUT_MS }),
            siteCard.click(),
          ]);

          await page
            .getByText("Loading site")
            .waitFor({ state: "detached", timeout: NAV_TIMEOUT_MS })
            .catch(() => {});
        },
      },
    ],
  },
  {
    id: "TC-03",
    name: "SEO Report",
    steps: [
      {
        name: "Validate SEO health",
        async run(page) {
          await page
            .getByRole("heading", { name: "Current SEO health", level: 2 })
            .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
          await page
            .getByText("Pages analyzed", { exact: true })
            .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
        },
      },
      {
        name: "Validate MARKO Insights",
        async run(page) {
          const heading = page.getByRole("heading", { name: "MARKO Insights", level: 2 });
          await heading.waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });

          const card = heading.locator("xpath=..");
          if ((await card.getByRole("listitem").count()) < 1) {
            throw new Error("MARKO Insights did not render any findings.");
          }
        },
      },
      {
        name: "Validate Analysis history",
        async run(page) {
          const heading = page.getByRole("heading", { name: "Analysis history", level: 2 });
          await heading.waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });

          const card = heading.locator("xpath=..");
          if ((await card.getByRole("listitem").count()) < 1) {
            throw new Error("Analysis history did not render any entries.");
          }
        },
      },
      {
        name: "Validate Search Console",
        async run(page) {
          const heading = page.getByRole("heading", { name: "Search Console", level: 2 });
          await heading.waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });

          const card = heading.locator("xpath=..");
          await card
            .getByText("Connected", { exact: true })
            .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
        },
      },
    ],
  },
  {
    id: "TC-04",
    name: "Sign Out",
    steps: [
      {
        name: "Sign out",
        async run(page) {
          await page.getByRole("button", { name: "Sign out" }).click();
          await page.waitForURL("**/login", { timeout: NAV_TIMEOUT_MS });
          await page
            .getByRole("button", { name: "Sign in" })
            .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
        },
      },
    ],
  },
];

export async function runMarkoAgent(runId: string): Promise<RunResult> {
  const baseUrl = process.env.MARKO_BASE_URL;
  const email = process.env.MARKO_QA_EMAIL;
  const password = process.env.MARKO_QA_PASSWORD;

  if (!baseUrl || !email || !password) {
    throw new Error("MARKO environment variables are not configured.");
  }

  const startedAt = new Date();
  const caseResults: TestCaseResult[] = [];
  let blocked = false;
  let stepCounter = 0;

  const browser = await chromium.launch({ headless: true, timeout: NAV_TIMEOUT_MS });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    let caseIndex = 0;
    for (const testCase of testCases) {
      caseIndex += 1;
      const caseStartedAt = Date.now();
      const stepResults: StepResult[] = [];
      let caseHadRealFailure = false;
      let stepIndexInCase = 0;

      for (const step of testCase.steps) {
        stepIndexInCase += 1;
        stepCounter += 1;
        const stepStartedAt = Date.now();

        if (blocked) {
          stepResults.push({
            id: stepCounter,
            name: step.name,
            status: "failed",
            durationMs: 0,
            message: "Skipped after an earlier step failed.",
          });
          continue;
        }

        await updateLiveRunState(runId, {
          agentId: "marko",
          currentCaseId: testCase.id,
          currentCaseName: testCase.name,
          currentStepId: stepCounter,
          currentStepName: step.name,
          currentCaseIndex: caseIndex,
          totalCases: testCases.length,
          currentStepIndex: stepIndexInCase,
          totalStepsInCase: testCase.steps.length,
        });
        await captureLiveFrame(page, runId);

        try {
          await step.run(page, { baseUrl, email, password });
          stepResults.push({
            id: stepCounter,
            name: step.name,
            status: "passed",
            durationMs: Date.now() - stepStartedAt,
          });
        } catch (error) {
          const artifactPath = await captureFailureScreenshot(page, runId, testCase.id, stepCounter);
          stepResults.push({
            id: stepCounter,
            name: step.name,
            status: "failed",
            durationMs: Date.now() - stepStartedAt,
            message: safeErrorMessage(error),
            artifactPath,
          });
          blocked = true;
          caseHadRealFailure = true;
        }
      }

      // A case is "skipped" only when none of its steps actually ran (the
      // run was already blocked before this case started). A case that
      // itself produced the failure is "failed", not "skipped".
      const status: TestCaseStatus = caseHadRealFailure
        ? "failed"
        : stepResults.every((step) => step.status === "passed")
          ? "passed"
          : "skipped";

      caseResults.push({
        id: testCase.id,
        name: testCase.name,
        status,
        durationMs: Date.now() - caseStartedAt,
        steps: stepResults,
      });
    }
  } finally {
    await browser.close();
  }

  const completedAt = new Date();

  return {
    status: caseResults.every((testCase) => testCase.status === "passed") ? "passed" : "failed",
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    testCases: caseResults,
  };
}
