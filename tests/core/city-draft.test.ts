import test from "node:test";
import assert from "node:assert/strict";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";
import { newOverworld } from "../../src/features/atlas/overworld";
import {
  TerrainSource,
  TerrainStroke,
} from "../../src/features/atlas/terrain-source";
import {
  CitySource,
  cityDocumentChange,
} from "../../src/features/city/commands";
import { newCityDocument } from "../../src/features/city/codec";
import { CityDraft } from "../../src/features/city/draft";
import { editCity, type CityEdit } from "../../src/features/city/edit";
import { CityGesture } from "../../src/features/city/gestures";

function setup() {
  const history = new AtlasHistory();
  const source = new CitySource(
    {
      ...newCityDocument("city", "Dorf"),
      roadNodes: [
        { id: "a", point: { x: 0, y: 0 } },
        { id: "b", point: { x: 20, y: 0 } },
      ],
      roads: [
        {
          id: "road",
          startNodeId: "a",
          endNodeId: "b",
          via: [],
          widthMeters: 4,
        },
      ],
      buildings: [
        {
          id: "house",
          name: "Haus",
          footprint: {
            outer: [
              { x: 0, y: 0 },
              { x: 5, y: 0 },
              { x: 5, y: 8 },
              { x: 0, y: 8 },
            ],
            holes: [],
          },
          position: { x: 0, y: 10 },
          rotationRadians: 0,
          scale: { x: 1, y: 1 },
        },
      ],
    },
    history,
  );
  return { history, source, draft: new CityDraft(source) };
}
const move = (x: number): CityEdit => ({
  kind: "set-building-pose",
  buildingId: "house",
  position: { x, y: 10 },
  rotationRadians: 0.4,
  scale: { x: 2, y: 0.5 },
});
const road: CityEdit = {
  kind: "move-node",
  nodeId: "a",
  point: { x: -10, y: 3 },
};

function closed(draft: CityDraft, state: typeof draft.state) {
  assert.throws(() => draft.setEdits([move(1)]));
  assert.throws(() => draft.clearPreview());
  assert.throws(() => draft.apply("again"));
  assert.equal(draft.state, state);
  assert.equal(draft.preview, null);
}

test("City drafts preview from a fixed baseline without mutation or pointer drift", () => {
  const { history, source, draft } = setup();
  let calls = 0;
  history.subscribe(() => calls++);
  assert.equal(draft.state, "editing");
  assert.equal(draft.preview, null);
  const first = draft.setEdits([road, move(30)]);
  const edit = move(40);
  const last = draft.setEdits([edit]);
  assert.deepEqual(last.document.roadNodes, draft.before.roadNodes);
  assert.equal(last.document.buildings[0]!.position.x, 40);
  assert.equal(first.document.buildings[0]!.position.x, 30);
  assert.deepEqual(source.read(), draft.before);
  assert.equal(history.undoDepth, 0);
  assert.equal(calls, 0);
  assert(Object.isFrozen(last));
  assert(Object.isFrozen(last.document.buildings[0]!.position));
  assert(Object.isFrozen(last.scene));
  assert(!Object.isFrozen(edit));
  if (edit.kind === "set-building-pose")
    Object.assign(edit.position, { x: 999 });
  assert.equal(last.document.buildings[0]!.position.x, 40);
});

test("City Apply creates one exact street and house undo step and closes the draft", () => {
  const { history, source, draft } = setup();
  const before = source.read();
  const after = draft.setEdits([road, move(50)]).document;
  assert.equal(draft.apply(" Straße und Haus "), true);
  assert.equal(history.undoDepth, 1);
  assert.deepEqual(source.read(), after);
  closed(draft, "applied");
  assert.equal(draft.cancel(), false);
  history.undo();
  assert.deepEqual(source.read(), before);
  history.redo();
  assert.deepEqual(source.read(), after);
});

test("City Cancel and no-op Apply preserve redo without silently undoing a foreign edit", () => {
  const { history, source, draft } = setup();
  draft.setEdits([move(50)]);
  const before = source.read();
  const after = editCity(before, [move(20)]);
  history.execute({
    label: "foreign",
    changes: [cityDocumentChange(before, after)],
  });
  draft.cancel();
  closed(draft, "cancelled");
  assert.deepEqual(source.read(), after);
  assert.equal(history.undoDepth, 1);
  history.undo();
  const cancelled = new CityDraft(source);
  cancelled.setEdits([move(60)]);
  cancelled.cancel();
  assert(history.canRedo);
  assert.equal(history.undoDepth, 0);
  const noop = new CityDraft(source);
  noop.setEdits([]);
  assert.equal(noop.apply("unchanged"), false);
  closed(noop, "applied");
  assert(history.canRedo);
  history.redo();
  assert.deepEqual(source.read(), after);
});

