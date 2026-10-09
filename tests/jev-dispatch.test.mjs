import { test } from "node:test";
import assert from "node:assert/strict";
import { jevHandoffDeskIndex, jevHandoffPosition, JEV_HOME } from "../src/jev/dispatch.ts";

test("jev home is off the showcase row", () => {
  assert.ok(JEV_HOME.z < 7);
});

test("hand-off spot tracks agent desk index", () => {
  const a = jevHandoffPosition(jevHandoffDeskIndex(0));
  const b = jevHandoffPosition(jevHandoffDeskIndex(1));
  assert.notDeepEqual(a, b);
});
