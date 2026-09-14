import { chromium, type Browser, type Page } from "playwright";
import type { RunResult, StepResult, TestCaseResult, TestCaseStatus } from "@/lib/agents/types";
import { safeErrorMessage } from "@/lib/agents/errors";
import { captureFailureScreenshot } from "@/lib/agents/artifacts";
import { captureLiveFrame, updateLiveRunState } from "@/lib/agents/live-state";

const NAV_TIMEOUT_MS = 20_000;
const ACTION_TIMEOUT_MS = 15_000;

const QA_PROJECT_SLUG = "jirita-live";
const TOTAL_TEST_CASES = 8;

// Matches the exact message src/lib/marko/runner.ts also uses, so the shared
// Run Detail view recognizes within-case skipped steps for both agents.
const SKIPPED_STEP_MESSAGE = "Skipped after an earlier step failed.";

type JiritaEnv = {
  baseUrl: string;
  adminEmail: string;
  adminPassword: string;
  plEmail: string;
  plPassword: string;
  memberEmail: string;
  memberPassword: string;
};

function loadEnv(): JiritaEnv {
  const baseUrl = process.env.JIRITA_BASE_URL;
  const adminEmail = process.env.JIRITA_ADMIN_EMAIL;
  const adminPassword = process.env.JIRITA_ADMIN_PASSWORD;
  const plEmail = process.env.JIRITA_PL_EMAIL;
  const plPassword = process.env.JIRITA_PL_PASSWORD;
  const memberEmail = process.env.JIRITA_MEMBER_EMAIL;
  const memberPassword = process.env.JIRITA_MEMBER_PASSWORD;

  if (
    !baseUrl ||
    !adminEmail ||
    !adminPassword ||
    !plEmail ||
    !plPassword ||
    !memberEmail ||
    !memberPassword
  ) {
    throw new Error("JIRITA environment variables are not configured.");
  }

  return { baseUrl, adminEmail, adminPassword, plEmail, plPassword, memberEmail, memberPassword };
}

/** Ticket identity + before/after field values, shared in memory between TC-03/TC-04/TC-06 for this run only. */
type TicketContext = {
  title?: string;
  key?: string;
  url?: string;
  originalStatus?: string;
  newStatus?: string;
  originalPriority?: string;
  newPriority?: string;
};

