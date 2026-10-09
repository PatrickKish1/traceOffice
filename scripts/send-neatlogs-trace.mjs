import { flush, init, shutdown, span } from "neatlogs";

const apiKey = process.env.NEATLOGS_API_KEY;
if (!apiKey) {
  console.error("Set NEATLOGS_API_KEY in .env, then run: node --env-file=.env scripts/send-neatlogs-trace.mjs");
  process.exit(1);
}

const handOff = span({ kind: "AGENT", name: "jev", role: "supervisor", goal: "Hand a desk its next run" }, async () => {
  return { desk: "Trace", task: "Watch a live run", status: "working" };
});

const report = span({ kind: "TOOL", name: "report-to-manager", toolName: "report_to_manager" }, async (desk) => {
  return { manager: "Mara", desk, verdict: "needs a person" };
});

const review = span({ kind: "WORKFLOW", name: "office-review" }, async () => {
  const assigned = await handOff();
  const reviewed = await report(assigned.desk);
  return { assigned, reviewed, source: "trace-office-local-probe" };
});

await init({
  apiKey,
  endpoint: "https://ingest.neatlogs.com",
  workflowName: "office-review",
});

try {
  const result = await review();
  await flush();
  console.log(JSON.stringify({ sent: true, workflow: "office-review", result }, null, 2));
} finally {
  await shutdown();
}
