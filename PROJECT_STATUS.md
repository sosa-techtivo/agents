# Techtivo AGENTS — MVP Status

**Date: September 14, 2026**

## Status

**MVP COMPLETE / FUNCTIONAL.**

The system allows manually running real functional QA against MARKO and
JIRITA, from a private, local interface, with results persisted per run and
browsable through history.

## Completed

- Private authentication (signed session cookie, env-configured admin
  credentials)
- Agents dashboard (`src/app/agents`)
- MARKO QA Agent (read-only)
- JIRITA QA Agent (Admin / Project Lead / Member roles, scoped writes)
- Test-case hierarchy: Agent → Run → Test Case → Step
- SQLite run persistence (`.data/agents.db`)
- Run History
- Run detail modal/view
- Accordion Test Case plan
- Manual "Run Agent" execution
- Live Preview modal during execution
- Progress indicator during execution
- Failure screenshots (captured only on step failure)
- Authenticated artifact serving (screenshots gated behind session auth)
- Fail-fast behavior (no blind continuation past a failed step)
- Local persistent run history across process restarts

## MARKO Coverage

**4 Test Cases / 9 Steps**, read-only:

- TC-01 Authentication — 2 steps
- TC-02 Sites Dashboard — 2 steps
- TC-03 SEO Report — 4 steps
- TC-04 Sign Out — 1 step

## JIRITA Coverage

**8 Test Cases / 48 Steps**, spanning three QA roles (Admin, Project Lead,
Member):

- TC-01 Admin Authentication & Dashboard — 6 steps (Admin)
- TC-02 Project Lead / Project Overview — 6 steps (Project Lead)
- TC-03 Ticket Creation — 6 steps (Project Lead)
- TC-04 Ticket Workflow — 7 steps (Project Lead, continues TC-03's session)
- TC-05 Member Dashboard / All Projects — 6 steps (Member)
- TC-06 Member My Work & Hours — 9 steps (Member, depends on TC-03's ticket)
- TC-07 Reports — 5 steps (Admin)
- TC-08 Session Protection — 3 steps (unauthenticated)

## Validated MVP behavior

- MARKO runs PASS end to end
- JIRITA full run PASS, 8/8 Test Cases and 48/48 Steps
- A forced MARKO failure was tested manually
- Failure screenshot capture confirmed working on a forced failure
- Downstream cases are correctly recorded as `skipped` under fail-fast
- Live Preview confirmed working during an in-progress run
- Run History and run detail view confirmed working
- Artifacts confirmed reachable only through authenticated requests
- Existing run history remains readable after the `run_steps` schema
  evolved (additive `artifact_path` migration, no data rewritten)

## Current execution model

- Manual execution only — a person triggers each run
- Local runtime — a single persistent Node process
- No scheduled or recurring (e.g. weekly) execution in the current scope
- No background queue
- No cloud worker
- No supported Vercel production runtime for the agents
- No Supabase dependency for AGENTS in the current MVP

## Known limitations

- Persistence and artifacts depend on local SQLite and local filesystem
- Assumes a single persistent Node process (no horizontal scaling of runs)
- Live Preview uses polling (`state.json` + a still frame), not video or
  streaming
- Very fast steps can visually skip frames in the Live Preview
- Closing the tab or navigating away stops the preview client, but does not
  necessarily stop the server-side run in progress
- No reattachment to an already-in-progress run after a page reload
- No scheduling of any kind
- No cloud persistence
- JIRITA QA creates controlled, real QA data (tickets, time entries) inside
  the authorized QA project during the applicable Test Cases
- Test coverage is intentionally targeted at key flows, not exhaustive
  product regression testing

## Out of scope / Future

These are potential future directions only — none are designed or
committed:

- Cloud-compatible execution architecture
- Supabase/Postgres or another persistent database, if a future architecture
  requires it
- Object storage for artifacts
- Worker/queue execution model
- Scheduled execution
- Notifications
- Additional Techtivo agents
- Broader regression coverage

## MVP Freeze

The MVP is frozen at this point. Any new capability, architectural change,
or scope expansion is future work and should be scoped and decided
separately — not folded in as an incidental refactor or expansion of the
current implementation.
