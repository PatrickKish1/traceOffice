import assert from "node:assert/strict";
import test from "node:test";
import { neatlogsTraceUrl, rememberTrace, traceFor } from "../server/trace-links.mjs";

test("a trace id becomes a Neatlogs trace link", () => {
  assert.equal(neatlogsTraceUrl("tr_abc123"), "https://app.neatlogs.com/traces/tr_abc123");
  assert.equal(neatlogsTraceUrl("../etc"), null);
  const saved = rememberTrace("cursor:1", "tr_abc123", "recovered");
  assert.equal(saved.url, traceFor("cursor:1", "recovered").url);
});
