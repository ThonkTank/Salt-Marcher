import assert from "node:assert/strict";
import test from "node:test";
import {
  buildingEdgeMidpointGrip,
  buildingVertexGrip,
  planBuildingBackspacePoint,
  planBuildingEdgeDrag,
  previewBuildingEdgeDrag,
} from "../src/features/bau/building-point-gestures.ts";
import { nearestBoundary, portalPose } from "../src/geometry.ts";

const building = (points, id = "native-building") => ({
  id,
  kind: "building",
  floorId: "ground",
  polygons: [{ outer: points, holes: [] }],
  layer: 200,
  fill: 0xbfb09a,
  wall: 0x403e39,
  wallWidth: 0.2,
  wallAssetId: "qa-wall-01",
});
const changed = (result, id) => {
  assert.equal(result.status, "command");
  return result.command.entities.find((record) => record.id === id)?.after;
};

test("DD-013.02: Backspace on the hovered grip removes one point with floor and package-wall identity", () => {
  // F16 -> F21 of the direct native Bau-01 run, converted from 256 px/field.
  const before = building([
    { x: 7, y: 8 },
    { x: -2, y: 8 },
    { x: -2, y: 5 },
    { x: 7, y: 5 },
  ]);
  const grip = buildingVertexGrip(before, { x: 7.02, y: 5.01 }, 0.1);
  assert.ok(grip);
  assert.equal(grip.index, 3);
  const result = planBuildingBackspacePoint([before], before, grip);
  const after = changed(result, before.id);
  assert.equal(after.polygons[0].outer.length, 3);
  assert.deepEqual(after.polygons[0].outer, [
    { x: 7, y: 8 },
    { x: -2, y: 8 },
    { x: -2, y: 5 },
  ]);
  assert.equal(after.wallAssetId, "qa-wall-01");
  assert.equal(after.id, before.id);
  assert.deepEqual(result.command.entities[0].before, before);
  assert.equal(Object.hasOwn(result.command, "texts"), false);
  assert.equal(buildingVertexGrip(before, { x: 2, y: 6 }, 0.1), null);
});

test("DD-013.03: a three-point Building grip consumes Backspace without mutating it", () => {
  // F26 -> F28 kept this exact triangle and its package wall unchanged.
  const triangle = building([
    { x: 7, y: 8 },
    { x: -2, y: 8 },
    { x: -2, y: 5 },
  ]);
  const grip = buildingVertexGrip(triangle, { x: -2, y: 5 }, 0.1);
  assert.ok(grip);
  assert.deepEqual(planBuildingBackspacePoint([triangle], triangle, grip), {
    status: "minimum",
    command: null,
  });
  assert.deepEqual(triangle.polygons[0].outer, [
    { x: 7, y: 8 },
    { x: -2, y: 8 },
    { x: -2, y: 5 },
  ]);
  const stale = { ...grip, point: { x: -1, y: 5 } };
  assert.deepEqual(planBuildingBackspacePoint([triangle], triangle, stale), {
    status: "stale",
    command: null,
  });
});

test("DD-014.01: dragging the edge midpoint previews then inserts the fourth point", () => {
  const before = building([
    { x: 4, y: 5 },
    { x: 2, y: 2 },
    { x: 6, y: 2 },
  ]);
  const grip = buildingEdgeMidpointGrip(before, { x: 5, y: 3.5 }, 0.1);
  assert.ok(grip);
  assert.equal(grip.index, 2);
  assert.equal(buildingEdgeMidpointGrip(before, { x: 5, y: 3 }, 0.1), null);
  const preview = previewBuildingEdgeDrag(before, grip, { x: 6, y: 4 });
  assert.deepEqual(preview.polygons[0].outer, [
    { x: 4, y: 5 },
    { x: 2, y: 2 },
    { x: 6, y: 2 },
    { x: 6, y: 4 },
  ]);
  assert.equal(before.polygons[0].outer.length, 3);
  const result = planBuildingEdgeDrag([before], before, grip, { x: 6, y: 4 });
  assert.deepEqual(changed(result, before.id).polygons, preview.polygons);
  assert.equal(result.command.entities.length, 1);
});

test("DD-014.02: insertion follows a bound portal without moving its world position", () => {
  const before = building([
    { x: 4, y: 5 },
    { x: 2, y: 2 },
    { x: 6, y: 2 },
    { x: 6, y: 4 },
  ]);
  const anchor = nearestBoundary({ x: 6, y: 3 }, before);
  assert.equal(anchor.contour, 0);
  const door = {
    id: "native-portal",
    kind: "door",
    floorId: "ground",
    anchor: { boundaryId: before.id, contour: anchor.contour, at: anchor.at },
    width: 1,
    variant: "door",
  };
  const grip = buildingEdgeMidpointGrip(before, { x: 4, y: 2 }, 0.1);
  assert.ok(grip);
  assert.equal(grip.index, 1);
  const result = planBuildingEdgeDrag([before, door], before, grip, {
    x: 4,
    y: 1,
  });
  const after = changed(result, before.id);
  const followed = changed(result, door.id);
  assert.deepEqual(after.polygons[0].outer, [
    { x: 4, y: 5 },
    { x: 2, y: 2 },
    { x: 4, y: 1 },
    { x: 6, y: 2 },
    { x: 6, y: 4 },
  ]);
  const pose = portalPose(followed, (id) =>
    id === before.id ? after : undefined,
  );
  assert.ok(Math.abs(pose.x - 6) < 1e-9);
  assert.ok(Math.abs(pose.y - 3) < 1e-9);
  assert.ok(Math.abs(pose.angle - Math.PI / 2) < 1e-9);
  assert.equal(followed.anchor.boundaryId, before.id);
  assert.notEqual(followed.anchor.at, door.anchor.at);
  assert.equal(door.anchor.at, anchor.at);
});
