import { runJirita } from "./actions";
import { listRuns } from "@/lib/db/runs";
import { RunAgentButton } from "../_components/run-agent-button";
import { AgentWorkspace } from "../_components/agent-workspace";

const AGENT_ID = "jirita";
const RUNS_BASE_PATH = "/agents/jirita/runs";

const testCases = [
  {
    id: "TC-01",
    name: "Admin Authentication & Dashboard",
    steps: [
      "Open JIRITA",
      "Sign in as Admin",
      "Validate Dashboard",
      "Validate main navigation",
      "Validate Projects access",
      "Sign out",
    ],
  },
  {
    id: "TC-02",
    name: "Project Lead / Project Overview",
    steps: [
      "Sign in as Project Lead",
      "Open JIRITA Live",
      "Validate Project Overview",
      "Validate project work sections",
      "Validate project navigation",
      "Sign out",
    ],
  },
  {
    id: "TC-03",
    name: "Ticket Creation",
    steps: [
      "Sign in as Project Lead",
      "Open JIRITA Live",
      "Start new ticket",
      "Create automated QA ticket",
      "Verify ticket appears",
      "Capture created ticket identity",
    ],
  },
  {
    id: "TC-04",
    name: "Ticket Workflow",
    steps: [
      "Open created QA ticket",
      "Capture current status and priority",
      "Change ticket status",
      "Change ticket priority",
      "Reload or navigate away/back",
      "Verify changes persisted",
      "Sign out",
    ],
  },
  {
    id: "TC-05",
    name: "Member Dashboard / All Projects",
    steps: [
      "Sign in as Member",
      "Validate Member Dashboard",
      "Validate All Projects selector",
      "Validate All Projects default state",
      "Validate dashboard content",
      "Sign out",
    ],
  },
  {
    id: "TC-06",
    name: "Member My Work & Hours",
    steps: [
      "Sign in as Member",
      "Open JIRITA Live",
      "Open created QA ticket",
      "Register first small time entry",
      "Register second small time entry",
      "Open My Work",
      "Open Hours",
      "Verify accumulated time",
      "Sign out",
    ],
  },
  {
    id: "TC-07",
    name: "Reports",
    steps: ["Sign in as Admin", "Open Reports", "Validate Reports loads", "Validate report content renders", "Sign out"],
  },
  {
    id: "TC-08",
    name: "Session Protection",
    steps: ["Ensure signed out", "Open a protected JIRITA route", "Validate redirect to login"],
  },
];

export default function JiritaAgentPage() {
  const runs = listRuns(AGENT_ID);

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

      <RunAgentButton agentName="JIRITA QA Agent" runAction={runJirita} runsBasePath={RUNS_BASE_PATH} />

      <AgentWorkspace
        testCases={testCases}
        runs={runs}
        runsBasePath={RUNS_BASE_PATH}
        agentName="JIRITA QA Agent"
      />
    </div>
  );
}
