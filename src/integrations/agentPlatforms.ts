import type { LocalSource } from "./codex/useRobotsSessions";

export type PlatformId = "claude" | "codex" | "cursor" | "chatgpt" | "grok";
export type ConnectMode = "cloud" | "local";

/** Neatlogs already hosts the approve-and-connect step for these coding agents. */
export const NEATLOGS_CODING_AGENTS = "https://app.neatlogs.com/settings/account/coding-agents";

export interface AgentPlatform {
  id: PlatformId;
  name: string;
  logo: string;
  local: { source: LocalSource; harness?: "cursor" | "claude"; detail: string } | null;
  cloud: { href: string; detail: string } | null;
}

export const AGENT_PLATFORMS: AgentPlatform[] = [
  {
    id: "claude",
    name: "Claude Code",
    logo: "/logos/claude.webp",
    local: { source: "editors", harness: "claude", detail: "Reads Claude session file times for this project. The chat is not opened." },
    cloud: { href: NEATLOGS_CODING_AGENTS, detail: "Approve Claude Code on the Neatlogs coding-agents screen. TraceOffice does not run that login." },
  },
  {
    id: "codex",
    name: "Codex",
    logo: "/logos/codex.webp",
    local: { source: "index", detail: "Reads the local session index already on this computer." },
    cloud: { href: NEATLOGS_CODING_AGENTS, detail: "Approve Codex on the Neatlogs coding-agents screen. TraceOffice does not run that login." },
  },
  {
    id: "cursor",
    name: "Cursor",
    logo: "/logos/cursor.webp",
    local: { source: "editors", harness: "cursor", detail: "Reads Cursor agent file times for this project. The chat is not opened." },
    cloud: { href: NEATLOGS_CODING_AGENTS, detail: "A Neatlogs Cursor connection does not seat agents here. Local sessions do." },
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    logo: "/logos/openai.webp",
    local: null,
    cloud: null,
  },
  {
    id: "grok",
    name: "Grok",
    logo: "/logos/grok.webp",
    local: { source: "grok", detail: "Reads ~/.grok session summary and signals for this project. The conversation file is not opened." },
    cloud: null,
  },
];

export function agentPlatform(id: PlatformId) {
  return AGENT_PLATFORMS.find((platform) => platform.id === id)!;
}