type StepDef = {
  name: string;
  run: (page: Page) => Promise<void>;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Hard guard: every write action must be confined to the authorized QA project. */
function assertAuthorizedProject(page: Page, action: string): void {
  if (process.env.JIRITA_QA_PROJECT_SLUG !== QA_PROJECT_SLUG) {
    throw new Error(`Refusing to ${action}: JIRITA_QA_PROJECT_SLUG is not "${QA_PROJECT_SLUG}".`);
  }
  if (!page.url().includes(`/projects/${QA_PROJECT_SLUG}`)) {
    throw new Error(`Refusing to ${action}: the current page is not within the ${QA_PROJECT_SLUG} project.`);
  }
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/dashboard", { timeout: NAV_TIMEOUT_MS });
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.waitForURL("**/login", { timeout: NAV_TIMEOUT_MS });
}

async function openJiritaLiveProject(page: Page): Promise<void> {
  const link = page.getByRole("link", { name: "JIRITA Live", exact: true });
  await link.waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
  await Promise.all([
    page.waitForURL(`**/projects/${QA_PROJECT_SLUG}`, { timeout: NAV_TIMEOUT_MS }),
    link.click(),
  ]);
  // Confirms we really landed on JIRITA Live, not a similarly-named project.
  await page
    .getByRole("heading", { name: "JIRITA Live", level: 1 })
    .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
}

function ticketCardLocator(page: Page, title: string) {
  // Each ticket is rendered as a <button> whose accessible name embeds the
  // key, title, and assignee. The title (unique per run) is enough to find
  // the right card without depending on the assignee text or exact wording.
  return page.getByRole("button", { name: new RegExp(escapeRegExp(title)) });
}

async function extractTicketKey(card: ReturnType<typeof ticketCardLocator>): Promise<string | undefined> {
  const text = await card.textContent();
  return text?.match(/\b[A-Z]{2,}-\d+\b/)?.[0];
}

/** Opens the Status/Priority inline editor, reads the current value, and closes it without changing anything. */
async function readAndCloseSelectField(page: Page, editButtonName: string): Promise<string> {
  await page.getByRole("button", { name: editButtonName }).click();
  const combobox = page.getByRole("combobox").first();
  await combobox.waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
  const current = await combobox.evaluate(
    (el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? "",
  );
  await page.keyboard.press("Escape");
  return current;
}

/** Opens the Status/Priority inline editor and selects a deterministic, valid alternative to the current value. */
async function changeSelectFieldToAlternative(
  page: Page,
  editButtonName: string,
  currentValue: string,
): Promise<string> {
  await page.getByRole("button", { name: editButtonName }).click();
  const combobox = page.getByRole("combobox").first();
  await combobox.waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
  const optionLabels = (await combobox.locator("option").allTextContents()).map((label) => label.trim());
  const nextValue = optionLabels.find((label) => label && label !== currentValue);
  if (!nextValue) {
    throw new Error(`No alternative value is available for ${editButtonName}.`);
  }

  // The field display updates optimistically the instant selectOption()
  // fires, before the save round-trips to the server — confirmed live that
  // this optimistic render is NOT a reliable "saved" signal. Starting a
  // second field edit on the same ticket before this PATCH actually
  // completes causes the change to silently not persist (verified: waiting
  // only for the visible UI update still lost the write; waiting for the
  // real network response does not). Wait for the actual save to finish.
  const saved = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().includes("/rest/v1/tickets"),
    { timeout: ACTION_TIMEOUT_MS },
  );
  await combobox.selectOption({ label: nextValue });
  await saved;

  return nextValue;
}

function findLineAfterLabel(panelText: string, label: string): string | null {
  const lines = panelText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const idx = lines.findIndex((line) => line.toUpperCase() === label.toUpperCase());
  if (idx === -1 || idx + 1 >= lines.length) return null;
  return lines[idx + 1];
}

function ticketFieldPanel(page: Page) {
  // The ticket detail page has two `complementary` landmarks: the app's
  // global left navigation, and this page's own right-hand field panel,
  // which always renders after it.
  return page.getByRole("complementary").last();
}

/**
 * Matches "· Xh total" / "· Xm total", the entries/total summary shown by
 * My Work's "My Hours" view. The "·" prefix is what makes this unambiguous:
 * without it, "total" alone also matches the unrelated "7 total" tickets
 * stat that's on the page from the start. Kept as a string (not a RegExp)
 * so it can also be passed into page.waitForFunction() below.
 */
const HOURS_VIEW_TOTAL_PATTERN = "·\\s*([\\d.]+)\\s*(h|m)\\s*total";

function parseHoursViewTotalMinutes(mainText: string): number | null {
  const match = mainText.match(new RegExp(HOURS_VIEW_TOTAL_PATTERN, "i"));
  if (!match) return null;
  const value = parseFloat(match[1]);
  return match[2].toLowerCase() === "h" ? Math.round(value * 60) : Math.round(value);
}

async function logOneMinuteEntry(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Log Time" }).click();
  const dialog = page.getByRole("dialog", { name: "Log Time" });
  await dialog.waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });

  // The dialog has two identically-named spinbuttons for one compound
  // "hours + minutes" duration field; position is the only way to tell them
  // apart (hours first, minutes second).
  await dialog.getByRole("spinbutton").nth(1).fill("1");

  await dialog.getByRole("button", { name: "Log Time" }).click();
  await dialog.waitFor({ state: "detached", timeout: ACTION_TIMEOUT_MS });
}

// ---------------------------------------------------------------------------
// Test Case step definitions
// ---------------------------------------------------------------------------

