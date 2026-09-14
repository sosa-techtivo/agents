const testPlan = [
  "Open JIRITA login",
  "Sign in with QA user",
  "Validate Dashboard",
  "Select All Projects",
  "Open QA project",
  "Create automated QA ticket",
  "Verify ticket appears",
  "Change ticket status",
  "Register time",
  "Validate My Work → Hours",
  "Logout",
];

export default function JiritaAgentPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">JIRITA QA Agent</h1>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Ready
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Functional product QA for JIRITA.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">Test Plan</h2>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          {testPlan.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">Last run</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Never run</p>
      </section>

      <div>
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
        >
          Run Agent
          <span className="text-xs font-normal">(Coming next)</span>
        </button>
      </div>
    </div>
  );
}