test("Invalid and unfinished City previews cannot apply and a corrected contour can recover", () => {
  const { history, source, draft } = setup();
  assert.throws(() => draft.apply("unfinished"));
  draft.setEdits([move(10)]);
  draft.clearPreview();
  assert.throws(() => draft.apply("open contour"));
  draft.setEdits([move(20)]);
  assert.throws(() =>
    draft.setEdits([
      {
        kind: "set-building-footprint",
        buildingId: "house",
        footprint: {
          outer: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          holes: [],
        },
      },
    ]),
  );
  assert.equal(draft.state, "invalid");
  assert.equal(draft.preview, null);
  assert.throws(() => draft.apply("invalid"));
  assert.equal(history.undoDepth, 0);
  assert.deepEqual(source.read(), draft.before);
  draft.setEdits([move(30)]);
  assert.equal(draft.state, "editing");
  assert(draft.apply("corrected"));
});

test("City labels reject before history execution and keep the ready candidate", () => {
  const { history, draft } = setup();
  const preview = draft.setEdits([move(10)]);
  for (const label of ["", "   ", "x".repeat(201), null, 4]) {
    assert.throws(() => draft.apply(label as string));
    assert.equal(draft.state, "editing");
    assert.equal(draft.preview, preview);
    assert.equal(history.undoDepth, 0);
  }
  assert(draft.apply("valid"));
});

async function terrainSetup() {
  const result = setup();
  const terrain = new TerrainSource(
    newOverworld("world", "Welt", "pointy"),
    result.history,
    async () => {
      throw Error("no files");
    },
  );
  const address = { q: 0, r: 0 };
  await terrain.ensure([address]);
  const stroke = new TerrainStroke(terrain, "forest");
  stroke.add(address);
  return { ...result, terrain, address, stroke };
}

test("Real terrain commands share draft history; concurrent City edits fail without rollback or retry", async () => {
  const { history, source, draft, terrain, address, stroke } =
    await terrainSetup();
  draft.setEdits([move(10)]);
  assert(stroke.finish());
  assert(draft.apply("city"));
  assert.equal(history.undoDepth, 2);
  history.undo();
  assert.equal(terrain.read(address)?.terrain, "forest");
  history.undo();
  assert.equal(terrain.read(address), null);
  history.redo();
  history.redo();
  const stale = new CityDraft(source);
  stale.setEdits([road, move(40)]);
  const before = source.read();
  const after = editCity(before, [move(30)]);
  history.execute({
    label: "foreign city",
    changes: [cityDocumentChange(before, after)],
  });
  const depth = history.undoDepth;
  assert.throws(() => stale.apply("stale"), /kollidiert/);
  closed(stale, "failed");
  assert.equal(history.undoDepth, depth);
  assert.deepEqual(source.read(), after);
  assert.equal(terrain.read(address)?.terrain, "forest");
  assert(stale.cancel());
  assert.deepEqual(source.read(), after);
  closed(stale, "cancelled");
});

test("City draft rejects A-B-A after Undo without consuming Redo; a fresh draft works", () => {
  const { history, source, draft } = setup();
  draft.setEdits([road]);
  const before = source.read();
  history.execute({ label: "other city edit", changes: [cityDocumentChange(before, editCity(before, [move(20)]))] });
  assert(history.undo());
  assert.deepEqual(source.read(), before);
  const depth = history.undoDepth;
  assert(history.canRedo);
  assert.throws(() => draft.apply("late apply"), /kollidiert/);
  closed(draft, "failed");
  assert.equal(history.undoDepth, depth);
  assert(history.canRedo);
  assert.deepEqual(source.read(), before);
  assert(history.redo());
  const fresh = new CityDraft(source);
  fresh.setEdits([road]);
  assert(fresh.apply("fresh street"));
  assert.equal(source.read().roadNodes[0]!.point.x, -10);
});

test("City draft rejects an update after A-B-A, including recovery from an invalid preview", () => {
  for (const invalid of [false, true]) {
    const { history, source, draft } = setup();
    draft.setEdits([road]);
    if (invalid) assert.throws(() => draft.setEdits([{ kind: "remove-node", nodeId: "a" }]));
    const before = source.read();
    history.execute({ label: "other city edit", changes: [cityDocumentChange(before, editCity(before, [move(20)]))] });
    assert(history.undo());
    assert.throws(() => draft.setEdits([move(40)]), /kollidiert/);
    closed(draft, "failed");
    assert(history.canRedo);
    assert.deepEqual(source.read(), before);
  }
});

