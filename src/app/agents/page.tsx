import Link from "next/link";

const cardBase = "rounded-lg border p-6 flex flex-col gap-4";

function StatusBadge({ label, tone }: { label: string; tone: "ready" | "disabled" }) {
  const toneClasses =
    tone === "ready"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500";

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses}`}
    >
      {label}
    </span>
  );
}

export default function AgentsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Agents</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Functional QA agents for Techtivo products.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className={`${cardBase} border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">MARKO QA Agent</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Project: MARKO</p>
            </div>
            <StatusBadge label="Ready" tone="ready" />
          </div>
          <dl className="grid grid-cols-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <dt>Last run</dt>
            <dd className="text-right">Never</dd>
            <dt>Last result</dt>
            <dd className="text-right">—</dd>
          </dl>
          <Link
            href="/agents/marko"
            className="mt-auto inline-flex w-fit items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            View agent
          </Link>
        </div>

        <div
          className={`${cardBase} border-zinc-200 bg-white opacity-70 dark:border-zinc-800 dark:bg-zinc-950`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">JIRITA QA Agent</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Project: JIRITA</p>
            </div>
            <StatusBadge label="Not configured" tone="disabled" />
          </div>
          <dl className="grid grid-cols-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <dt>Last run</dt>
            <dd className="text-right">Never</dd>
            <dt>Last result</dt>
            <dd className="text-right">—</dd>
          </dl>
          <span className="mt-auto inline-flex w-fit cursor-not-allowed items-center rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
            View agent
          </span>
        </div>
      </div>
    </div>
  );
}
