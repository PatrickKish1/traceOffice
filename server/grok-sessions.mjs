import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const TITLE_LIMIT = 300;

function text(value, limit = TITLE_LIMIT) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > limit || /[\r\n]/.test(trimmed)) return null;
  if (/(?:\/Users\/|\/home\/|[A-Z]:\\|~\/)/.test(trimmed)) return null;
  return trimmed;
}

function stamp(value, fallbackMs) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  return new Date(fallbackMs).toISOString();
}

function count(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

/** Read-only metadata from local Grok sessions. Conversation files are never opened. */
export async function readGrokSessions({
  grokHome = process.env.GROK_HOME ?? path.join(homedir(), ".grok"),
  project = process.env.DOTS_SESSION_CWD ?? process.env.TRACE_SESSION_CWD ?? process.cwd(),
  now = Date.now(),
} = {}) {
  const sessionsRoot = path.join(grokHome, "sessions");
  let root;
  try {
    root = await realpath(sessionsRoot);
  } catch {
    throw new Error("No Grok sessions were found for this project. Start one here, or import a snapshot.");
  }
  const wanted = project ? path.resolve(project) : "";
  const found = [];
  const groups = await readdir(root, { withFileTypes: true });
  for (const group of groups) {
    if (!group.isDirectory() || group.name.startsWith(".")) continue;
    const groupPath = path.join(root, group.name);
    let cwd = group.name;
    try { cwd = decodeURIComponent(group.name); } catch { /* Keep the directory name. */ }
    const marker = await readJson(path.join(groupPath, ".cwd"));
    if (typeof marker === "string" && marker.trim()) cwd = marker.trim();
    else {
      const markerFile = await readFile(path.join(groupPath, ".cwd"), "utf8").catch(() => "");
      if (markerFile.trim()) cwd = markerFile.trim();
    }
    if (wanted && path.resolve(cwd) !== wanted && path.basename(cwd) !== path.basename(wanted)) continue;
    const entries = await readdir(groupPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const dir = await realpath(path.join(groupPath, entry.name));
      if (!dir.startsWith(root + path.sep)) continue;
      const summary = await readJson(path.join(dir, "summary.json"));
      if (!summary || typeof summary !== "object") continue;
      const signals = (await readJson(path.join(dir, "signals.json"))) ?? {};
      const info = await stat(path.join(dir, "summary.json"));
      const updatedAt = stamp(
        summary.updated_at ?? summary.updatedAt ?? summary.updated ?? signals.updated_at ?? signals.updatedAt,
        info.mtimeMs,
      );
      const age = now - Date.parse(updatedAt);
      const ended = Boolean(summary.archived || summary.ended_at || summary.endedAt || summary.status === "completed" || summary.status === "idle");
      const status = ended ? "idle" : Number.isFinite(age) && age >= 0 && age < 5 * 60_000 ? "working" : Number.isFinite(age) ? "idle" : "unknown";
      const title = text(summary.title) ?? text(summary.summary) ?? text(summary.name) ?? "Session title unavailable";
      const contextUsed = count(signals.context_used ?? signals.contextUsed ?? signals.input_tokens);
      const contextWindow = count(signals.context_window ?? signals.contextWindow ?? signals.context_limit);
      found.push({
        id: entry.name,
        name: title,
        harness: "grok",
        model: text(summary.model, 80) ?? text(summary.model_id, 80) ?? text(summary.modelId, 80),
        status,
        task: title === "Session title unavailable" ? null : title,
        contextUsed: contextUsed !== null && contextWindow !== null ? contextUsed : null,
        contextWindow: contextUsed !== null && contextWindow !== null ? contextWindow : null,
        updatedAt,
        activityLabel: text(summary.activity, 160),
        parentId: text(summary.parent_session_id, 80) ?? text(summary.parentSessionId, 80),
      });
    }
  }
  found.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const agents = found.slice(0, 50).map(({ parentId, ...agent }) => agent);
  const ids = new Set(agents.map((agent) => agent.id));
  const interactions = found
    .filter((agent) => agent.parentId && ids.has(agent.id) && ids.has(agent.parentId) && agent.parentId !== agent.id)
    .map((agent) => ({ fromId: agent.parentId, toId: agent.id, at: agent.updatedAt, kind: "delegation" }))
    .slice(0, 100);
  if (!agents.length) {
    throw new Error("No Grok sessions were found for this project. Start one here, or import a snapshot.");
  }
  return {
    version: 1,
    agents,
    interactions,
    project: path.basename(wanted || root),
    total: found.length,
    observedAt: new Date(now).toISOString(),
    source: "grok",
  };
}