for (const action of ["apply", "update"] as const)
test(`Draft on an existing Undo state rejects ${action} after Redo-Undo restores the same reference`, () => {
    const { history, source } = setup();
    const before = source.read();
    history.execute({ label: "existing city edit", changes: [cityDocumentChange(before, editCity(before, [move(20)]))] });
    assert(history.undo());
    const identity = history.read(source.id, "document");
    const draft = new CityDraft(source);
    draft.setEdits([road]);
    assert(history.redo());
    const intermediateState = draft.state;
    assert(history.undo());
    assert.equal(history.read(source.id, "document"), identity);
    if (action === "apply") assert.throws(() => draft.apply("obsolete"));
    else assert.throws(() => draft.setEdits([move(40)]));
    closed(draft, "failed");
    assert.equal(intermediateState, "failed");
    assert(history.canRedo);
    assert.equal(history.undoDepth, 0);
    assert.deepEqual(source.read(), before);
});

for (const action of ["apply", "update"] as const)
test(`City draft rejects ${action} when an earlier observer synchronously undoes Redo`, () => {
  const { history, source, draft: initial } = setup();
  initial.cancel();
  const before = source.read();
  history.execute({ label: "rename", changes: [cityDocumentChange(before, { ...before, name: "B" })] });
  assert(history.undo());
  let armed = true;
  const removeEarlier = history.subscribe(() => {
    if (armed) { armed = false; assert(history.undo()); }
  });
  const events: string[] = [];
  const removeEvidence = history.subscribe((command) => {
    assert(Object.isFrozen(command));
    assert(Object.isFrozen(command.changes));
    assert(Object.isFrozen(command.changes[0]!.after));
    events.push(command.changes[0]!.ownerId);
  });
  const draft = new CityDraft(source);
  draft.setEdits([road]);
  assert(history.redo());
  assert.deepEqual(source.read(), before);
  assert.deepEqual(events, [source.id, source.id]);
  if (action === "apply") assert.throws(() => draft.apply("obsolete"));
  else assert.throws(() => draft.setEdits([move(40)]));
  closed(draft, "failed");
  assert(history.canRedo);
  assert.equal(history.undoDepth, 0);
  removeEvidence();
  removeEarlier();
});

test("City draft releases its observer on Apply, Cancel, conflict and failed gesture construction", () => {
  const { history, source, draft: initial } = setup();
  initial.cancel();
  const subscribe = history.subscribe.bind(history);
  let live = 0;
  history.subscribe = (listener) => {
    live++;
    const unsubscribe = subscribe(listener);
    let attached = true;
    return () => {
      if (attached) { attached = false; live--; }
      unsubscribe();
    };
  };
  const applied = new CityDraft(source);
  applied.setEdits([road]);
  assert.equal(live, 1);
  assert(applied.apply("apply"));
  assert.equal(live, 0);
  assert(history.undo());
  assert.equal(applied.state, "applied");
  const cancelled = new CityDraft(source);
  cancelled.cancel();
  assert.equal(live, 0);
  assert(history.redo());
  assert.equal(cancelled.state, "cancelled");
  const stale = new CityDraft(source);
  assert(history.undo());
  closed(stale, "failed");
  assert.equal(live, 0);
  assert.throws(() => new CityGesture(source, { kind: "move-building", ownerId: source.id, buildingId: "missing" }, { x: 0, y: 0 }));
  assert.equal(live, 0);
  const noop = new CityDraft(source);
  noop.setEdits([]);
  assert.equal(noop.apply("no-op"), false);
  assert.equal(live, 0);
  const rejected = new CityDraft(source);
  rejected.setEdits([road]);
  const removePreflight = history.addPreflight(() => { throw Error("blocked"); });
  assert.throws(() => rejected.apply("rejected"), /blocked/);
  removePreflight();
  closed(rejected, "failed");
  assert.equal(live, 0);
  assert(history.canRedo);
});

