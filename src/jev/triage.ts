import type { OfficeAgent } from "../types";
import type { ShowcaseState } from "../showcase";

/** Typed hand-off verdict (System One Choice shape, no hosted model). */
export type JevRoute = "ok" | "watch" | "stuck" | "failed" | "needs_human";

export interface JevChoice {
  choice: JevRoute;
  /** 0–1: how peaked the rule match is (deterministic, not a model logit). */
  confidence: number;
  subtitle: string;
}

const STUCK_MS = 5 * 60 * 1000;
const ROUTE_SUBTITLE: Record<JevRoute, string> = {
  ok: "Desk looks fine",
  watch: "Keeping an eye on this run",
  stuck: "No movement — nudge the agent",
  failed: "Run failed or disconnected",
  needs_human: "Needs a person at this desk",
};

function ageMs(updatedAt: string | undefined, now: number) {
  if (!updatedAt) return Number.POSITIVE_INFINITY;
  const at = Date.parse(updatedAt);
  return Number.isFinite(at) ? now - at : Number.POSITIVE_INFINITY;
}

/** Local triage on structured session fields (replaces paid Jev for the office floor). */
export function jevTriageAgent(agent: OfficeAgent, now = Date.now()): JevChoice {
  const stale = ageMs(agent.updatedAt, now);
  if (agent.status === "blocked") {
    return { choice: "needs_human", confidence: 0.95, subtitle: ROUTE_SUBTITLE.needs_human };
  }
  if (agent.status === "error") {
    return { choice: "failed", confidence: 0.92, subtitle: ROUTE_SUBTITLE.failed };
  }
  if (agent.status === "offline" || agent.disconnectedAt) {
    return { choice: "failed", confidence: 0.88, subtitle: ROUTE_SUBTITLE.failed };
  }
  if (agent.health?.state === "error") {
    return { choice: "failed", confidence: 0.9, subtitle: ROUTE_SUBTITLE.failed };
  }
  if (agent.health?.retrying) {
    return { choice: "watch", confidence: 0.85, subtitle: "Retrying after a tool failure" };
  }
  if (agent.health?.state === "watch" || agent.status === "unknown") {
    return { choice: "watch", confidence: 0.8, subtitle: ROUTE_SUBTITLE.watch };
  }
  if (agent.status === "working" && stale > STUCK_MS) {
    return { choice: "stuck", confidence: 0.82, subtitle: ROUTE_SUBTITLE.stuck };
  }
  if (agent.status === "idle") {
    return { choice: "ok", confidence: 0.75, subtitle: "Run finished — sofa duty" };
  }
  return { choice: "ok", confidence: 0.7, subtitle: ROUTE_SUBTITLE.ok };
}

export function jevTriageShowcase(state: ShowcaseState): JevChoice {
  const label = state.label.toLowerCase();
  if (label.includes("person") || label.includes("flagging")) {
    return { choice: "needs_human", confidence: 0.78, subtitle: ROUTE_SUBTITLE.needs_human };
  }
  if (state.phase === "task-one" && label.includes("failing")) {
    return { choice: "watch", confidence: 0.72, subtitle: ROUTE_SUBTITLE.watch };
  }
  if (state.status === "working") {
    return { choice: "ok", confidence: 0.68, subtitle: "Handing the next task" };
  }
  return { choice: "ok", confidence: 0.6, subtitle: "Walking the row" };
}

export function jevAtShowcaseDesk(
  deskIndex: number,
  agents: OfficeAgent[],
  showcaseStates: ShowcaseState[],
  showcaseIds: string[],
  now = Date.now(),
): JevChoice {
  const id = showcaseIds[deskIndex];
  const agent = id ? agents.find((row) => row.id === id) : undefined;
  if (agent) return jevTriageAgent(agent, now);
  const state = showcaseStates[deskIndex];
  if (state) return jevTriageShowcase(state);
  return { choice: "ok", confidence: 0.5, subtitle: ROUTE_SUBTITLE.ok };
}
