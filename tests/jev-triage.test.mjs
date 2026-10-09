import { test } from "node:test";
import assert from "node:assert/strict";
import { jevTriageAgent, jevTriageShowcase, jevAtShowcaseDesk } from "../src/jev/triage.ts";

const agent = (overrides) => ({
  id: "a",
  name: "A",
  harness: "local",
  model: null,
  status: "working",
  task: null,
  contextUsed: null,
  contextWindow: null,
  updatedAt: new Date().toISOString(),
  ...overrides,
});

test("jev triage flags blocked and error sessions", () => {
  assert.equal(jevTriageAgent(agent({ status: "blocked" })).choice, "needs_human");
  assert.equal(jevTriageAgent(agent({ status: "error" })).choice, "failed");
});

test("jev triage marks stale working agents as stuck", () => {
  const old = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  assert.equal(jevTriageAgent(agent({ updatedAt: old })).choice, "stuck");
});

test("showcase hand-off reads preview labels", () => {
  const needs = jevTriageShowcase({
    phase: "task-two",
    timeInPhase: 1,
    progress: 0.1,
    status: "working",
    label: "Flagging what needs a person",
  });
  assert.equal(needs.choice, "needs_human");
});

test("jev at desk prefers a real agent over showcase state", () => {
  const verdict = jevAtShowcaseDesk(
    0,
    [agent({ id: "showcase-trace", status: "error" })],
    [],
    ["showcase-trace", "showcase-signal", "showcase-patch", "showcase-relay"],
  );
  assert.equal(verdict.choice, "failed");
});
