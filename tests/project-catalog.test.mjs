import assert from "node:assert/strict";
import test from "node:test";
import { applyDisplayName, projectLabel, projectPathForSlug } from "../server/project-catalog.mjs";

test("a project slug keeps the folder name people recognize", () => {
  assert.equal(projectLabel("Volumes-PATRICK-512-PROJECTS-OPEN-AI-OpenAI-hack"), "OpenAI-hack");
  assert.equal(projectLabel("-Volumes-PATRICK-512-PROJECTS-SIKADESK"), "PROJECTS-SIKADESK");
});

test("a local names file replaces the folder label", () => {
  assert.equal(applyDisplayName("OpenAI-hack", { "OpenAI-hack": "TraceOffice" }), "TraceOffice");
  assert.equal(applyDisplayName("OpenAI-hack-", { "OpenAI-hack": "TraceOffice" }), "TraceOffice");
  assert.equal(applyDisplayName("PROJECTS-SIKADESK", { "OpenAI-hack": "TraceOffice" }), "PROJECTS-SIKADESK");
});

test("a project id cannot escape the session home", () => {
  assert.equal(projectPathForSlug("OpenAI-hack"), "/OpenAI-hack");
  assert.throws(() => projectPathForSlug("../secrets"), /Unknown project/);
});
