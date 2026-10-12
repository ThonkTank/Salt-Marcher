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
  const revision = p.binding().revision;
  const b = p.addScene(p.binding());
  assert.equal(p.binding().revision, revision + 2);
  assert.equal(p.draft, null);
  assert.equal(p.selectedSceneId, b.id);
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

for (const failure of ["collision", "allocator", "revision"] as const) {
  test(`manual planner: failed compound add (${failure}) preserves exact draft, payload and selection`, () => {
    let n = 0;
    let fail = false;
    const existing = {
      version: 1,
      id: id(1),
      revision: failure === "revision" ? Number.MAX_SAFE_INTEGER - 1 : 1,
      name: "",
      scenes: [
        { id: id(2), title: "old", notes: "confirmed", locationId: null },
      ],
    } as const;
    const p = new ManualPlanner(
      () => {
        if (fail && failure === "allocator")
          throw new Error("allocator failed");
        if (fail && failure === "collision") return id(2);
        return id(10 + ++n);
      },
      () => {},
      [existing],
    );
    p.selectScene(id(2));
    p.editDraft({ title: "new", notes: "must stay draft", locationId: null });
    fail = true;
    const catalog = p.catalog;
    const active = p.active;
    const draft = p.draft;
    const selection = p.selectedSceneId;
    assert.throws(() => p.addScene(p.binding()));
    assert.deepEqual(p.catalog, catalog);
    assert.equal(p.active, active);
    assert.equal(p.draft, draft);
    assert.equal(p.selectedSceneId, selection);
  });
}

for (const failure of ["target", "context"] as const) {
  test(`manual planner: compound action ${failure} failure preserves draft and permits retry`, () => {
    let rejectFinal = false;
    let calls = 0;
    const p = new ManualPlanner(
      () => id(9),
      () => {
        if (rejectFinal && ++calls === 3) throw new Error("Context stale");
      },
      [
        {
          version: 1,
          id: id(1),
          revision: 1,
          name: "",
          scenes: [
            { id: id(2), title: "first", notes: "", locationId: null },
            {
              id: id(3),
              title: "second",
              notes: "confirmed",
              locationId: null,
            },
          ],
        },
      ],
    );
    p.selectScene(id(3));
    p.editDraft({
      title: "edited",
      notes: " exact\n日本語 ",
      locationId: null,
    });
    const before = p.active;
    const draft = p.draft;
    rejectFinal = failure === "context";
    assert.throws(() =>
      p.actWithDraft(p.binding(), {
        kind: "move",
        sceneId: failure === "target" ? id(8) : id(3),
        direction: -1,
      }),
    );
    assert.equal(p.active, before);
    assert.equal(p.draft, draft);
    assert.equal(p.selectedSceneId, id(3));
    rejectFinal = false;
    const moved = p.actWithDraft(p.binding(), {
      kind: "move",
      sceneId: id(3),
      direction: -1,
    });
    assert.equal(moved.revision, 3);
    assert.equal(moved.scenes[0]!.id, id(3));
    assert.equal(moved.scenes[0]!.notes, " exact\n日本語 ");
    assert.equal(p.draft, null);
    p.editDraft({ title: "renamed", notes: "next", locationId: null });
    const renamed = p.actWithDraft(p.binding(), {
      kind: "rename",
      name: "plan",
    });
    assert.equal(renamed.revision, 5);
    assert.equal(renamed.name, "plan");
    assert.equal(renamed.scenes[0]!.title, "renamed");
    assert.equal(p.draft, null);
  });
}

for (const action of ['create', 'delete'] as const) {
  test(`manual planner: ${action} rejects context revoked during allocation without publishing`, () => {
    let revoked = false;
    let revokeAllocation = false;
    let n = 10;
    const p = new ManualPlanner(() => {
      if (revokeAllocation) revoked = true;
      return id(++n);
    }, () => { if (revoked) throw new Error('Context revoked'); }, [
      {version: 1, id: id(1), revision: 1, name: 'Original', scenes: [
        {id: id(2), title: 'Scene', notes: '  日本語\n', locationId: null},
      ]},
    ]);
    if (action === 'delete') {
      p.selectScene(id(2));
      p.editDraft({title: 'Pending', notes: ' exact\n\ttext ', locationId: null});
    }
    const before = p.active, draft = p.draft, selection = p.selectedSceneId, catalog = p.catalog;
    revokeAllocation = true;
    assert.throws(() => action === 'create' ? p.create() : p.deletePlan(p.binding()), /Context revoked/);
    assert.deepEqual(p.catalog, catalog);
    assert.equal(p.active, before);
    assert.equal(p.draft, draft);
    assert.equal(p.selectedSceneId, selection);
    revoked = false; revokeAllocation = false;
    if (action === 'create') {
      p.create();
      assert.equal(p.catalog.length, 2);
      assert.equal(p.catalog.find(x => x.id === before!.id), before);
    } else {
      p.deletePlan(p.binding());
      assert.equal(p.catalog.length, 1);
      assert.notEqual(p.active!.id, before!.id);
      assert.equal(p.draft, null);
    }
  });
}

for (const action of ['create', 'delete'] as const) {
  test(`manual planner: ${action} cannot overwrite a newer workspace returned by allocation`, () => {
    let reenter = false;
    let n = 10;
    const p = new ManualPlanner(() => {
      if (reenter) p.act(p.binding(), {kind: 'rename', name: 'External confirmed'});
      return id(++n);
    }, () => {}, [{version: 1, id: id(1), revision: 1, name: 'Original', scenes: []}]);
    reenter = true;
    assert.throws(() => action === 'create' ? p.create() : p.deletePlan(p.binding()), /Plan geändert/);
    assert.equal(p.catalog.length, 1);
    assert.equal(p.active!.id, id(1));
    assert.equal(p.active!.name, 'External confirmed');
    assert.equal(p.active!.revision, 2);
  });
}
