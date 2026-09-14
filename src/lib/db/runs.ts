import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  RunResult,
  RunStatus,
  StepResult,
  StepStatus,
  TestCaseResult,
  TestCaseStatus,
} from "@/lib/marko/types";

export type PersistedRun = RunResult & {
  id: string;
  agentId: string;
};

const DB_PATH = join(process.cwd(), ".data", "agents.db");

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (db) return db;

  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const instance = new DatabaseSync(DB_PATH);
  instance.exec("PRAGMA journal_mode = WAL");
  instance.exec("PRAGMA foreign_keys = ON");

  instance.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL
    )
  `);
  instance.exec(`
    CREATE INDEX IF NOT EXISTS idx_runs_agent_started
      ON runs (agent_id, started_at DESC)
  `);
  instance.exec(`
    CREATE TABLE IF NOT EXISTS run_cases (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs (id),
      case_order INTEGER NOT NULL,
      case_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      duration_ms INTEGER NOT NULL
    )
  `);
  instance.exec(`
    CREATE INDEX IF NOT EXISTS idx_run_cases_run
      ON run_cases (run_id, case_order)
  `);
  instance.exec(`
    CREATE TABLE IF NOT EXISTS run_steps (
      run_case_id TEXT NOT NULL REFERENCES run_cases (id),
      step_order INTEGER NOT NULL,
      step_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      message TEXT,
      PRIMARY KEY (run_case_id, step_order)
    )
  `);

  db = instance;
  return instance;
}

function toStep(row: Record<string, SQLOutputValue>): StepResult {
  return {
    id: Number(row.step_id),
    name: String(row.name),
    status: String(row.status) as StepStatus,
    durationMs: Number(row.duration_ms),
    message: row.message === null ? undefined : String(row.message),
  };
}

function getStepRows(runCaseId: string): Record<string, SQLOutputValue>[] {
  return getDb()
    .prepare("SELECT * FROM run_steps WHERE run_case_id = ? ORDER BY step_order ASC")
    .all(runCaseId);
}

function getCaseRows(runId: string): Record<string, SQLOutputValue>[] {
  return getDb()
    .prepare("SELECT * FROM run_cases WHERE run_id = ? ORDER BY case_order ASC")
    .all(runId);
}

function toRun(runRow: Record<string, SQLOutputValue>): PersistedRun {
  const runId = String(runRow.id);
  const caseRows = getCaseRows(runId);

  const testCases: TestCaseResult[] = caseRows.map((caseRow) => ({
    id: String(caseRow.case_id),
    name: String(caseRow.name),
    status: String(caseRow.status) as TestCaseStatus,
    durationMs: Number(caseRow.duration_ms),
    steps: getStepRows(String(caseRow.id)).map(toStep),
  }));

  return {
    id: runId,
    agentId: String(runRow.agent_id),
    status: String(runRow.status) as RunStatus,
    startedAt: String(runRow.started_at),
    completedAt: String(runRow.completed_at),
    durationMs: Number(runRow.duration_ms),
    testCases,
  };
}

/** Persists a completed run with its test cases and steps atomically. Throws if persistence fails. */
export function saveRun(agentId: string, result: RunResult): PersistedRun {
  const database = getDb();
  const id = randomUUID();

  database.exec("BEGIN");
  try {
    database
      .prepare(
        `INSERT INTO runs (id, agent_id, status, started_at, completed_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, agentId, result.status, result.startedAt, result.completedAt, result.durationMs);

    const insertCase = database.prepare(
      `INSERT INTO run_cases (id, run_id, case_order, case_id, name, status, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertStep = database.prepare(
      `INSERT INTO run_steps (run_case_id, step_order, step_id, name, status, duration_ms, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    result.testCases.forEach((testCase: TestCaseResult, caseIndex) => {
      const caseRowId = randomUUID();
      insertCase.run(
        caseRowId,
        id,
        caseIndex,
        testCase.id,
        testCase.name,
        testCase.status,
        testCase.durationMs,
      );

      testCase.steps.forEach((step: StepResult, stepIndex) => {
        insertStep.run(
          caseRowId,
          stepIndex,
          step.id,
          step.name,
          step.status,
          step.durationMs,
          step.message ?? null,
        );
      });
    });

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return { id, agentId, ...result };
}

export function getLastRun(agentId: string): PersistedRun | null {
  const runRow = getDb()
    .prepare("SELECT * FROM runs WHERE agent_id = ? ORDER BY started_at DESC LIMIT 1")
    .get(agentId);
  if (!runRow) return null;

  return toRun(runRow);
}

export function listRuns(agentId: string, limit = 20): PersistedRun[] {
  const runRows = getDb()
    .prepare("SELECT * FROM runs WHERE agent_id = ? ORDER BY started_at DESC LIMIT ?")
    .all(agentId, limit);

  return runRows.map(toRun);
}

export function getRun(runId: string): PersistedRun | null {
  const runRow = getDb().prepare("SELECT * FROM runs WHERE id = ?").get(runId);
  if (!runRow) return null;

  return toRun(runRow);
}
