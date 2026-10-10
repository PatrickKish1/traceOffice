import assert from "node:assert/strict";
import test from "node:test";
import { absorbTranscriptRecord, activityFromSummary, emptySummary, helperAgents, sessionIdentity } from "../server/editor-ops.mjs";

test("transcript summary keeps tool names and drops message text", () => {
  const summary = emptySummary();
  absorbTranscriptRecord(summary, { role: "user", message: { content: [{ type: "text", text: "SECRET PROMPT do not keep" }] } });
  absorbTranscriptRecord(summary, { role: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { path: "/tmp/SECRET" } }] } });
  absorbTranscriptRecord(summary, { role: "assistant", message: { content: [{ type: "tool_use", name: "Task", input: { subagent_type: "Explore", prompt: "SECRET TASK" } }] } });
  assert.equal(summary.toolUses, 2);
  assert.equal(summary.lastTool, "Task");
  assert.deepEqual(summary.helpers, ["Explore"]);
  assert.equal(JSON.stringify(summary).includes("SECRET"), false);
  assert.equal(activityFromSummary(summary), "Read · Task");
});

test("a nested session file points at its parent session", () => {
  const main = sessionIdentity("/agent-transcripts/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl");
  assert.equal(main.id, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  assert.equal(main.parentId, null);
  const child = sessionIdentity("/agent-transcripts/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/subagents/bbbbbbbb-cccc-dddd-eeee-ffffffffffff/bbbbbbbb-cccc-dddd-eeee-ffffffffffff.jsonl");
  assert.equal(child.parentId, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
});

test("a spawned subagent becomes a helper on the same platform", () => {
  const helpers = helperAgents({
    id: "cursor:parent",
    harness: "cursor",
    status: "working",
    updatedAt: "2026-10-09T10:00:00.000Z",
    sourceUrl: "session://cursor/parent",
  }, { helpers: ["Explore"] });
  assert.equal(helpers[0].id, "cursor:parent:helper:explore");
  assert.equal(helpers[0].harness, "cursor");
  assert.equal(helpers[0].name, "Helper · Explore");
});
