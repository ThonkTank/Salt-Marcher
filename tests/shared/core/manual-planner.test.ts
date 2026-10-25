import test from "node:test";
import assert from "node:assert/strict";
import { campaignLocalId } from "../../../src/features/campaign/campaign-contracts";
import { manualPlan } from "../../../src/features/planner/manual-planner";
const id = (n: number) =>
  campaignLocalId(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);

test("manual plan codec preserves unnamed plans, distinct visits at the same location and exact prose", () => {
  const notes = "  日本語\r\n\t[[Hafen]]\n";
  const raw = {version: 1, id: id(1), revision: 7, name: "", scenes: [
    {id: id(2), title: "", notes, locationId: id(900)},
    {id: id(3), title: "Rückkehr", notes: "", locationId: id(900)},
  ]};
  const reopened = manualPlan(JSON.parse(JSON.stringify(raw)));
  assert.deepEqual(reopened, raw);
  assert.equal(reopened.scenes[0]!.notes, notes);
  assert(Object.isFrozen(reopened));
  assert(Object.isFrozen(reopened.scenes));
  assert(Object.isFrozen(reopened.scenes[0]));
});

test("manual plan codec rejects accessors, invalid revisions and duplicate visit identities", () => {
  let calls = 0;
  const raw = { version: 1, id: id(1), revision: 1, name: "", scenes: [] };
  const getter = Object.defineProperty({...raw}, "name", {enumerable: true, get() {calls++; return "must not read";}});
  assert.throws(() => manualPlan(getter));
  assert.equal(calls, 0);
  for (const revision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN])
    assert.throws(() => manualPlan({...raw, revision}));
  const visit = {id: id(2), title: "", notes: "", locationId: null};
  assert.throws(() => manualPlan({...raw, scenes: [visit, {...visit}]}), /Doppelte Szene/);
});

test("manual planner codec rejects holes, extra keys, symbols and getters before hydration", () => {
  let calls = 0;
  const getter: unknown[] = [];
  Object.defineProperty(getter, "0", {
    get() {
      calls++;
      throw new Error("must not invoke");
    },
  });
  for (const scenes of [
    Array(1),
    Object.assign([], { meta: "x" }),
    Object.assign([], { [Symbol("meta")]: "x" }),
    getter,
  ]) {
    assert.throws(
      () =>
        manualPlan({ version: 1, id: id(1), revision: 1, name: "", scenes }),
      /Ungültige.*Szenen/,
    );
  }
  assert.equal(calls, 0);
});
