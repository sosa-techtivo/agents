import { randomUUID } from "node:crypto";
import { refresh, revalidatePath } from "next/cache";
import { saveRun } from "@/lib/db/runs";
import { clearLiveRunState } from "./live-state";
import type { RunOutcome, RunResult } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shared "run + persist + refresh" flow for any agent's Server Action:
 * run it, persist the result, and refresh the current page / invalidate the
 * dashboard. Never claims a run was saved when persistence actually failed.
 *
 * `requestedRunId` normally comes from the client (generated synchronously
 * at click time, via crypto.randomUUID(), so the UI can start polling
 * /agents/runs/<runId>/live immediately without waiting for this action to
 * return) — reusing the same identity the run is later persisted under, and
 * that failure screenshots are already filed under. A value that isn't a
 * well-formed UUID is never trusted for building a filesystem path; a fresh
 * one is generated instead.
 */
export async function runAndPersist(
  agentId: string,
  requestedRunId: string,
  runAgent: (runId: string) => Promise<RunResult>,
): Promise<RunOutcome> {
  const runId = UUID_PATTERN.test(requestedRunId) ? requestedRunId : randomUUID();

  try {
    const result = await runAgent(runId);

    try {
      const persistedRun = saveRun(agentId, runId, result);
      revalidatePath("/agents");
      refresh();
      return { result, persisted: true, runId: persistedRun.id };
    } catch (error) {
      console.error(`Failed to persist ${agentId} run:`, error);
      return { result, persisted: false };
    }
  } finally {
    // Temporary live-preview state is cleared on every outcome (pass, fail,
    // or the runner throwing outright) — it never survives the run.
    await clearLiveRunState(runId);
  }
}
