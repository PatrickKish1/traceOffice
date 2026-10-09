import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const ACTIVE_MS = 5 * 60 * 1000;
const ID = /^[a-zA-Z0-9_-]{8,80}$/;

/** Working if the session file changed in the last five minutes. Does not open the file. */
export function editorSessionStatus(mtimeMs, now = Date.now()) {
  const age = now - mtimeMs;
  if (!Number.isFinite(age) || age < 0) return "unknown";
  return age < ACTIVE_MS ? "working" : "idle";
}

function projectSlug(project) {
  return path.resolve(project).replace(/^[\\/]/, "").replace(/[\\/]/g, "-").replace(/-+$/, "");
}

/** Cursor encodes the folder with dashes and may drop a trailing hyphen. */
export function projectDirMatches(dirName, project) {
  const slug = projectSlug(project);
  const base = path.basename(path.resolve(project)).replace(/-+$/, "");
  const name = dirName.replace(/-+$/, "");
  return name === slug || name.endsWith(`-${base}`) || name.endsWith(base);
}

async function collectJsonl(dir, depth, out) {
  if (depth > 3 || out.length > 80) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectJsonl(full, depth + 1, out);
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(full);
  }
}

async function matchingProjectDirs(root, project) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory() && projectDirMatches(entry.name, project))
    .map((entry) => path.join(root, entry.name));
}

function agentFromFile(harness, file, info, now) {
  const folder = path.basename(path.dirname(file));
  const stem = path.basename(file, ".jsonl");
  const id = ID.test(folder) ? folder : ID.test(stem) ? stem : null;
  if (!id) return null;
  const updatedAt = new Date(info.mtimeMs).toISOString();
  const status = editorSessionStatus(info.mtimeMs, now);
  return {
    id: `${harness}:${id}`,
    name: harness === "cursor" ? "Cursor agent" : "Claude Code",
    harness,
    model: null,
    status,
    task: status === "working" ? "Session file is active" : "Session file is quiet",
    contextUsed: null,
    contextWindow: null,
    updatedAt,
    sourceUrl: `session://${harness}/${encodeURIComponent(id)}`,
    history: [{ at: updatedAt, status, label: status === "working" ? "Session file updated" : "No recent file update" }],
  };
}

/**
 * Cursor and Claude Code sessions for this project.
 * Only file names and modification times are used. Transcripts are never opened.
 */
export async function readEditorSessions({
  project = process.env.DOTS_SESSION_CWD ?? process.env.TRACE_SESSION_CWD ?? process.cwd(),
  now = Date.now(),
  harness = null,
  cursorHome = path.join(homedir(), ".cursor", "projects"),
  claudeHome = path.join(homedir(), ".claude", "projects"),
} = {}) {
  const wantCursor = harness !== "claude";
  const wantClaude = harness !== "cursor";
  const files = [];
  if (wantCursor) {
    for (const dir of await matchingProjectDirs(cursorHome, project)) {
      await collectJsonl(path.join(dir, "agent-transcripts"), 0, files);
    }
  }
  if (wantClaude) {
    for (const dir of await matchingProjectDirs(claudeHome, project)) {
      await collectJsonl(dir, 0, files);
    }
  }
  const agents = [];
  for (const file of files) {
    const harness = file.includes(`${path.sep}.cursor${path.sep}`) ? "cursor" : "claude";
    let info;
    try {
      info = await stat(file);
    } catch {
      continue;
    }
    const agent = agentFromFile(harness, file, info, now);
    if (agent) agents.push(agent);
  }
  agents.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const unique = [];
  const seen = new Set();
  for (const agent of agents) {
    if (seen.has(agent.id)) continue;
    seen.add(agent.id);
    unique.push(agent);
    if (unique.length >= 24) break;
  }
  if (!unique.length) {
    const who = harness === "cursor" ? "Cursor" : harness === "claude" ? "Claude Code" : "Cursor or Claude Code";
    throw new Error(`No ${who} sessions were found for this project. Start one here, or import a snapshot.`);
  }
  return {
    version: 1,
    agents: unique,
    interactions: [],
    project: path.basename(project),
    total: unique.length,
    observedAt: new Date(now).toISOString(),
  };
}
