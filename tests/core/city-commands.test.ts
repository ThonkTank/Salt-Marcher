import test from "node:test";
import assert from "node:assert/strict";
import {
  AtlasHistory,
  type AtlasChange,
} from "../../src/features/atlas/atlas-history";
import { newOverworld } from "../../src/features/atlas/overworld";
import {
  TerrainSource,
  TerrainStroke,
} from "../../src/features/atlas/terrain-source";
import {
  CitySource,
  cityDocumentChange,
} from "../../src/features/city/commands";
import {
  newCityDocument,
  serializeCityDocument,
} from "../../src/features/city/codec";
import type { CityDocument } from "../../src/features/city/model";

function city(id = "city-a"): CityDocument {
  return {
    ...newCityDocument(id, "Stadt"),
    roadNodes: [
      { id: "a", point: { x: -10, y: 0 } },
      { id: "b", point: { x: 20, y: 0 } },
    ],
    roads: [
      { id: "road", startNodeId: "a", endNodeId: "b", via: [], widthMeters: 4 },
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
        position: { x: -20, y: 10 },
        rotationRadians: 0.3,
        scale: { x: 1, y: 2 },
      },
    ],
  };
}
const moved = (before: CityDocument): CityDocument => ({
  ...before,
  roads: before.roads.map((r) => ({ ...r, widthMeters: 6 })),
  buildings: before.buildings.map((b) => ({
    ...b,
    position: { x: 100, y: -50 },
    rotationRadians: 0.7,
  })),
});
const bytes = (source: CitySource) => serializeCityDocument(source.read());

test("City source hydrates once, owns immutable reads and rejects invalid registration without reserving an ID", () => {
  const history = new AtlasHistory(),
    initial = city();
  assert.throws(() => new CitySource({ ...initial, name: "" }, history));
  const source = new CitySource(initial, history);
  assert.equal(history.undoDepth, 0);
  assert(!history.canRedo);
  assert(!Object.isFrozen(initial));
  const read = source.read();
  assert(Object.isFrozen(read.buildings[0]!.footprint.outer[0]));
  assert.notEqual(read, initial);
  assert.deepEqual(read, initial);
  assert.throws(() => new CitySource(moved(initial), history), /registriert/);
  assert.equal(bytes(source), serializeCityDocument(initial));
  assert(!("undo" in source));
  assert(!("redo" in source));
});

test("City changes preserve complete geometry through shared undo/redo and never mutate the caller", () => {
  const history = new AtlasHistory(),
    initial = city(),
    source = new CitySource(initial, history),
    after = moved(initial);
  const change = cityDocumentChange(initial, after),
    expected = serializeCityDocument(after);
  assert.equal(bytes(source), serializeCityDocument(initial));
  assert.equal(history.undoDepth, 0);
  assert(Object.isFrozen(change));
  assert(Object.isFrozen(change.after));
  Object.assign(after.buildings[0]!.position, { x: 999 });
  assert(!Object.isFrozen(after));
  history.execute({ label: "Straße und Haus ändern", changes: [change] });
  assert.equal(bytes(source), expected);
  assert.equal(history.undoDepth, 1);
  assert(history.undo());
  assert.equal(bytes(source), serializeCityDocument(initial));
  assert(history.redo());
  assert.equal(bytes(source), expected);
});

test("City change input validation precedes JSON conversion and owner validation rejects foreign targets and identities", () => {
  const initial = city(),
    history = new AtlasHistory(),
    source = new CitySource(initial, history);
  const extra = { ...initial, future: 3 };
  const roads = Object.assign([...initial.roads], { future: "do not lose" });
  let getterCalls = 0;
  const getter = { ...initial };
  Object.defineProperty(getter, "name", {
    get() {
      getterCalls++;
      return "hidden";
    },
  });
  for (const bad of [extra, { ...initial, roads }, getter]) {
    assert.throws(() => cityDocumentChange(bad, initial));
    assert.throws(() => cityDocumentChange(initial, bad));
    assert.throws(() => new CitySource(bad, new AtlasHistory()));
  }
  assert.equal(getterCalls, 0);
  assert.throws(
    () => cityDocumentChange(initial, city("other")),
    /Stadtkennung/,
  );
  const valid = cityDocumentChange(initial, moved(initial));
  for (const bad of [
    { ...valid, target: "buildings", before: null },
    { ...valid, after: null },
    { ...valid, after: JSON.parse(serializeCityDocument(city("other"))) },
  ])
    assert.throws(() => history.execute({ label: "invalid", changes: [bad] }));
  assert.equal(bytes(source), serializeCityDocument(initial));
  assert.equal(history.undoDepth, 0);
});

