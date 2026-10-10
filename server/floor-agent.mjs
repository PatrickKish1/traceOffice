import { writeFile } from "node:fs/promises";
import { reportOfficeSessions } from "./neatlogs-report.mjs";
import { traceFor } from "./trace-links.mjs";

const DRILL_ID = "office:recovery-drill";
let drill = null;

export function drillAgent() {
  return drill?.agent ?? null;
}

/** Sends a failed run, then the recovered run, and seats the floor agent with both. */
export async function runRecoveryDrill() {
  const failedAt = new Date().toISOString();
  await reportOfficeSessions([
    {
      id: DRILL_ID,
      harness: "office",
      project: "TraceOffice",
      status: "error",
      updatedAt: failedAt,
      task: "report_to_manager failed",
    },
  ]);
  const recoveredAt = new Date(Date.now() + 1000).toISOString();
  await reportOfficeSessions([
    {
      id: DRILL_ID,
      harness: "office",
      project: "TraceOffice",
      status: "idle",
      updatedAt: recoveredAt,
      task: "Floor agent marked the run recovered",
    },
  ]);
  const failedTrace = traceFor(DRILL_ID, "error");
  const recoveredTrace = traceFor(DRILL_ID, "recovered") ?? traceFor(DRILL_ID);
  drill = {
    agent: {
      id: DRILL_ID,
      name: "Floor agent",
      harness: "office",
      project: "TraceOffice",
      model: null,
      status: "idle",
      task: "Recovery check: report_to_manager failed, then the floor agent marked it recovered",
      contextUsed: null,
      contextWindow: null,
      updatedAt: recoveredAt,
      activityLabel: "Recovered",
      traceUrl: recoveredTrace?.url,
      history: [
        { at: failedAt, status: "error", label: "report_to_manager failed" },
        { at: recoveredAt, status: "idle", label: "Marked recovered" },
      ],
    },
  };
  const evidence = {
    sessionId: DRILL_ID,
    workflow: "trace-office",
    failedAt,
    recoveredAt,
    failedTrace: failedTrace?.url ?? null,
    recoveredTrace: recoveredTrace?.url ?? null,
  };
  await writeFile(new URL("../evidence/recovery-drill.json", import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
  return { agent: drill.agent, evidence };
}