test("History observer exceptions are diagnosed separately after execute/undo/redo and never block later observers", () => {
  const history = new AtlasHistory();
  history.register("owner", () => {});
  history.hydrate("owner", [["value", 1]]);
  const error = Error("observer failure"),
    messages: unknown[][] = [];
  let calls = 0;
  history.subscribe(() => {
    throw error;
  });
  history.subscribe(() => calls++);
  const original = console.error;
  console.error = (...args: unknown[]) => {
    messages.push(args);
  };
  try {
    const changes = [
      { ownerId: "owner", target: "value", before: 1, after: 2 },
    ];
    assert(history.execute({ label: "edit", changes }));
    assert.equal(history.read("owner", "value"), 2);
    assert(history.undo());
    assert.equal(history.read("owner", "value"), 1);
    assert(history.canRedo);
    assert(history.redo());
    assert.equal(history.read("owner", "value"), 2);
    assert.equal(history.undoDepth, 1);
    assert.equal(calls, 3);
    assert.equal(messages.length, 3);
    for (const message of messages)
      assert.deepEqual(message, ["AtlasHistory subscriber failed", error]);
    assert.equal(
      history.execute({
        label: "noop",
        changes: [{ ...changes[0]!, before: 2, after: 2 }],
      }),
      false,
    );
    assert.throws(() => history.execute({ label: "stale", changes }));
    assert.equal(calls, 3);
    console.error = () => {
      throw Error("broken sink");
    };
    assert(history.undo());
    assert(history.redo());
    assert.equal(calls, 5);
  } finally {
    console.error = original;
  }
});

test("Real City Apply and Terrain finish close after a throwing observer without duplicate commits", async () => {
  const { history, draft, stroke, source, terrain, address } =
    await terrainSetup();
  history.subscribe(() => {
    throw Error("bad view");
  });
  let calls = 0;
  history.subscribe(() => calls++);
  const original = console.error;
  console.error = () => {
    throw Error("broken diagnostic");
  };
  try {
    assert(stroke.finish());
    assert.equal(stroke.finish(), false);
    draft.setEdits([move(50)]);
    assert(draft.apply("city"));
    closed(draft, "applied");
    assert.equal(history.undoDepth, 2);
    assert.equal(calls, 2);
    assert.equal(source.read().buildings[0]!.position.x, 50);
    assert.equal(terrain.read(address)?.terrain, "forest");
  } finally {
    console.error = original;
  }
});

test("A completed new street and house remain preview-only until one shared Apply", () => {
  const history = new AtlasHistory();
  const source = new CitySource(
    newCityDocument("new-city", "Neuer Ort"),
    history,
  );
  const before = source.read(),
    draft = new CityDraft(source);
  const edits: CityEdit[] = [
    {
      kind: "add-road",
      nodes: [
        { id: "west", point: { x: -10, y: 0 } },
        { id: "east", point: { x: 10, y: 0 } },
      ],
      road: {
        id: "street",
        startNodeId: "west",
        endNodeId: "east",
        via: [{ x: 0, y: 2 }],
        widthMeters: 4,
      },
    },
    {
      kind: "add-building",
      building: { ...setup().source.read().buildings[0]!, id: "new-house" },
    },
  ];
  const first = draft.setEdits(edits);
  draft.clearPreview();
  assert.throws(() => draft.apply("unfinished contour"));
  assert.deepEqual(source.read(), before);
  assert.equal(history.undoDepth, 0);
  const ready = draft.setEdits(edits);
  assert.deepEqual(ready, first);
  assert(draft.apply("Straße und Haus anlegen"));
  assert.equal(history.undoDepth, 1);
  assert.equal(source.read().roads[0]!.id, "street");
  assert.equal(source.read().buildings[0]!.id, "new-house");
  history.undo();
  assert.deepEqual(source.read(), before);
  history.redo();
  assert.deepEqual(source.read(), ready.document);
});

test("A codec-valid candidate with overflowing scene bounds clears the old ready preview", () => {
  const { history, source, draft } = setup();
  draft.setEdits([move(10)]);
  const edits: CityEdit[] = [
    { kind: "move-node", nodeId: "b", point: { x: 1e308, y: 0 } },
    {
      kind: "replace-road",
      roadId: "road",
      road: { ...draft.before.roads[0]!, widthMeters: 1.7e308 },
    },
  ];
  // This distinguishes a scene failure from an already rejected CityEdit payload.
  assert.doesNotThrow(() => editCity(draft.before, edits));
  assert.throws(() => draft.setEdits(edits));
  assert.equal(draft.state, "invalid");
  assert.equal(draft.preview, null);
  assert.throws(() => draft.apply("overflow"));
  assert.deepEqual(source.read(), draft.before);
  assert.equal(history.undoDepth, 0);
  draft.clearPreview();
  assert.equal(draft.state, "editing");
  draft.setEdits([move(20)]);
  assert(draft.apply("corrected"));
  assert.equal(source.read().buildings[0]!.position.x, 20);
});
