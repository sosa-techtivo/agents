"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PersistedRun } from "@/lib/db/runs";
import { RunDetailView } from "./run-detail-view";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; run: PersistedRun };

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

// Opened from Run History's "View" — loads the selected run on demand (not
// eagerly with the rest of History) and shows it without leaving the agent
// page. Unlike the Live Preview modal, there's no operation in progress
// here, so backdrop click, Escape, and an explicit close button all work.
export function RunDetailModal({
  agentName,
  runId,
  runsBasePath,
  onClose,
}: {
  agentName: string;
  runId: string;
  runsBasePath: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch(`/agents/runs/${runId}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load run");
        return response.json() as Promise<PersistedRun>;
      })
      .then((run) => {
        if (!cancelled) setState({ status: "ready", run });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const fullPageHref = `${runsBasePath}/${runId}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${agentName} run detail`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href={fullPageHref}
            className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Open full page
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <CloseIcon />
          </button>
        </div>

        {state.status === "loading" ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading run details…</p>
        ) : state.status === "error" ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Could not load this run.{" "}
            <Link href={fullPageHref} className="underline underline-offset-2">
              Open full page
            </Link>{" "}
            instead.
          </p>
        ) : (
          <RunDetailView key={state.run.id} agentName={agentName} run={state.run} />
        )}
      </div>
    </div>
  );
}
