import test from "node:test";
import assert from "node:assert/strict";
import { campaignLocalId } from "../../src/features/campaign/campaign-contracts";
import {
  ManualPlanner,
  manualPlan,
} from "../../src/features/planner/manual-planner";
const id = (n: number) =>
  campaignLocalId(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
function setup() {
  let n = 0;
  return new ManualPlanner(
    () => id(++n),
    () => {},
  );
}
test("manual planner: unnamed undated plans and repeated same-location scenes retain exact prose through codec", () => {
  const p = setup();
  p.create();
  const a = p.addScene(p.binding());
  const notes = "  日本語\n\t[[Hafen]]\n";
  p.editDraft({ title: "", notes, locationId: id(900) });
  p.commitDraft();
  const b = p.addScene(p.binding());
  p.editDraft({ title: "Rückkehr", notes: "", locationId: id(900) });
  p.commitDraft();
  assert.notEqual(a.id, b.id);
  assert.equal(p.active!.name, "");
  const reopened = manualPlan(JSON.parse(JSON.stringify(p.active)));
  assert.equal(reopened.scenes[0]!.notes, notes);
  assert.equal(reopened.scenes[1]!.locationId, id(900));
  assert.deepEqual(reopened, p.active);
  assert(Object.isFrozen(reopened.scenes[0]));
});
test("manual planner: stale draft blocks switch and retains source and text; foreign-plan action never redirects", () => {
  const p = setup();
  const a = p.create();
  p.addScene(p.binding());
  const b = p.create();
  p.switchPlan(a.id);
  p.selectScene(p.active!.scenes[0]!.id);
  p.editDraft({ title: "Entwurf", notes: "behalten", locationId: null });
  const draft = p.draft;
  const binding = p.binding();
  p.act(binding, { kind: "rename", name: "neu" });
  assert.throws(() => p.switchPlan(b.id), /Plan geändert/);
  assert.equal(p.active!.id, a.id);
  assert.equal(p.draft, draft);
  p.discardDraft();
  p.switchPlan(b.id);
  const active = p.active;
  p.act(
    { id: a.id, revision: p.catalog.find((x) => x.id === a.id)!.revision },
    { kind: "rename", name: "A" },
  );
  assert.equal(p.active, active);
  assert.throws(
    () => p.act(binding, { kind: "rename", name: "late" }),
    /Plan geändert/,
  );
});
test("manual planner: successful switch commits old scene draft, not target; stale add and collisions write nothing", () => {
  const p = setup();
  const a = p.create();
  const scene = p.addScene(p.binding());
  const old = p.binding();
  p.editDraft({ title: "A", notes: "one", locationId: null });
  const b = p.create();
  assert.equal(p.catalog.find((x) => x.id === a.id)!.scenes[0]!.notes, "one");
  assert.equal(b.scenes.length, 0);
  assert.throws(() => p.addScene(old), /Plan geändert/);
  const before = p.catalog;
  assert.throws(
    () =>
      p.act(p.binding(), {
        kind: "add",
        scene: { id: scene.id, title: "", notes: "", locationId: null },
      }),
    /Kennung/,
  );
  assert.deepEqual(p.catalog, before);
});
test("manual planner: reorder and removal are revision guarded; deleting noncurrent preserves active draft", () => {
  const p = setup();
  const a = p.create();
  p.addScene(p.binding());
  const s = p.addScene(p.binding());
  p.act(p.binding(), { kind: "move", sceneId: s.id, direction: -1 });
  assert.equal(p.active!.scenes[0]!.id, s.id);
  const stale = p.binding();
  p.act(stale, { kind: "remove", sceneId: s.id });
  assert.throws(() => p.act(stale, { kind: "remove", sceneId: s.id }));
  const b = p.create();
  p.addScene(p.binding());
  p.editDraft({ title: "B", notes: "keep", locationId: null });
  const draft = p.draft;
  p.deletePlan({
    id: a.id,
    revision: p.catalog.find((x) => x.id === a.id)!.revision,
  });
  assert.equal(p.active!.id, b.id);
  assert.equal(p.draft, draft);
  p.deletePlan(p.binding());
  assert.equal(p.catalog.length, 1);
  assert.equal(p.active!.name, "");
  assert.equal(p.draft, null);
});
test("manual planner: invalid codec/accessor/context blocks before mutation; constructor identity collisions rejected", () => {
  let calls = 0;
  const raw = { version: 1, id: id(1), revision: 1, name: "", scenes: [] };
  Object.defineProperty(raw, "name", {
    enumerable: true,
    get() {
      calls++;
      return "oops";
    },
  });
  assert.throws(() => manualPlan(raw));
  assert.equal(calls, 0);
  assert.throws(() =>
    manualPlan({ ...raw, revision: Number.MAX_SAFE_INTEGER + 1 }),
  );
  let valid = true;
  let n = 0;
  const p = new ManualPlanner(
    () => id(++n),
    () => {
      if (!valid) throw new Error("Context stale");
    },
  );
  p.create();
  const before = p.catalog;
  valid = false;
  assert.throws(() => p.create(), /Context stale/);
  assert.throws(
    () => p.act(p.binding(), { kind: "rename", name: "x" }),
    /Context stale/,
  );
  assert.deepEqual(p.catalog, before);
});
