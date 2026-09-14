"use server";

import { getSession } from "@/lib/auth";
import { runMarkoAgent } from "@/lib/marko/runner";
import type { RunResult } from "@/lib/marko/types";

export async function runMarko(): Promise<RunResult> {
  const session = await getSession();
  if (!session) {
    throw new Error("Not authenticated.");
  }

  return runMarkoAgent();
}
