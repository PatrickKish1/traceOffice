import assert from "node:assert/strict";
import test from "node:test";
import { operationLogs, sessionsToReport } from "../server/neatlogs-report.mjs";

test("an existing session is reported once, including a quiet one", () => {
  const first = sessionsToReport(new Map(), [
    { id: "claude:abc", harness: "claude", status: "working", updatedAt: "2026-10-09T10:00:00.000Z", task: "Read ×2" },
    { id: "cursor:def", harness: "cursor", status: "idle", updatedAt: "2026-10-09T10:00:00.000Z", task: "Shell" },
    { id: "cursor:def:helper:explore", harness: "cursor", status: "idle", updatedAt: "2026-10-09T10:00:00.000Z", task: "Spawned by cursor" },
  ]);
  assert.deepEqual(first.report.map((item) => item.id), ["claude:abc", "cursor:def"]);
  assert.equal(first.report[1].activity, "Shell");
  const second = sessionsToReport(first.seen, [
    { id: "cursor:def", harness: "cursor", status: "idle", updatedAt: "2026-10-09T10:00:00.000Z", task: "Shell" },
  ]);
  assert.equal(second.report.length, 0);
});

test("span logs name the session and leave the prompt out", () => {
  const lines = operationLogs({
    harness: "claude",
    status: "error",
    project: "TraceOffice",
    activity: "Edit ×1",
    recovered: false,
  });
  assert.match(lines[0].message, /claude is error on TraceOffice/);
  assert.equal(lines[0].level, "error");
  assert.equal(lines[1].message, "Recorded activity: Edit ×1");
  const recovered = operationLogs({ harness: "claude", status: "idle", project: "TraceOffice", recovered: true });
  assert.equal(recovered.at(-1).message, "Status: recovered");
  assert.match(lines[0].message, /Prompt text was not stored/);
  assert.equal(JSON.stringify(lines).includes("/Users/"), false);
});