function buildTc01Steps(env: JiritaEnv): StepDef[] {
  return [
    {
      name: "Open JIRITA",
      async run(page) {
        await page.goto(env.baseUrl, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
        await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: "Sign in as Admin",
      async run(page) {
        await signIn(page, env.adminEmail, env.adminPassword);
      },
    },
    {
      name: "Validate Dashboard",
      async run(page) {
        if (!page.url().endsWith("/dashboard")) {
          throw new Error("Did not land on the Dashboard after signing in as Admin.");
        }
        await page
          .getByRole("button", { name: "Account menu" })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: "Validate main navigation",
      async run(page) {
        const nav = page.getByRole("navigation");
        for (const name of ["Dashboard", "Projects", "My Work", "Reports", "Time Tracking"]) {
          await nav.getByRole("link", { name, exact: true }).waitFor({
            state: "visible",
            timeout: ACTION_TIMEOUT_MS,
          });
        }
      },
    },
    {
      name: "Validate Projects access",
      async run(page) {
        const nav = page.getByRole("navigation");
        await Promise.all([
          page.waitForURL("**/projects", { timeout: NAV_TIMEOUT_MS }),
          nav.getByRole("link", { name: "Projects", exact: true }).click(),
        ]);
        await page
          .getByRole("heading", { name: "Projects", level: 1 })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: "Sign out",
      async run(page) {
        await signOut(page);
      },
    },
  ];
}

function buildTc02Steps(env: JiritaEnv): StepDef[] {
  return [
    {
      name: "Sign in as Project Lead",
      async run(page) {
        await page.goto(env.baseUrl, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
        await signIn(page, env.plEmail, env.plPassword);
      },
    },
    {
      name: "Open JIRITA Live",
      async run(page) {
        await openJiritaLiveProject(page);
      },
    },
    {
      name: "Validate Project Overview",
      async run(page) {
        await page
          .getByRole("button", { name: "New Ticket" })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: "Validate project work sections",
      async run(page) {
        await page
          .getByRole("heading", { name: "Team", level: 2 })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
        await page
          .getByRole("heading", { name: "Project Health", level: 2 })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: "Validate project navigation",
      async run(page) {
        await page
          .getByRole("link", { name: "Tickets", exact: true })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
        await page
          .getByRole("link", { name: "Team", exact: true })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: "Sign out",
      async run(page) {
        await signOut(page);
      },
    },
  ];
}

// TC-03 has no "Sign out" step by design: TC-04 continues in the same
// Project Lead session/context to work with the ticket TC-03 just created.
function buildTc03Steps(env: JiritaEnv, ticketCtx: TicketContext): StepDef[] {
  return [
    {
      name: "Sign in as Project Lead",
      async run(page) {
        await page.goto(env.baseUrl, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
        await signIn(page, env.plEmail, env.plPassword);
      },
    },
    {
      name: "Open JIRITA Live",
      async run(page) {
        await openJiritaLiveProject(page);
      },
    },
    {
      name: "Start new ticket",
      async run(page) {
        await page.getByRole("button", { name: "New Ticket" }).click();
        await page
          .getByRole("dialog", { name: "New Ticket" })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: "Create automated QA ticket",
      async run(page) {
        assertAuthorizedProject(page, "create a ticket");

        const title = `QA-AUTO-${Date.now()}`;
        const dialog = page.getByRole("dialog", { name: "New Ticket" });

        // Assignee, Status, Priority and Sprint are left at their defaults
        // (Unassigned / Backlog / Medium / Backlog) — no unnecessary writes.
        await dialog.getByRole("textbox", { name: "What needs to be done?" }).fill(title);

        const description = dialog.locator('[contenteditable="true"]');
        if (await description.count()) {
          await description.first().click();
          await description.first().type("Created automatically by Techtivo AGENTS QA.");
        }

        await dialog.getByRole("button", { name: "Create Ticket" }).click();
        await dialog.waitFor({ state: "detached", timeout: ACTION_TIMEOUT_MS });

        ticketCtx.title = title;
      },
    },
    {
      name: "Verify ticket appears",
      async run(page) {
        if (!ticketCtx.title) {
          throw new Error("No QA ticket title was captured to verify.");
        }

        await Promise.all([
          page.waitForURL(`**/projects/${QA_PROJECT_SLUG}/tickets`, { timeout: NAV_TIMEOUT_MS }),
          page.getByRole("link", { name: "Tickets", exact: true }).click(),
        ]);

        const found = await ticketCardLocator(page, ticketCtx.title)
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS })
          .then(() => true)
          .catch(() => false);
        if (!found) {
          throw new Error("Created QA ticket did not appear after submission.");
        }
      },
    },
    {
      name: "Capture created ticket identity",
      async run(page) {
        if (!ticketCtx.title) {
          throw new Error("No QA ticket title was captured to open.");
        }
        const card = ticketCardLocator(page, ticketCtx.title);
        ticketCtx.key = await extractTicketKey(card);

        await Promise.all([page.waitForURL("**/tickets/**", { timeout: NAV_TIMEOUT_MS }), card.click({ force: true })]);
        ticketCtx.url = page.url();
      },
    },
  ];
}

const TC04_STEP_NAMES = [
  "Open created QA ticket",
  "Capture current status and priority",
  "Change ticket status",
  "Change ticket priority",
  "Reload or navigate away/back",
  "Verify changes persisted",
  "Sign out",
];

function buildTc04Steps(ticketCtx: TicketContext): StepDef[] {
  return [
    {
      name: TC04_STEP_NAMES[0],
      async run(page) {
        if (!ticketCtx.url || !ticketCtx.title) {
          throw new Error("No QA ticket identity was captured from Ticket Creation.");
        }
        // Locate by the captured URL rather than assuming we're still on it.
        await page.goto(ticketCtx.url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
        await page
          .getByRole("heading", { name: ticketCtx.title, level: 1 })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: TC04_STEP_NAMES[1],
      async run(page) {
        ticketCtx.originalStatus = await readAndCloseSelectField(page, "Edit status");
        ticketCtx.originalPriority = await readAndCloseSelectField(page, "Edit priority");
      },
    },
    {
      name: TC04_STEP_NAMES[2],
      async run(page) {
        assertAuthorizedProject(page, "change a ticket's status");
        if (!ticketCtx.originalStatus) {
          throw new Error("The ticket's current status was not captured.");
        }
        ticketCtx.newStatus = await changeSelectFieldToAlternative(page, "Edit status", ticketCtx.originalStatus);
      },
    },
    {
      name: TC04_STEP_NAMES[3],
      async run(page) {
        assertAuthorizedProject(page, "change a ticket's priority");
        if (!ticketCtx.originalPriority) {
          throw new Error("The ticket's current priority was not captured.");
        }
        ticketCtx.newPriority = await changeSelectFieldToAlternative(
          page,
          "Edit priority",
          ticketCtx.originalPriority,
        );
      },
    },
    {
      name: TC04_STEP_NAMES[4],
      async run(page) {
        await page.reload({ waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
      },
    },
    {
      name: TC04_STEP_NAMES[5],
      async run(page) {
        const panelText = await ticketFieldPanel(page).innerText();
        const status = findLineAfterLabel(panelText, "Status");
        const priority = findLineAfterLabel(panelText, "Priority");

        if (status !== ticketCtx.newStatus) {
          throw new Error("Expected status change was not reflected after reload.");
        }
        if (priority !== ticketCtx.newPriority) {
          throw new Error("Expected priority change was not reflected after reload.");
        }
      },
    },
    {
      name: TC04_STEP_NAMES[6],
      async run(page) {
        await signOut(page);
      },
    },
  ];
}

function buildTc05Steps(env: JiritaEnv): StepDef[] {
  return [
    {
      name: "Sign in as Member",
      async run(page) {
        await page.goto(env.baseUrl, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
        await signIn(page, env.memberEmail, env.memberPassword);
      },
    },
    {
      name: "Validate Member Dashboard",
      async run(page) {
        if (!page.url().endsWith("/dashboard")) {
          throw new Error("Did not land on the Dashboard after signing in as Member.");
        }
        await page
          .getByRole("button", { name: "Account menu" })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      // Best-effort: the Member-specific "All Projects" selector could not be
      // directly verified (see report — Member credentials are currently
      // invalid). This checks the sidebar's project list toggle is present.
      name: "Validate All Projects selector",
      async run(page) {
        await page
          .getByRole("button", { name: "Projects", exact: true })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: "Validate All Projects default state",
      async run(page) {
        await page
          .getByRole("link", { name: "JIRITA Live", exact: true })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: "Validate dashboard content",
      async run(page) {
        await page.getByRole("navigation").waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: "Sign out",
      async run(page) {
        await signOut(page);
      },
    },
  ];
}

const TC06_STEP_NAMES = [
  "Sign in as Member",
  "Open JIRITA Live",
  "Open created QA ticket",
  "Register first small time entry",
  "Register second small time entry",
  "Open My Work",
  "Open Hours",
  "Verify accumulated time",
  "Sign out",
];

function buildTc06Steps(env: JiritaEnv, ticketCtx: TicketContext): StepDef[] {
  return [
    {
      name: TC06_STEP_NAMES[0],
      async run(page) {
        await page.goto(env.baseUrl, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
        await signIn(page, env.memberEmail, env.memberPassword);
      },
    },
    {
      name: TC06_STEP_NAMES[1],
      async run(page) {
        await openJiritaLiveProject(page);
      },
    },
    {
      name: TC06_STEP_NAMES[2],
      async run(page) {
        if (!ticketCtx.url || !ticketCtx.title) {
          throw new Error("No QA ticket identity was captured from Ticket Creation.");
        }
        await page.goto(ticketCtx.url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });

        const headingVisible = await page
          .getByRole("heading", { name: ticketCtx.title, level: 1 })
          .isVisible()
          .catch(() => false);
        const logTimeVisible = await page
          .getByRole("button", { name: "Log Time" })
          .isVisible()
          .catch(() => false);

        if (!headingVisible || !logTimeVisible) {
          throw new Error("Member cannot access the QA ticket required for time tracking.");
        }
      },
    },
    {
      name: TC06_STEP_NAMES[3],
      async run(page) {
        assertAuthorizedProject(page, "log time");
        await logOneMinuteEntry(page);
      },
    },
    {
      name: TC06_STEP_NAMES[4],
      async run(page) {
        assertAuthorizedProject(page, "log time");
        await logOneMinuteEntry(page);
      },
    },
    {
      name: TC06_STEP_NAMES[5],
      async run(page) {
        await Promise.all([
          page.waitForURL("**/my-work", { timeout: NAV_TIMEOUT_MS }),
          page.getByRole("navigation").getByRole("link", { name: "My Work", exact: true }).click(),
        ]);
      },
    },
    {
      // "My Hours" is a view toggle (alongside List/Board) within My Work's
      // ticket list — it replaces the list with the actual logged time
      // entries for a date range (defaulting to the current month, which
      // includes today), as opposed to the "My Hours" stat block above it
      // (estimated hours by ticket status, not logged time).
      name: TC06_STEP_NAMES[6],
      async run(page) {
        await page.getByRole("button", { name: "My Hours", exact: true }).click();
        await page
          .getByRole("heading", { name: "My Hours", level: 2 })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
        // The heading — and an optimistic "0 · 0h total" placeholder —
        // render immediately, before the entries fetch resolves. That
        // placeholder is indistinguishable in shape from a real total, so
        // it can't be used as the "data has loaded" signal. The entries
        // table (or its empty-state message) only renders once the fetch
        // actually completes, so wait for one of those instead.
        await page.waitForFunction(
          () => {
            const mainText = document.querySelector("main")?.innerText ?? "";
            return /DATE\s*PROJECT\s*TICKET/i.test(mainText) || /No time entries in this range\./i.test(mainText);
          },
          undefined,
          { timeout: ACTION_TIMEOUT_MS },
        );
      },
    },
    {
      // The critical regression check: two small entries must accumulate in
      // the real My Work → Hours aggregate, not be individually rounded
      // away to zero.
      name: TC06_STEP_NAMES[7],
      async run(page) {
        const mainText = await page.locator("main").innerText();
        const minutes = parseHoursViewTotalMinutes(mainText);
        if (minutes === null || minutes <= 0) {
          throw new Error("Expected accumulated time was not reflected in My Work → Hours.");
        }
      },
    },
    {
      name: TC06_STEP_NAMES[8],
      async run(page) {
        await signOut(page);
      },
    },
  ];
}

function buildTc07Steps(env: JiritaEnv): StepDef[] {
  return [
    {
      name: "Sign in as Admin",
      async run(page) {
        await page.goto(env.baseUrl, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
        await signIn(page, env.adminEmail, env.adminPassword);
      },
    },
    {
      name: "Open Reports",
      async run(page) {
        await Promise.all([
          page.waitForURL("**/reports", { timeout: NAV_TIMEOUT_MS }),
          page.getByRole("navigation").getByRole("link", { name: "Reports", exact: true }).click(),
        ]);
      },
    },
    {
      name: "Validate Reports loads",
      async run(page) {
        await page
          .getByRole("heading", { name: "Reports", exact: true })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: "Validate report content renders",
      async run(page) {
        await page
          .getByRole("heading", { name: /hours by person/i })
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      },
    },
    {
      name: "Sign out",
      async run(page) {
        await signOut(page);
      },
    },
  ];
}

function buildTc08Steps(env: JiritaEnv): StepDef[] {
  return [
    {
      name: "Ensure signed out",
      async run(page) {
        await page.goto(env.baseUrl, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
        if (!page.url().includes("/login")) {
          throw new Error("Expected an unauthenticated session to land on the login page.");
        }
      },
    },
    {
      name: "Open a protected JIRITA route",
      async run(page) {
        await page.goto(`${env.baseUrl}/dashboard`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
      },
    },
    {
      name: "Validate redirect to login",
      async run(page) {
        if (!page.url().includes("/login")) {
          throw new Error("Accessing a protected route while signed out did not redirect to login.");
        }
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function runSteps(
  page: Page,
  steps: StepDef[],
  nextId: () => number,
  runId: string,
  caseId: string,
  caseName: string,
  caseIndex: number,
): Promise<{ steps: StepResult[]; hadRealFailure: boolean }> {
  const results: StepResult[] = [];
  let blocked = false;
  let hadRealFailure = false;
  const totalStepsInCase = steps.length;
  let stepIndexInCase = 0;

  for (const step of steps) {
    stepIndexInCase += 1;
    const id = nextId();
    const stepStartedAt = Date.now();

    if (blocked) {
      results.push({ id, name: step.name, status: "failed", durationMs: 0, message: SKIPPED_STEP_MESSAGE });
      continue;
    }

    await updateLiveRunState(runId, {
      agentId: "jirita",
      currentCaseId: caseId,
      currentCaseName: caseName,
      currentStepId: id,
      currentStepName: step.name,
      currentCaseIndex: caseIndex,
      totalCases: TOTAL_TEST_CASES,
      currentStepIndex: stepIndexInCase,
      totalStepsInCase,
    });
    await captureLiveFrame(page, runId);

    try {
      await step.run(page);
      results.push({ id, name: step.name, status: "passed", durationMs: Date.now() - stepStartedAt });
    } catch (error) {
      const artifactPath = await captureFailureScreenshot(page, runId, caseId, id);
      results.push({
        id,
        name: step.name,
        status: "failed",
        durationMs: Date.now() - stepStartedAt,
        message: safeErrorMessage(error),
        artifactPath,
      });
      blocked = true;
      hadRealFailure = true;
    }
  }

  return { steps: results, hadRealFailure };
}

function caseStatusFrom(hadRealFailure: boolean, steps: StepResult[]): TestCaseStatus {
  if (hadRealFailure) return "failed";
  return steps.every((step) => step.status === "passed") ? "passed" : "skipped";
}

async function runInFreshContext(
  browser: Browser,
  id: string,
  name: string,
  steps: StepDef[],
  nextId: () => number,
  runId: string,
  caseIndex: number,
): Promise<TestCaseResult> {
  const caseStartedAt = Date.now();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    const { steps: stepResults, hadRealFailure } = await runSteps(
      page,
      steps,
      nextId,
      runId,
      id,
      name,
      caseIndex,
    );
    return {
      id,
      name,
      status: caseStatusFrom(hadRealFailure, stepResults),
      durationMs: Date.now() - caseStartedAt,
      steps: stepResults,
    };
  } finally {
    await context.close();
  }
}

function fullySkippedCase(
  id: string,
  name: string,
  stepNames: string[],
  nextId: () => number,
  reason: string,
): TestCaseResult {
  const steps: StepResult[] = stepNames.map((stepName) => ({
    id: nextId(),
    name: stepName,
    status: "failed",
    durationMs: 0,
    message: reason,
  }));
  return { id, name, status: "skipped", durationMs: 0, steps };
}

/** Runs TC-03 in its own context, keeping it open (for TC-04) only if a ticket was created. */
async function runTc03(
  browser: Browser,
  env: JiritaEnv,
  ticketCtx: TicketContext,
  nextId: () => number,
  runId: string,
): Promise<{ result: TestCaseResult; page: Page | null; close: () => Promise<void> }> {
  const caseStartedAt = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

  const { steps: stepResults, hadRealFailure } = await runSteps(
    page,
    buildTc03Steps(env, ticketCtx),
    nextId,
    runId,
    "TC-03",
    "Ticket Creation",
    3,
  );
  const status = caseStatusFrom(hadRealFailure, stepResults);

  const result: TestCaseResult = {
    id: "TC-03",
    name: "Ticket Creation",
    status,
    durationMs: Date.now() - caseStartedAt,
    steps: stepResults,
  };

  return {
    result,
    page: status === "passed" && ticketCtx.url ? page : null,
    close: () => context.close(),
  };
}

async function runTc04InPage(
  page: Page,
  ticketCtx: TicketContext,
  nextId: () => number,
  runId: string,
): Promise<TestCaseResult> {
  const caseStartedAt = Date.now();
  const { steps: stepResults, hadRealFailure } = await runSteps(
    page,
    buildTc04Steps(ticketCtx),
    nextId,
    runId,
    "TC-04",
    "Ticket Workflow",
    4,
  );
  return {
    id: "TC-04",
    name: "Ticket Workflow",
    status: caseStatusFrom(hadRealFailure, stepResults),
    durationMs: Date.now() - caseStartedAt,
    steps: stepResults,
  };
}

const NO_TICKET_SKIP_REASON =
  "Skipped because Ticket Creation (TC-03) did not produce a usable QA ticket.";

export async function runJiritaAgent(runId: string): Promise<RunResult> {
  const env = loadEnv();
  const startedAt = new Date();
  const caseResults: TestCaseResult[] = [];
  let counter = 0;
  const nextId = () => ++counter;
  const ticketCtx: TicketContext = {};

  const browser = await chromium.launch({ headless: true, timeout: NAV_TIMEOUT_MS });
  try {
    // TC-01, TC-02: independent, each in its own fresh session.
    caseResults.push(
      await runInFreshContext(
        browser,
        "TC-01",
        "Admin Authentication & Dashboard",
        buildTc01Steps(env),
        nextId,
        runId,
        1,
      ),
    );
    caseResults.push(
      await runInFreshContext(
        browser,
        "TC-02",
        "Project Lead / Project Overview",
        buildTc02Steps(env),
        nextId,
        runId,
        2,
      ),
    );

    // TC-03 + TC-04: one continuous Project Lead session (TC-04 has no sign-in
    // step of its own — it works on the ticket TC-03 just created).
    const tc03 = await runTc03(browser, env, ticketCtx, nextId, runId);
    caseResults.push(tc03.result);

    if (tc03.page) {
      caseResults.push(await runTc04InPage(tc03.page, ticketCtx, nextId, runId));
    } else {
      caseResults.push(
        fullySkippedCase("TC-04", "Ticket Workflow", TC04_STEP_NAMES, nextId, NO_TICKET_SKIP_REASON),
      );
    }
    await tc03.close();

    // TC-05: independent of TC-01–04's outcome.
    caseResults.push(
      await runInFreshContext(
        browser,
        "TC-05",
        "Member Dashboard / All Projects",
        buildTc05Steps(env),
        nextId,
        runId,
        5,
      ),
    );

    // TC-06: independent of TC-01/02/05, but depends on TC-03's ticket.
    if (ticketCtx.url) {
      caseResults.push(
        await runInFreshContext(
          browser,
          "TC-06",
          "Member My Work & Hours",
          buildTc06Steps(env, ticketCtx),
          nextId,
          runId,
          6,
        ),
      );
    } else {
      caseResults.push(
        fullySkippedCase("TC-06", "Member My Work & Hours", TC06_STEP_NAMES, nextId, NO_TICKET_SKIP_REASON),
      );
    }

    // TC-07, TC-08: independent of everything above.
    caseResults.push(
      await runInFreshContext(browser, "TC-07", "Reports", buildTc07Steps(env), nextId, runId, 7),
    );
    caseResults.push(
      await runInFreshContext(browser, "TC-08", "Session Protection", buildTc08Steps(env), nextId, runId, 8),
    );
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
