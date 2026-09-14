"use server";

import { refresh, revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { runMarkoAgent } from "@/lib/marko/runner";
import type { RunResult } from "@/lib/marko/types";
import { saveRun } from "@/lib/db/runs";

const AGENT_ID = "marko";

export type RunMarkoOutcome = {
  result: RunResult;
  persisted: boolean;
  runId?: string;
};

export async function runMarko(): Promise<RunMarkoOutcome> {
  const session = await getSession();
  if (!session) {
    throw new Error("Not authenticated.");
  }

  const result = await runMarkoAgent();

  try {
    const persistedRun = saveRun(AGENT_ID, result);
    revalidatePath("/agents");
    refresh();
    return { result, persisted: true, runId: persistedRun.id };
  } catch (error) {
    // The run itself already happened; only persistence failed. Report that
    // honestly to the UI instead of pretending the run was saved.
    console.error("Failed to persist MARKO run:", error);
    return { result, persisted: false };
  }
}
