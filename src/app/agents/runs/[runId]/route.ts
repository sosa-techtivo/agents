import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRun } from "@/lib/db/runs";

// Backs the Run Detail modal: the full persisted run (test cases + steps),
// fetched on demand when the user clicks "View" rather than eagerly loaded
// for every History row. Same auth/read path as the existing Run Detail
// pages — no schema or persistence change.
export async function GET(_request: Request, context: RouteContext<"/agents/runs/[runId]">) {
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const { runId } = await context.params;
  const run = getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(run, { headers: { "Cache-Control": "no-store" } });
}