async function shared() {
  const history = new AtlasHistory(),
    world = newOverworld("world-a", "Welt", "pointy"),
    terrain = new TerrainSource(world, history, async () => {
      throw new Error("Empty world needs no file");
    }),
    source = new CitySource(city(), history),
    address = { q: -1, r: 0 };
  await terrain.ensure([address]);
  const stroke = new TerrainStroke(terrain, "forest");
  stroke.add(address);
  return {
    history,
    world,
    terrain,
    source,
    address,
    terrainChange: stroke.preview()[0]!,
  };
}

test("Real city and terrain owners share one atomic command and exact undo/redo", async () => {
  const { history, terrain, source, address, terrainChange } = await shared();
  const before = source.read(),
    after = moved(before),
    cityChange = cityDocumentChange(before, after);
  history.execute({
    label: "Ort und Landschaft",
    changes: [terrainChange, cityChange],
  });
  assert.equal(history.undoDepth, 1);
  assert.equal(terrain.read(address)?.terrain, "forest");
  assert.equal(bytes(source), serializeCityDocument(after));
  history.undo();
  assert.equal(terrain.read(address), null);
  assert.equal(bytes(source), serializeCityDocument(before));
  history.redo();
  assert.equal(terrain.read(address)?.terrain, "forest");
  assert.equal(bytes(source), serializeCityDocument(after));
});

test("Multi-owner city conflicts and format failures preserve both owners, history stacks and notifications", async () => {
  const { history, terrain, source, address, terrainChange } = await shared();
  const before = source.read(),
    after = moved(before),
    valid = cityDocumentChange(before, after);
  history.execute({ label: "city", changes: [valid] });
  history.undo(); // Keep an actual redo command through every rejected mixed command.
  let notifications = 0;
  history.subscribe(() => notifications++);
  const invalidAfter = JSON.parse(serializeCityDocument(after));
  invalidAfter.roads[0].widthMeters = 0;
  const failures: AtlasChange[][] = [
    [terrainChange, cityDocumentChange(after, before)],
    [terrainChange, { ...valid, after: invalidAfter }],
    [valid, { ...terrainChange, before: terrainChange.after }],
  ];
  for (const changes of failures) {
    assert.throws(() => history.execute({ label: "conflict", changes }));
    assert.equal(terrain.read(address), null);
    assert.equal(bytes(source), serializeCityDocument(before));
    assert.equal(history.undoDepth, 0);
    assert(history.canRedo);
    assert.equal(notifications, 0);
  }
  history.redo();
  assert.equal(bytes(source), serializeCityDocument(after));
  assert.equal(terrain.read(address), null);
  assert.equal(notifications, 1);
});

test("City no-op preserves redo, stale gestures fail, and separate city owners remain independent", async () => {
  const { history, source, world } = await shared();
  const other = new CitySource(city("city-b"), history),
    before = source.read(),
    after = moved(before),
    otherBefore = bytes(other);
  const gesture = cityDocumentChange(before, after);
  history.execute({ label: "edit", changes: [gesture] });
  assert.throws(
    () => history.execute({ label: "stale gesture", changes: [gesture] }),
    /kollidiert/,
  );
  assert.throws(
    () =>
      history.execute({
        label: "stale no-op",
        changes: [cityDocumentChange(before, before)],
      }),
    /kollidiert/,
  );
  assert.equal(bytes(other), otherBefore);
  history.undo();
  assert.equal(
    history.execute({
      label: "no-op",
      changes: [cityDocumentChange(before, before)],
    }),
    false,
  );
  assert(history.canRedo);
  history.redo();
  assert.equal(bytes(source), serializeCityDocument(after));
  assert.equal(bytes(other), otherBefore);
  assert.throws(() => new CitySource(city(world.id), history), /registriert/);
});
