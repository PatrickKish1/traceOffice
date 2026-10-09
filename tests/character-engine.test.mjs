import assert from "node:assert/strict";
import test from "node:test";
import {
  CHARACTER_PACK,
  packKindForAgent,
  packKindForShowcase,
  packMascotKind,
  recipeFromSeed,
  resolveMascotKind,
} from "../src/components/office/characters/characterEngine.ts";

test("the same agent id always rebuilds the same character", () => {
  const first = recipeFromSeed("session-a");
  const second = recipeFromSeed("session-a");
  assert.deepEqual(first, second);
});

test("different agent ids can produce different characters", () => {
  const looks = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => recipeFromSeed(id).kind));
  assert.ok(looks.size > 1);
});

test("saved mascot kind overrides the seed hash", () => {
  assert.equal(resolveMascotKind("any-id", "frog-dot"), "frog-dot");
});

test("each character pack assigns a unique look per crew role", () => {
  for (const cast of ["person", "field", "signal"]) {
    const kinds = new Set(["trace", "signal", "patch", "relay", "jev"].map((role) => packMascotKind(cast, role)));
    assert.equal(kinds.size, 5, `${cast} pack should have five distinct silhouettes`);
  }
});

test("switching pack changes every named preview role", () => {
  const tracePerson = packKindForShowcase("person", "showcase-trace");
  const traceField = packKindForShowcase("field", "showcase-trace");
  const patchPerson = packKindForShowcase("person", "showcase-patch");
  const patchField = packKindForShowcase("field", "showcase-patch");
  assert.notEqual(tracePerson, traceField);
  assert.notEqual(patchPerson, patchField);
  assert.equal(tracePerson, CHARACTER_PACK.person.trace);
  assert.equal(packMascotKind("signal", "jev"), CHARACTER_PACK.signal.jev);
});

test("imported agents draw from the active pack", () => {
  const kind = packKindForAgent("field", "agent-99");
  const allowed = new Set(["trace", "signal", "patch", "relay"].map((role) => CHARACTER_PACK.field[role]));
  assert.ok(allowed.has(kind));
  assert.notEqual(packKindForAgent("field", "agent-99"), packKindForAgent("signal", "agent-99"));
});
