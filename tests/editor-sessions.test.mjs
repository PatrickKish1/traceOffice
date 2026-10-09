import assert from "node:assert/strict";
import test from "node:test";
import { editorSessionStatus, projectDirMatches } from "../server/editor-sessions.mjs";

test("a Cursor project folder still matches when the repo name has a trailing hyphen", () => {
  const project = "/Volumes/PATRICK-512/PROJECTS/OPEN_AI/OpenAI-hack-";
  assert.equal(projectDirMatches("Volumes-PATRICK-512-PROJECTS-OPEN-AI-OpenAI-hack", project), true);
});

test("a session file touched in the last five minutes is working", () => {
  const now = 1_000_000;
  assert.equal(editorSessionStatus(now - 30_000, now), "working");
  assert.equal(editorSessionStatus(now - 6 * 60_000, now), "idle");
});
