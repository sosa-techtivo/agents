import { RunAgentButton } from "./run-agent-button";

const testPlan = [
  "Open MARKO",
  "Sign in",
  "Validate Sites dashboard",
  "Open Techtivo.com report",
  "Validate SEO health",
  "Validate MARKO Insights",
  "Validate Analysis history",
  "Validate Search Console",
  "Sign out",
];

export default function MarkoAgentPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">MARKO QA Agent</h1>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Ready
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Functional product QA for MARKO.
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

      <RunAgentButton />
    </div>
  );
}
