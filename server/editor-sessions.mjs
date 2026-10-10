import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { absorbTranscriptRecord, activityFromSummary, emptySummary, helperAgents, sessionIdentity } from "./editor-ops.mjs";

const ACTIVE_MS = 5 * 60 * 1000;

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

async function summarizeFile(file, size) {
  const summary = emptySummary();
  if (size > 8_000_000) return summary;
  const lines = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let count = 0;
  for await (const line of lines) {
    count += 1;
    if (count > 2500) break;
    try {
      absorbTranscriptRecord(summary, JSON.parse(line));
    } catch {
      /* Skip a broken line. */
    }
  }
  return summary;
}

function agentFromFile(harness, file, info, now, summary) {
  const identity = sessionIdentity(file, path.sep);
  if (!identity) return null;
  const updatedAt = new Date(info.mtimeMs).toISOString();
  const status = summary?.turn === "error" ? "error" : editorSessionStatus(info.mtimeMs, now);
  const activity = activityFromSummary(summary);
  const nested = Boolean(identity.parentId);
  return {
    id: `${harness}:${identity.id}`,
    name: nested ? (harness === "cursor" ? "Cursor helper" : "Claude helper") : (harness === "cursor" ? "Cursor agent" : "Claude Code"),
    harness,
    model: null,
    status,
    task: activity ?? (status === "working" ? "Session file is active" : "Session file is quiet"),
    contextUsed: null,
    contextWindow: null,
    updatedAt,
    activityLabel: activity,
    sourceUrl: `session://${harness}/${encodeURIComponent(identity.id)}`,
    history: [{ at: updatedAt, status, label: activity ?? (status === "working" ? "Session file updated" : "No recent file update") }],
    parentId: identity.parentId ? `${harness}:${identity.parentId}` : null,
    summary,
  };
}

/**
 * Cursor and Claude Code sessions for this project.
 * Tool names are counted. Prompt text is not kept.
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
  const found = [];
  for (const file of files) {
    const harnessName = file.includes(`${path.sep}.cursor${path.sep}`) ? "cursor" : "claude";
    let info;
    try {
      info = await stat(file);
    } catch {
      continue;
    }
    const summary = await summarizeFile(file, info.size);
    const agent = agentFromFile(harnessName, file, info, now, summary);
    if (agent) found.push(agent);
  }
  found.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const unique = [];
  const seen = new Set();
  for (const agent of found) {
    if (seen.has(agent.id)) continue;
    seen.add(agent.id);
    const { summary, parentId, ...publicAgent } = agent;
    unique.push(publicAgent);
    if (parentId) unique.at(-1).parentId = parentId;
    for (const helper of helperAgents(publicAgent, summary)) {
      if (seen.has(helper.id)) continue;
      seen.add(helper.id);
      unique.push({ ...helper, parentId: publicAgent.id });
    }
    if (unique.length >= 40) break;
  }
  const published = unique.slice(0, 40).map(({ parentId, ...agent }) => agent);
  const ids = new Set(published.map((agent) => agent.id));
  const interactions = unique
    .filter((agent) => agent.parentId && ids.has(agent.id) && ids.has(agent.parentId))
    .map((agent) => ({ fromId: agent.parentId, toId: agent.id, at: agent.updatedAt, kind: "delegation" }));
  if (!published.length) {
    const who = harness === "cursor" ? "Cursor" : harness === "claude" ? "Claude Code" : "Cursor or Claude Code";
    throw new Error(`No ${who} sessions were found for this project. Start one here, or import a snapshot.`);
  }
  return {
    version: 1,
    agents: published,
    interactions,
    project: path.basename(project),
    total: published.length,
    observedAt: new Date(now).toISOString(),
  };
}
