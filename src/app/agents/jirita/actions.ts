"use server";

import { getSession } from "@/lib/auth";
import { runJiritaAgent } from "@/lib/jirita/runner";
import { runAndPersist } from "@/lib/agents/run-and-persist";
import type { RunOutcome } from "@/lib/agents/types";

export async function runJirita(runId: string): Promise<RunOutcome> {
  const session = await getSession();
  if (!session) {
    throw new Error("Not authenticated.");
  }

  return runAndPersist("jirita", runId, runJiritaAgent);
}
