import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getSession } from "@/lib/auth";
import { resolveArtifactPath } from "@/lib/agents/artifacts";

// Serves failure screenshots from .data/artifacts. Proxy already redirects
// unauthenticated requests under /agents/*, but a browser <img> can't follow
// that redirect usefully, so this also checks the session directly and
// replies with a clean 401 instead of a broken image.
export async function GET(_request: Request, context: RouteContext<"/agents/artifacts/[...path]">) {
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  const { path } = await context.params;
  const absolutePath = resolveArtifactPath(path.join("/"));
  if (!absolutePath) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const data = await readFile(absolutePath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
