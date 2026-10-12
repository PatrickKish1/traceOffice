import assert from "node:assert/strict";
import test from "node:test";
import { entireCommitUrl } from "../src/entireLink.ts";
import { ENTIRE_CHECKPOINTS, ENTIRE_REPO } from "../src/entireCheckpoints.ts";

test("an Entire commit link uses the full SHA and rejects a short one", () => {
  const sha = "34318789208ef384f85ea584035cc35003aab141";
  assert.equal(
    entireCommitUrl("PatrickKish1", "traceOffice", sha),
    `https://entire.io/gh/PatrickKish1/traceOffice/commit/${sha}`,
  );
  assert.equal(entireCommitUrl("PatrickKish1", "traceOffice", "3431878"), null);
  assert.equal(entireCommitUrl("PatrickKish1", "traceOffice", sha.toUpperCase()), null);
  assert.equal(entireCommitUrl("../etc", "traceOffice", sha), null);
});

test("every shipped checkpoint can open on Entire", () => {
  assert.ok(ENTIRE_CHECKPOINTS.length >= 1);
  for (const checkpoint of ENTIRE_CHECKPOINTS) {
    const url = entireCommitUrl(ENTIRE_REPO.owner, ENTIRE_REPO.name, checkpoint.sha);
    assert.equal(url?.endsWith(`/commit/${checkpoint.sha}`), true);
    assert.equal(checkpoint.id.length, 26);
  }
});
