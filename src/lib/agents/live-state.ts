import type { Page } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { LiveRunState } from "./types";

const LIVE_ROOT = resolve(process.cwd(), ".data", "live");

type LiveProgress = Omit<LiveRunState, "runId" | "status" | "updatedAt" | "frameAvailable">;

// Run ids are always crypto.randomUUID() output. Accepting only that exact
// shape means a value can never be used to build a path outside LIVE_ROOT,
// regardless of where the id originated (including a client-supplied one).
function runDir(runId: string): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) {
    return null;
  }
  const dir = resolve(LIVE_ROOT, runId);
  if (dir !== LIVE_ROOT && !dir.startsWith(LIVE_ROOT + sep)) return null;
  return dir;
}

async function atomicWrite(path: string, data: string | Uint8Array): Promise<void> {
  const tmpPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmpPath, data);
  await rename(tmpPath, path);
}

/** Best-effort: records what the run is currently doing. Never throws. */
export async function updateLiveRunState(runId: string, progress: LiveProgress): Promise<void> {
  const dir = runDir(runId);
  if (!dir) return;

  try {
    await mkdir(dir, { recursive: true });
    const state: LiveRunState = {
      runId,
      status: "running",
      updatedAt: new Date().toISOString(),
      frameAvailable: existsSync(join(dir, "frame.png")),
      ...progress,
    };
    await atomicWrite(join(dir, "state.json"), JSON.stringify(state));
  } catch (error) {
    console.error("Failed to update live run state (non-fatal):", error);
  }
}

/** Best-effort: captures one viewport screenshot as the current preview frame. Never throws. */
export async function captureLiveFrame(page: Page, runId: string): Promise<void> {
  const dir = runDir(runId);
  if (!dir) return;

  try {
    await mkdir(dir, { recursive: true });
    const tmpPath = join(dir, `frame.${randomUUID()}.tmp.png`);
    await page.screenshot({ path: tmpPath, fullPage: false });
    await rename(tmpPath, join(dir, "frame.png"));
  } catch (error) {
    console.error("Failed to capture live frame (non-fatal):", error);
  }
}

/** Removes all temporary live-preview state for a run. Best-effort, never throws. */
export async function clearLiveRunState(runId: string): Promise<void> {
  const dir = runDir(runId);
  if (!dir) return;

  try {
    await rm(dir, { recursive: true, force: true });
  } catch (error) {
    console.error("Failed to clear live run state (non-fatal):", error);
  }
}

export function readLiveRunState(runId: string): LiveRunState | null {
  const dir = runDir(runId);
  if (!dir) return null;

  try {
    return JSON.parse(readFileSync(join(dir, "state.json"), "utf8")) as LiveRunState;
  } catch {
    return null;
  }
}

export async function readLiveFrame(runId: string): Promise<Buffer | null> {
  const dir = runDir(runId);
  if (!dir) return null;

  const framePath = join(dir, "frame.png");
  if (!existsSync(framePath)) return null;

  try {
    return await readFile(framePath);
  } catch {
    return null;
  }
}
