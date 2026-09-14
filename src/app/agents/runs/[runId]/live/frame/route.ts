import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readLiveFrame } from "@/lib/agents/live-state";

// The current temporary preview frame for a manual run. Always fetched
// fresh — no-store keeps the browser from ever showing a stale screenshot
// while the agent is still working.
export async function GET(_request: Request, context: RouteContext<"/agents/runs/[runId]/live/frame">) {
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const { runId } = await context.params;
  const frame = await readLiveFrame(runId);
  if (!frame) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return new NextResponse(new Uint8Array(frame), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
