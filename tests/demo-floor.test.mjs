import assert from "node:assert/strict";
import test from "node:test";
import { demoAgents, demoFloorCount } from "../src/demoFloor.ts";

test("the demo seats four floors in the browser and never attaches a trace", () => {
  assert.equal(demoFloorCount(0), 1);
  assert.equal(demoAgents(0)[0].name, "Mara");
  const mid = demoAgents(9000);
  assert.equal(mid.length, 4);
  assert.equal(demoFloorCount(9000), 4);
  assert.deepEqual(mid.map((agent) => agent.project).sort(), ["Atlas", "Ledger", "Relay", "TraceOffice"]);
  const failed = demoAgents(12000).find((agent) => agent.id === "demo:sol");
  assert.equal(failed.status, "error");
  assert.equal(failed.health.toolFailures, 1);
  const recovered = demoAgents(16000).find((agent) => agent.id === "demo:sol");
  assert.equal(recovered.status, "idle");
  const full = demoAgents(20000);
  assert.equal(full.length, 5);
  assert.equal(demoFloorCount(20000), 4);
  assert.equal(full.find((agent) => agent.id === "demo:ivo").project, "TraceOffice");
  for (const agent of full) {
    assert.equal(agent.traceUrl, undefined);
    assert.equal(JSON.stringify(agent).includes("neatlogs"), false);
  }
});
