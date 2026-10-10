import assert from "node:assert/strict";
import test from "node:test";
import { sessionsToReport } from "../server/neatlogs-report.mjs";

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
