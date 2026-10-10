const ID = /^[a-zA-Z0-9_-]{8,80}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOOL_NAME = /^[A-Za-z][A-Za-z0-9_.:-]{0,40}$/;
const HELPER_TOOLS = new Set(["Task", "Agent", "Subagent"]);
const KIND = /^[A-Za-z][A-Za-z0-9_ .:-]{0,40}$/;

export function emptySummary() {
  return { tools: {}, lastTool: null, toolUses: 0, helpers: [], turn: null };
}

function helperKind(input) {
  if (!input || typeof input !== "object") return null;
  const raw = input.subagent_type ?? input.subagentType ?? input.agent_type;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!KIND.test(trimmed)) return null;
  return trimmed;
}

/** Keep tool names and subagent types. Message text and tool arguments are dropped. */
export function absorbTranscriptRecord(summary, record) {
  const content = record?.message?.content;
  const items = Array.isArray(content) ? content : [];
  for (const item of items) {
    if (!item || item.type !== "tool_use" || typeof item.name !== "string" || !TOOL_NAME.test(item.name)) continue;
    summary.tools[item.name] = (summary.tools[item.name] ?? 0) + 1;
    summary.lastTool = item.name;
    summary.toolUses += 1;
    if (HELPER_TOOLS.has(item.name)) {
      const kind = helperKind(item.input);
      if (kind && !summary.helpers.includes(kind)) summary.helpers.push(kind);
    }
  }
  if (record?.type === "turn_ended" && (record.status === "success" || record.status === "error")) {
    summary.turn = record.status;
  }
}

export function activityFromSummary(summary) {
  const top = Object.entries(summary?.tools ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!top.length) return null;
  const label = top.map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(" · ");
  return label.length > 160 ? `${label.slice(0, 157)}…` : label;
}

/** Session UUID from the file name, plus a parent UUID when the file is nested under another session. */
export function sessionIdentity(file, sep = "/") {
  const base = file.split(sep).pop() ?? "";
  const stem = base.endsWith(".jsonl") ? base.slice(0, -6) : base;
  const folders = file.split(sep).slice(0, -1).filter((part) => UUID.test(part));
  const id = ID.test(stem) ? stem : folders.at(-1) ?? null;
  if (!id) return null;
  const parentId = [...folders].reverse().find((part) => part !== id) ?? null;
  return { id, parentId };
}

export function helperAgents(parent, summary) {
  return summary.helpers.slice(0, 4).map((kind) => {
    const slug = kind.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "helper";
    return {
      id: `${parent.id}:helper:${slug}`,
      name: `Helper · ${kind}`,
      harness: parent.harness,
      model: null,
      status: parent.status,
      task: `Spawned by ${parent.harness}`,
      contextUsed: null,
      contextWindow: null,
      updatedAt: parent.updatedAt,
      sourceUrl: parent.sourceUrl,
      history: [{ at: parent.updatedAt, status: parent.status, label: `Helper ${kind}` }],
    };
  });
}
