import assert from "node:assert/strict";
import test from "node:test";
import { floorAdvice } from "../src/floorAdvice.ts";

test("the floor agent points at the failed session first", () => {
  const advice = floorAdvice([
    { id: "cursor:1", name: "Cursor agent", harness: "cursor", project: "OpenAI-hack", model: null, status: "idle", task: null, contextUsed: null, contextWindow: null, updatedAt: "2026-10-10T12:00:00.000Z" },
    { id: "cursor:2", name: "Cursor agent", harness: "cursor", project: "OpenAI-hack", model: null, status: "error", task: "Shell failed", contextUsed: null, contextWindow: null, updatedAt: "2026-10-10T12:00:00.000Z" },
  ]);
  assert.equal(advice.action, "open-trace");
  assert.equal(advice.agentId, "cursor:2");
});
