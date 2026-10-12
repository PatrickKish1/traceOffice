import assert from "node:assert/strict";
import test from "node:test";
import { seatRecent } from "../server/discover-sessions.mjs";

test("a crowded project seats the four newest sessions and leaves helpers off", () => {
  const agents = [1, 2, 3, 4, 5, 6].map((day) => ({
    id: `cursor:${day}`,
    updatedAt: new Date(Date.UTC(2026, 9, day)).toISOString(),
  }));
  agents.push({ id: "cursor:9:helper:explore", updatedAt: "2026-10-20T00:00:00.000Z" });
  assert.deepEqual(seatRecent(agents).map((agent) => agent.id), ["cursor:6", "cursor:5", "cursor:4", "cursor:3"]);
});
