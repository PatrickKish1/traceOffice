import type { AgentStatus, OfficeAgent } from "./types";
import { stackFloors } from "./officeBehavior.ts";

interface DemoBeat {
  at: number;
  id: string;
  name?: string;
  project?: string;
  harness?: string;
  status: AgentStatus;
  task: string;
}

/** Local office only. These beats never leave the browser. */
const BEATS: DemoBeat[] = [
  { at: 0, id: "demo:mara", name: "Mara", project: "TraceOffice", harness: "cursor", status: "working", task: "Reading the session list" },
  { at: 2800, id: "demo:sol", name: "Sol", project: "Ledger", harness: "claude", status: "working", task: "Editing a shared file" },
  { at: 5600, id: "demo:kit", name: "Kit", project: "Relay", harness: "codex", status: "working", task: "Checking the room relay" },
  { at: 8400, id: "demo:ren", name: "Ren", project: "Atlas", harness: "grok", status: "working", task: "Watching a second repo" },
  { at: 11200, id: "demo:sol", status: "error", task: "Edit failed: the file was not in the project" },
  { at: 15000, id: "demo:sol", status: "idle", task: "Recovered and left the desk" },
  { at: 16800, id: "demo:ivo", name: "Ivo", project: "TraceOffice", harness: "cursor", status: "working", task: "Counting tool calls" },
];

export function demoAgents(elapsedMs: number, now = new Date().toISOString()): OfficeAgent[] {
  const byId = new Map<string, OfficeAgent>();
  const order: string[] = [];
  for (const beat of BEATS) {
    if (elapsedMs < beat.at) continue;
    const previous = byId.get(beat.id);
    if (!previous) order.push(beat.id);
    byId.set(beat.id, {
      id: beat.id,
      name: beat.name ?? previous?.name ?? beat.id,
      harness: beat.harness ?? previous?.harness ?? "office",
      project: beat.project ?? previous?.project,
      model: null,
      status: beat.status,
      task: beat.task,
      contextUsed: null,
      contextWindow: null,
      updatedAt: now,
      activityLabel: beat.status === "working" ? beat.task : null,
      health: beat.status === "error"
        ? { state: "error", retrying: false, toolFailures: 1, retries: 0, recoveredRetries: 0 }
        : undefined,
    });
  }
  return order.map((id) => byId.get(id)!);
}

export function demoFloorCount(elapsedMs: number) {
  return stackFloors(demoAgents(elapsedMs)).length;
}
