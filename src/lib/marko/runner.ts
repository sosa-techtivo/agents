import { chromium, type Page } from "playwright";
import type { RunResult, StepResult } from "./types";

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

// Each step drives MARKO through the real UI using semantic (role/label/text)
// locators only, and validates real behavior rather than exact data values,
// since page content (counts, dates, findings) legitimately changes over time.
const steps: StepDefinition[] = [
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
      const siteCard = page.getByText("Techtivo.com", { exact: true }).locator("xpath=ancestor::a[1]");
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
];

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Playwright errors put the useful summary on the first line and an
    // optional verbose call log after it; keep only the summary.
    return error.message.split("\n")[0].slice(0, 300);
  }
  return "Step failed with an unknown error.";
}

export async function runMarkoAgent(): Promise<RunResult> {
  const baseUrl = process.env.MARKO_BASE_URL;
  const email = process.env.MARKO_QA_EMAIL;
  const password = process.env.MARKO_QA_PASSWORD;

  if (!baseUrl || !email || !password) {
    throw new Error("MARKO environment variables are not configured.");
  }

  const startedAt = new Date();
  const results: StepResult[] = [];
  let blocked = false;

  const browser = await chromium.launch({ headless: true, timeout: NAV_TIMEOUT_MS });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepStartedAt = Date.now();

      if (blocked) {
        results.push({
          id: i + 1,
          name: step.name,
          status: "failed",
          durationMs: 0,
          message: "Skipped after an earlier step failed.",
        });
        continue;
      }

      try {
        await step.run(page, { baseUrl, email, password });
        results.push({
          id: i + 1,
          name: step.name,
          status: "passed",
          durationMs: Date.now() - stepStartedAt,
        });
      } catch (error) {
        results.push({
          id: i + 1,
          name: step.name,
          status: "failed",
          durationMs: Date.now() - stepStartedAt,
          message: safeErrorMessage(error),
        });
        blocked = true;
      }
    }
  } finally {
    await browser.close();
  }

  const completedAt = new Date();

  return {
    status: results.every((step) => step.status === "passed") ? "passed" : "failed",
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    steps: results,
  };
}
