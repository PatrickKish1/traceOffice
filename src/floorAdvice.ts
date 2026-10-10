import type { OfficeAgent } from "./types";

export interface FloorAdvice {
  title: string;
  detail: string;
  agentId: string | null;
  action: "open-trace" | "watch" | "quiet";
}

/** The floor agent decides who needs a person. It only reads session metadata. */
export function floorAdvice(agents: OfficeAgent[]): FloorAdvice {
  const seated = agents.filter((agent) => !agent.id.includes(":helper:"));
  const failed = seated.find((agent) => agent.status === "error" || agent.status === "blocked");
  if (failed) {
    return {
      title: "Open the failed session",
      detail: `${failed.name}${failed.project ? ` in ${failed.project}` : ""} needs a look. Open its Neatlogs trace, then run the recovery check.`,
      agentId: failed.id,
      action: "open-trace",
    };
  }
  const working = seated.find((agent) => agent.status === "working");
  if (working) {
    return {
      title: "Someone is at a desk",
      detail: `${working.name}${working.project ? ` in ${working.project}` : ""} is working. The trace for that session is in Neatlogs under trace-office.`,
      agentId: working.id,
      action: "watch",
    };
  }
  const first = seated[0];
  if (!first) {
    return {
      title: "The floor is empty",
      detail: "Start a session in Cursor or Claude Code in this project. The office seats it and Neatlogs records it.",
      agentId: null,
      action: "quiet",
    };
  }
  return {
    title: "The floor is quiet",
    detail: "Sessions are seated. A file touched in the last five minutes puts that agent back at a desk.",
    agentId: first.id,
    action: "quiet",
  };
}
