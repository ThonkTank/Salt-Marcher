import { test } from "node:test";
import assert from "node:assert/strict";
import { withoutPrefabDefinition } from "../src/features/objekte/prefab-forget.ts";

test("forget removes only the definition; placed object and light remain", () => {
  const object = { id: "object-1", kind: "object", floorId: "floor-1",
    x: 8, y: 8, rotation: 0, width: 1, height: 1, color: 0xffffff,
    label: "Globe" };
  const light = { id: "light-1", kind: "light", floorId: "floor-1",
    x: 9, y: 8, radius: 5, intensity: 1, color: 0xffeccd8b,
    shadows: true };
  const target = { id: "prefab-target", set: "QA", name: "Globe and light",
    center: { x: 4, y: 4 }, entities: [object, light] };
  const other = { id: "prefab-other", set: "QA", name: "Other",
    center: { x: 5, y: 5 }, entities: [object] };
  const catalog = [target, other];
  const mapEntities = [
    { ...object, prefabId: target.id },
    { ...light, prefabId: target.id },
  ];
  const mapBefore = structuredClone(mapEntities);

  const remaining = withoutPrefabDefinition(catalog, target.id);

  assert.deepEqual(remaining, [other]);
  assert.deepEqual(catalog, [target, other], "the saved source list is unchanged");
  assert.deepEqual(mapEntities, mapBefore, "placed pair remains on the map");
  assert.deepEqual(mapEntities.map((entity) => entity.prefabId),
    [target.id, target.id], "existing binding values are not cleared");
});
