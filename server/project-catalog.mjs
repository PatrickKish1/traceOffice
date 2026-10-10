import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { projectDirMatches } from "./editor-sessions.mjs";

const SLUG = /^[A-Za-z0-9._-]{1,180}$/;

export function projectLabel(slug) {
  const parts = String(slug).replace(/^-+/, "").split("-").filter(Boolean);
  if (!parts.length) return "project";
  if (parts.length === 1) return parts[0];
  return parts.slice(-2).join("-");
}

export function projectPathForSlug(slug) {
  if (!SLUG.test(slug)) throw new Error("Unknown project.");
  return `${path.sep}${slug}`;
}

async function countTranscripts(dir) {
  let sessions = 0;
  let newest = 0;
  async function walk(current, depth) {
    if (depth > 3 || sessions > 40) return;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        sessions += 1;
        const info = await stat(full).catch(() => null);
        if (info && info.mtimeMs > newest) newest = info.mtimeMs;
      } else if (entry.isDirectory()) {
        await walk(full, depth + 1);
      }
    }
  }
  await walk(dir, 0);
  return { sessions, updatedAt: newest ? new Date(newest).toISOString() : null };
}

async function roots(home, child) {
  let entries;
  try {
    entries = await readdir(home, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || !SLUG.test(entry.name)) continue;
    const counted = await countTranscripts(child(path.join(home, entry.name)));
    if (!counted.sessions) continue;
    found.push({ id: entry.name, ...counted });
  }
  return found;
}

/** Local projects that already have a Cursor or Claude session file. */
export async function listSessionProjects({
  cwd = process.env.DOTS_SESSION_CWD ?? process.env.TRACE_SESSION_CWD ?? process.cwd(),
  cursorHome = path.join(homedir(), ".cursor", "projects"),
  claudeHome = path.join(homedir(), ".claude", "projects"),
} = {}) {
  const [cursor, claude] = await Promise.all([
    roots(cursorHome, (dir) => path.join(dir, "agent-transcripts")),
    roots(claudeHome, (dir) => dir),
  ]);
  const merged = new Map();
  for (const source of [
    ...cursor.map((item) => ({ ...item, platform: "cursor" })),
    ...claude.map((item) => ({ ...item, platform: "claude" })),
  ]) {
    const key = source.id.replace(/^-+/, "");
    const existing = merged.get(key);
    const current = projectDirMatches(source.id, cwd) || projectDirMatches(key, cwd);
    if (!existing) {
      merged.set(key, {
        id: source.id.replace(/^-+/, "") === key ? key : source.id,
        label: projectLabel(key),
        sessions: source.sessions,
        active: 0,
        updatedAt: source.updatedAt,
        platforms: [source.platform],
        current,
      });
      continue;
    }
    existing.sessions += source.sessions;
    existing.current = existing.current || current;
    if (!existing.platforms.includes(source.platform)) existing.platforms.push(source.platform);
    if (source.updatedAt && (!existing.updatedAt || source.updatedAt > existing.updatedAt)) existing.updatedAt = source.updatedAt;
  }
  return [...merged.values()]
    .sort((a, b) => Number(b.current) - Number(a.current) || String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 30);
}
