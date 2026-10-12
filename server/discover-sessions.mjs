import path from "node:path";
import { readEditorSessions } from "./editor-sessions.mjs";
import { readGrokSessions } from "./grok-sessions.mjs";
import { applyDisplayName, listSessionProjects, projectLabel, projectPathForSlug } from "./project-catalog.mjs";

const SLUG = /^[A-Za-z0-9._-]{1,180}$/;
let catalogCache = { at: 0, cwd: "", projects: [] };

async function take(id, label, read) {
  try {
    const snap = await read();
    const agents = Array.isArray(snap.agents) ? snap.agents : [];
    return {
      platform: {
        id,
        label,
        enabled: agents.length > 0,
        sessions: agents.length,
        active: agents.filter((agent) => agent.status === "working").length,
      },
      agents,
      interactions: snap.interactions ?? [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unavailable";
    return {
      platform: { id, label, enabled: false, sessions: 0, active: 0, reason: message },
      agents: [],
      interactions: [],
    };
  }
}

async function discoverOne(project, now) {
  const { readRobotsSessions } = await import("./codex-sessions.mjs");
  return Promise.all([
    take("cursor", "Cursor", () => readEditorSessions({ project, now, harness: "cursor" })),
    take("claude", "Claude", () => readEditorSessions({ project, now, harness: "claude" })),
    take("codex", "Codex", () => readRobotsSessions({ project, now })),
    take("grok", "Grok", () => readGrokSessions({ project, now })),
  ]);
}

function scopeAgent(agent, project, multiple) {
  const id = multiple ? `${project.id}::${agent.id}` : agent.id;
  return { ...agent, id, project: project.label, projectId: project.id };
}

/** The four newest primary sessions. Helpers stay off the floor so one busy repo cannot fill it. */
export function seatRecent(agents, limit = 4) {
  return [...agents]
    .filter((agent) => !String(agent.id).includes(":helper:"))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, limit);
}

function scopeLink(link, project, multiple) {
  if (!multiple) return link;
  return { ...link, fromId: `${project.id}::${link.fromId}`, toId: `${project.id}::${link.toId}` };
}

/** Find sessions for the chosen projects. Other local projects stay in the catalog until connected. */
export async function discoverSessions(options = {}) {
  const cwd = options.project ?? process.env.DOTS_SESSION_CWD ?? process.env.TRACE_SESSION_CWD ?? process.cwd();
  const now = options.now ?? Date.now();
  const requested = [...new Set((options.projects ?? []).filter((id) => SLUG.test(id)))].slice(0, 4);
  if (catalogCache.cwd !== cwd || now - catalogCache.at > 20_000) {
    catalogCache = { at: now, cwd, projects: await listSessionProjects({ cwd, ...options }) };
  }
  const catalog = catalogCache.projects;
  const chosen = requested.length
    ? requested.map((id) => catalog.find((item) => item.id === id) ?? {
        id,
        label: applyDisplayName(projectLabel(id), undefined, id),
        current: false,
        sessions: 0,
        platforms: [],
      })
    : catalog.filter((item) => item.current).slice(0, 1);
  const loads = chosen.length
    ? chosen
    : [{ id: "cwd", label: applyDisplayName(path.basename(cwd)), current: true, sessions: 0, platforms: [] }];
  const multiple = loads.length > 1;
  const agents = [];
  const interactions = [];
  const platforms = [];
  for (const project of loads) {
    const folder = project.current ? cwd : projectPathForSlug(project.id);
    const parts = await discoverOne(folder, now);
    const pooled = [];
    for (const part of parts) {
      const existing = platforms.find((item) => item.id === part.platform.id);
      if (!existing) platforms.push({ ...part.platform });
      else if (part.platform.enabled) {
        existing.enabled = true;
        existing.sessions += part.platform.sessions;
        existing.active += part.platform.active;
      }
      pooled.push(...part.agents);
      interactions.push(...part.interactions.map((link) => scopeLink(link, project, multiple)));
    }
    for (const agent of seatRecent(pooled)) {
      const scoped = scopeAgent(agent, project, multiple);
      if (agents.some((item) => item.id === scoped.id)) continue;
      agents.push(scoped);
    }
  }
  const ids = new Set(agents.map((agent) => agent.id));
  const connected = new Set(loads.map((project) => project.id));
  return {
    version: 1,
    agents,
    interactions: interactions.filter((link) => ids.has(link.fromId) && ids.has(link.toId)).slice(0, 100),
    platforms,
    projects: catalog.map((project) => ({ ...project, connected: connected.has(project.id) })),
    project: loads.map((project) => project.label).join(" · ") || applyDisplayName(path.basename(cwd)),
    total: Math.max(agents.length, loads.reduce((sum, project) => sum + (Number(project.sessions) || 0), 0)),
    observedAt: new Date(now).toISOString(),
  };
}
