import type { Page } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

const ARTIFACTS_ROOT = resolve(process.cwd(), ".data", "artifacts");

function sanitizeSegment(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned.length > 0 ? cleaned : "unknown";
}

function buildArtifactRelativePath(runId: string, caseId: string, stepId: number): string {
  return [sanitizeSegment(runId), sanitizeSegment(caseId), sanitizeSegment(String(stepId)), "failure.png"].join(
    "/",
  );
}

/**
 * Resolves a relative artifact reference (as persisted, or as requested via
 * the serving route) to an absolute path, refusing anything that would
 * escape `.data/artifacts`. Returns null for any suspicious input.
 */
export function resolveArtifactPath(relativePath: string): string | null {
  if (!relativePath || relativePath.includes("..") || relativePath.startsWith("/")) {
    return null;
  }
  const absolute = resolve(ARTIFACTS_ROOT, relativePath);
  if (absolute !== ARTIFACTS_ROOT && !absolute.startsWith(ARTIFACTS_ROOT + sep)) {
    return null;
  }
  return absolute;
}

/**
 * Best-effort failure screenshot: captures at most one PNG for the failing
 * step and returns the relative path to persist, or undefined if capture
 * wasn't possible. Never throws — a screenshot failure must never replace
 * or hide the step's real (functional) failure.
 */
export async function captureFailureScreenshot(
  page: Page,
  runId: string,
  caseId: string,
  stepId: number,
): Promise<string | undefined> {
  const relativePath = buildArtifactRelativePath(runId, caseId, stepId);
  const absolutePath = join(ARTIFACTS_ROOT, relativePath);

  try {
    await mkdir(dirname(absolutePath), { recursive: true });
    await page.screenshot({ path: absolutePath, fullPage: true });
    return relativePath;
  } catch (error) {
    console.error("Failed to capture failure screenshot (non-fatal):", error);
    return undefined;
  }
}
