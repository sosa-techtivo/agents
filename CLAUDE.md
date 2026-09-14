@AGENTS.md

# Techtivo AGENTS

Private QA automation dashboard for Techtivo products. It runs real
Playwright browser flows against real, deployed Techtivo applications and
presents results as **Agent → Run → Test Case → Step**.

This project is **not** MARKO or JIRITA — it is a separate tool that
exercises those products from the outside, over HTTP/browser, using
dedicated QA credentials.

## Current MVP

Two functional agents exist under `src/app/agents/`:

### MARKO QA Agent

- Target: `MARKO_BASE_URL` (production instance: https://marko-techtivo.vercel.app/)
- Runner: `src/lib/marko/runner.ts`
- Suite: **4 Test Cases / 9 Steps**, read-only
  - TC-01 Authentication (2 steps)
  - TC-02 Sites Dashboard (2 steps)
  - TC-03 SEO Report (4 steps)
  - TC-04 Sign Out (1 step)

### JIRITA QA Agent

- Target: `JIRITA_BASE_URL` (production instance: https://jirita.techtivo.com/)
- Runner: `src/lib/jirita/runner.ts`
- Suite: **8 Test Cases / 48 Steps**, across three roles (Admin, Project
  Lead, Member), writes confined to the `JIRITA_QA_PROJECT_SLUG` project
  - TC-01 Admin Authentication & Dashboard (6 steps)
  - TC-02 Project Lead / Project Overview (6 steps)
  - TC-03 Ticket Creation (6 steps)
  - TC-04 Ticket Workflow (7 steps)
  - TC-05 Member Dashboard / All Projects (6 steps)
  - TC-06 Member My Work & Hours (9 steps)
  - TC-07 Reports (5 steps)
  - TC-08 Session Protection (3 steps)

TC-03 and TC-04 share one browser context/session (TC-04 edits the ticket
TC-03 just created); TC-06 depends on the ticket created by TC-03. If TC-03
doesn't produce a usable ticket, TC-04 and TC-06 are recorded as fully
`skipped` rather than run.

## Architecture

- Next.js 16 (App Router), TypeScript, Tailwind
- Playwright (Chromium, headless) drives the actual QA flows, server-side
  only (`src/lib/marko/runner.ts`, `src/lib/jirita/runner.ts`)
- Private auth: credentials + secret from env vars, session is a signed
  cookie (`src/lib/session.ts`, `SESSION_COOKIE_NAME`), verified in
  `src/lib/auth.ts` (`getSession`/`requireSession`)
- Persistence: SQLite via `node:sqlite` (`src/lib/db/runs.ts`)
- Artifacts and Live Preview: local filesystem under `.data/`
- Everything (auth check, Playwright execution, DB writes) runs server-side
  in the Node process — there is no client-side or edge execution of runners

Result hierarchy (see `src/lib/agents/types.ts`):

```
Agent (marko | jirita)
 └─ Run (RunResult: status, startedAt, completedAt, durationMs)
     └─ TestCaseResult[] (id, name, status: passed|failed|skipped)
         └─ StepResult[] (id, name, status, durationMs, message?, artifactPath?)
```

## Persistence

SQLite database at `.data/agents.db` (`src/lib/db/runs.ts`), created and
migrated on first access. Tables:

- `runs` — one row per run (`id`, `agent_id`, `status`, `started_at`,
  `completed_at`, `duration_ms`)
- `run_cases` — one row per test case per run (`id`, `run_id`, `case_order`,
  `case_id`, `name`, `status`, `duration_ms`)
- `run_steps` — one row per step per case (`run_case_id`, `step_order`,
  `step_id`, `name`, `status`, `duration_ms`, `message`, `artifact_path`)

`artifact_path` is an additive migration (`ALTER TABLE ... ADD COLUMN`) —
older rows keep `NULL` and are never rewritten.

Failure artifacts (best-effort, never block the real error):

```
.data/artifacts/<runId>/<caseId>/<stepId>/failure.png
```

Served only to authenticated sessions via
`src/app/agents/artifacts/[...path]/route.ts`
(`src/lib/agents/artifacts.ts` guards path traversal).

Live Preview (temporary, filesystem-based, `src/lib/agents/live-state.ts`):

```
.data/live/<runId>/state.json
.data/live/<runId>/frame.png
```

Written during the run (current case/step, one viewport screenshot) and
removed (`clearLiveRunState`) once the run finishes. It is not part of run
history — only `runs`/`run_cases`/`run_steps` persist long-term.

## Functional behavior

- Runs are started manually from the UI ("Run Agent") — nothing is
  scheduled or automatic
- Test Cases execute sequentially; the run is **fail-fast**: once a step
  fails, all remaining steps in that case and all subsequent cases are
  recorded as `skipped` (or the case itself as `failed` if it produced the
  failure) — no blind continuation
- Step/case/run status is one of `passed` / `failed` / `skipped`
- Every run persists to SQLite; history is available from **Run History**,
  with a detail modal/view per run
- Test Cases are shown as an accordion next to Run History in the agent
  workspace
- While a run is in progress, a **Live Preview** (polling `state.json` +
  `frame.png`) and a progress modal show current case/step
- A screenshot is captured and persisted **only when a step fails**
  (`captureFailureScreenshot`), served only behind auth
- The final run result shown inline is compact; full historical detail is
  read back from Run History, not recomputed

## Runner safety

- MARKO stays **read-only** unless a future suite explicitly authorizes
  writes
- JIRITA may write only inside the authorized QA project
  (`JIRITA_QA_PROJECT_SLUG`, enforced at runtime by `assertAuthorizedProject`
  in `src/lib/jirita/runner.ts`) and only through already-defined flows
- Never widen a runner to destructive actions without explicit instruction
- Never print or persist passwords/secrets (see `safeErrorMessage` in
  `src/lib/agents/errors.ts`)
- Playwright selectors should prefer roles, labels, and stable text over CSS
  classes, `nth-child`, or coordinates
- An optimistic UI render is never proof of persistence — when a test
  depends on durability, wait for a real save/network/data signal (see the
  JIRITA status/priority edit flow, which waits for the PATCH response, not
  just the visible update)
- Failure screenshots are best-effort and must never replace or mask the
  real functional error

## Commands

From `package.json`:

- `npm run dev` — start Next.js dev server
- `npm run build` — production build
- `npm run start` — start the production server
- `npm run lint` — ESLint

## Environment

Variable **names** only (see `.env.example` for the canonical list; never
put real values here):

- `AGENTS_ADMIN_EMAIL`, `AGENTS_ADMIN_PASSWORD`, `AGENTS_SESSION_SECRET`
- `MARKO_BASE_URL`, `MARKO_QA_EMAIL`, `MARKO_QA_PASSWORD`
- `JIRITA_BASE_URL`, `JIRITA_ADMIN_EMAIL`, `JIRITA_ADMIN_PASSWORD`,
  `JIRITA_PL_EMAIL`, `JIRITA_PL_PASSWORD`, `JIRITA_MEMBER_EMAIL`,
  `JIRITA_MEMBER_PASSWORD`, `JIRITA_QA_PROJECT_SLUG`

`.env.local` is local/private and must never be committed.

## Deployment limitation

The current MVP is designed to run **locally, in a single persistent Node
process**. A Vercel deployment was tried at one point, but Vercel/cloud is
**not** a supported runtime for this MVP. Reasons:

- SQLite is a local file (`.data/agents.db`)
- Artifacts and Live Preview are local filesystem state under `.data/`
- Playwright runs are long-lived and tied to a persistent Node process, not
  a request/response or edge function lifecycle

Supabase is **not** a required dependency for AGENTS in the current MVP. A
future cloud-compatible version would need a deliberate decision on
persistent storage, artifact storage, and worker/queue architecture — that
decision has not been made yet and should not be assumed.

## Development rules

- Preserve the current MVP as-is; prefer small, focused changes
- Don't generalize infrastructure (DB, storage, execution model) without a
  concrete, current need
- Don't alter existing Test Cases while doing UI/infra work unless the task
  specifically requires it
- Don't run JIRITA unnecessarily — it creates real tickets/time entries in
  the QA project. Prefer MARKO to validate shared infrastructure when it's
  sufficient
- Never run agents automatically as part of lint/build/CI
- Never modify the MARKO or JIRITA products themselves from this repo —
  this repo only tests them externally
- Don't commit or push unless explicitly instructed
