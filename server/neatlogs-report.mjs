import { readFileSync } from "node:fs";
import { rememberTrace } from "./trace-links.mjs";

function publicActivity(agent) {
  if (typeof agent.task !== "string") return null;
  const task = agent.task.trim();
  if (!task || task.length > 160 || /[\r\n]/.test(task) || /(?:\/Users\/|\/home\/|~\/)/.test(task)) return null;
  return task;
}

function ingestKey() {
  if (process.env.NEATLOGS_API_KEY?.trim()) return process.env.NEATLOGS_API_KEY.trim();
  try {
    const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of text.split("\n")) {
      const match = /^NEATLOGS_API_KEY=(.*)$/.exec(line.trim());
      if (!match) continue;
      const value = match[1].trim().replace(/^['"]|['"]$/g, "");
      if (value) {
        process.env.NEATLOGS_API_KEY = value;
        return value;
      }
    }
  } catch {
    /* Missing .env just means reporting stays off. */
  }
  return "";
}

/** Which discovered sessions should become a Neatlogs span. Chat text is never included. */
export function sessionsToReport(seen, agents) {
  const next = new Map(seen);
  const report = [];
  for (const agent of agents ?? []) {
    if (!agent?.id || typeof agent.updatedAt !== "string" || agent.id.includes(":helper:")) continue;
    const activity = publicActivity(agent);
    const project = typeof agent.project === "string" ? agent.project.slice(0, 80) : null;
    const signature = `${agent.status}:${agent.updatedAt}:${activity ?? ""}:${project ?? ""}`;
    if (next.get(agent.id) === signature) continue;
    const previous = next.get(`${agent.id}:status`);
    next.set(agent.id, signature);
    next.set(`${agent.id}:status`, agent.status);
    report.push({
      id: agent.id,
      harness: typeof agent.harness === "string" ? agent.harness : "local",
      status: agent.status,
      updatedAt: agent.updatedAt,
      activity,
      project,
      recovered: previous === "error" || previous === "blocked",
    });
  }
  return { seen: next, report };
}

const seen = new Map();
let chain = Promise.resolve();

/**
 * Sends one span per newly active session. The session id is the Claude or Cursor UUID.
 * Requires NEATLOGS_API_KEY. Does nothing when the key is absent.
 */
export function reportOfficeSessions(agents) {
  const apiKey = ingestKey();
  if (!apiKey) return Promise.resolve({ sent: 0, reason: "NEATLOGS_API_KEY is not set" });
  const picked = sessionsToReport(seen, agents);
  seen.clear();
  for (const [id, signature] of picked.seen) seen.set(id, signature);
  if (!picked.report.length) return Promise.resolve({ sent: 0 });
  const job = chain.then(() => sendSpans(apiKey, picked.report));
  chain = job.catch(() => {});
  return job;
}

async function sendSpans(apiKey, report) {
  const { doctorCapturedLocalV2, flush, init, shutdown, span } = await import("neatlogs");
  await init({
    apiKey,
    endpoint: process.env.NEATLOGS_ENDPOINT || "https://ingest.neatlogs.com",
    workflowName: "trace-office",
  });
  try {
    for (const session of report) {
      const run = span({ kind: "WORKFLOW", name: `${session.harness}-session` }, async () => ({
        sessionId: session.id,
        harness: session.harness,
        project: session.project,
        status: session.status,
        updatedAt: session.updatedAt,
        activity: session.activity,
        recovered: session.recovered,
      }));
      await run();
    }
    await flush();
    try {
      const captured = typeof doctorCapturedLocalV2 === "function" ? doctorCapturedLocalV2() : null;
      const last = report[report.length - 1];
      if (last) rememberTrace(last.id, captured?.capture?.trace_id, last.recovered ? "recovered" : last.status === "error" ? "error" : "latest");
    } catch {
      /* The span still sends when the local trace id is unavailable. */
    }
    return { sent: report.length };
  } finally {
    await shutdown();
  }
}
