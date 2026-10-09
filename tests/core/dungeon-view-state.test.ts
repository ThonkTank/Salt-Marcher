import assert from "node:assert/strict";
import test from "node:test";
import {
  DUNGEON_VIEW_STATE_SCHEMA_VERSION,
  DungeonViewStateRegistry,
  dungeonViewState,
  parseDungeonViewState,
} from "../../src/features/verwaltung/dungeon-view-state";

const PATH = "Karten/Nebelwacht.dungeon";

test("Dungeon-View-State accepts only the exact bounded path contract", () => {
  const valid = {
    schemaVersion: DUNGEON_VIEW_STATE_SCHEMA_VERSION,
    path: PATH,
    activeFloorId: "floor-secret",
  };
  assert.deepEqual(parseDungeonViewState(valid, PATH), valid);
  assert.ok(Object.isFrozen(parseDungeonViewState(valid)));
  assert.equal(parseDungeonViewState(valid, "Karten/Fremd.dungeon"), undefined);
  assert.equal(parseDungeonViewState({ ...valid, extra: true }), undefined);
  assert.equal(parseDungeonViewState({ ...valid, schemaVersion: 2 }), undefined);
  assert.equal(parseDungeonViewState({ ...valid, path: "" }), undefined);
  assert.equal(parseDungeonViewState({ ...valid, activeFloorId: "   " }), undefined);
  assert.equal(parseDungeonViewState({ ...valid, path: "x".repeat(1025) }), undefined);
  assert.equal(
    parseDungeonViewState({ ...valid, activeFloorId: "x".repeat(257) }),
    undefined,
  );
  assert.equal(parseDungeonViewState(null), undefined);
  assert.equal(parseDungeonViewState([]), undefined);
});

test("Dungeon-View-State registry publishes monotone immutable latest state", () => {
  const registry = new DungeonViewStateRegistry();
  const leafA = {};
  const leafB = {};
  const floorA = dungeonViewState(PATH, "floor-a");
  const floorB = dungeonViewState(PATH, "floor-b");
  assert.ok(floorA && floorB);
  const first = registry.publish(leafA, floorA);
  const second = registry.publish(leafB, floorB);
  assert.ok(first && second);
  assert.ok(second.revision > first.revision);
  assert.equal(registry.latest(PATH), second);
  assert.equal(second.leafToken, leafB);
  assert.equal(second.state.activeFloorId, "floor-b");
  assert.ok(Object.isFrozen(second));
  assert.equal(registry.publish(leafA, { ...floorA, extra: true }), undefined);
  assert.equal(registry.latest(PATH), second);

  // Closing stale leaf A performs no publish. A subsequently opened leaf gets B.
  assert.equal(registry.latest(PATH)?.state.activeFloorId, "floor-b");
});

test("Dungeon-View-State registry follows rename, delete and plugin unload", () => {
  const registry = new DungeonViewStateRegistry();
  const token = {};
  const state = dungeonViewState(PATH, "floor-secret");
  assert.ok(state);
  const published = registry.publish(token, state);
  assert.ok(published);

  const renamedPath = "Karten/Nebelwacht Neu.dungeon";
  const renamed = registry.rename(PATH, renamedPath);
  assert.ok(renamed);
  assert.ok(renamed.revision > published.revision);
  assert.equal(registry.latest(PATH), undefined);
  assert.equal(registry.latest(renamedPath), renamed);
  assert.equal(renamed.state.path, renamedPath);
  assert.equal(renamed.state.activeFloorId, "floor-secret");
  assert.equal(renamed.leafToken, token);

  registry.delete(renamedPath);
  assert.equal(registry.latest(renamedPath), undefined);
  registry.publish(token, state);
  registry.clear();
  assert.equal(registry.latest(PATH), undefined);
});
