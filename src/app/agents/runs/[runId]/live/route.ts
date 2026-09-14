import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readLiveRunState } from "@/lib/agents/live-state";

// Polled by the client while a manual run is in progress. Never cached —
// the whole point is that the response reflects the current instant.
export async function GET(_request: Request, context: RouteContext<"/agents/runs/[runId]/live">) {
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const { runId } = await context.params;
  const state = readLiveRunState(runId);
  if (!state) {
    return NextResponse.json({ status: "not_running" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
