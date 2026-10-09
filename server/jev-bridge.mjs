import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

function localRequestAllowed(req) {
  const host = req.headers.host?.split(":")[0];
  if (!host || !["127.0.0.1", "localhost", "::1"].includes(host)) return false;
  if (req.headers.origin && req.headers.origin !== `http://${host}`) return false;
  if (req.headers["sec-fetch-site"] && req.headers["sec-fetch-site"] !== "same-origin") return false;
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Fast path: same rules as `src/jev/triage.ts` (no Python). */
function rulesTriage(payload) {
  const status = payload.status ?? "unknown";
  const updatedAt = payload.updatedAt;
  const now = Date.now();
  const stale = updatedAt && Number.isFinite(Date.parse(updatedAt)) ? now - Date.parse(updatedAt) : Infinity;
  const health = payload.health ?? {};
  const task = typeof payload.task === "string" ? payload.task.toLowerCase() : "";
  const activity = typeof payload.activityLabel === "string" ? payload.activityLabel.toLowerCase() : "";
  const text = `${task} ${activity}`;

  if (status === "blocked" || text.includes("needs a person") || text.includes("needs human")) {
    return { choice: "needs_human", confidence: 0.93, subtitle: "Needs a person at this desk", engine: "rules" };
  }
  if (status === "error" || health.state === "error") {
    return { choice: "failed", confidence: 0.9, subtitle: "Run failed or disconnected", engine: "rules" };
  }
  if (status === "offline" || payload.disconnectedAt) {
    return { choice: "failed", confidence: 0.88, subtitle: "Run failed or disconnected", engine: "rules" };
  }
  if (health.retrying) {
    return { choice: "watch", confidence: 0.85, subtitle: "Retrying after a tool failure", engine: "rules" };
  }
  if (health.state === "watch" || status === "unknown") {
    return { choice: "watch", confidence: 0.8, subtitle: "Keeping an eye on this run", engine: "rules" };
  }
  if (status === "working" && stale > 5 * 60 * 1000) {
    return { choice: "stuck", confidence: 0.82, subtitle: "No movement — nudge the agent", engine: "rules" };
  }
  return { choice: "ok", confidence: 0.72, subtitle: "Desk looks fine", engine: "rules" };
}

function runSystemOne(payload) {
  return new Promise((resolve, reject) => {
    const script = path.join(root, "..", "scripts", "jev-system-one-triage.py");
    const child = spawn(process.env.JEV_SYSTEM_ONE_PYTHON ?? "python3", [script], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 2) return reject(new Error("system-one not installed"));
      if (code !== 0) return reject(new Error(stderr || `system-one exit ${code}`));
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

export async function jevTriageHttp(payload) {
  if (process.env.JEV_SYSTEM_ONE === "1") {
    try {
      const result = await runSystemOne(payload);
      return { ...result, engine: "system-one" };
    } catch {
      /* fall through */
    }
  }
  return rulesTriage(payload);
}

export function jevBridgePlugin() {
  return {
    name: "traceoffice-jev-bridge",
    configureServer(server) {
      server.middlewares.use("/api/jev/triage", async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json");
        if (!localRequestAllowed(req)) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Local office only." }));
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "POST only." }));
          return;
        }
        try {
          const body = JSON.parse(await readBody(req));
          res.end(JSON.stringify(await jevTriageHttp(body)));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON body." }));
        }
      });
    },
  };
}
