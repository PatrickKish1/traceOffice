import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { readGrokSessions } from "../server/grok-sessions.mjs";

test("grok session metadata becomes agents without reading conversation files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "trace-office-"));
  const project = "/work/demo";
  const group = path.join(root, "sessions", encodeURIComponent(project));
  const session = path.join(group, "11111111-1111-4111-8111-111111111111");
  await mkdir(session, { recursive: true });
  await writeFile(path.join(group, ".cwd"), project);
  await writeFile(path.join(session, "summary.json"), JSON.stringify({
    title: "Fix the room lights",
    model: "grok-build",
    updated_at: "2026-10-07T12:00:00.000Z",
  }));
  await writeFile(path.join(session, "signals.json"), JSON.stringify({
    context_used: 1200,
    context_window: 8000,
  }));
  await writeFile(path.join(session, "chat_history.jsonl"), "SECRET PROMPT\n");
  const snapshot = await readGrokSessions({
    grokHome: root,
    project,
    now: Date.parse("2026-10-07T12:01:00.000Z"),
  });
  assert.equal(snapshot.agents.length, 1);
  assert.equal(snapshot.agents[0].harness, "grok");
  assert.equal(snapshot.agents[0].name, "Fix the room lights");
  assert.equal(snapshot.agents[0].status, "working");
  assert.equal(snapshot.agents[0].contextUsed, 1200);
  assert.equal(JSON.stringify(snapshot).includes("SECRET"), false);
  assert.equal(JSON.stringify(snapshot).includes("/work/demo"), false);
});
