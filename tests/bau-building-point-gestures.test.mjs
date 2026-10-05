import assert from "node:assert/strict";
import test from "node:test";
import {
  buildingEdgeMidpointGrip,
  buildingVertexGrip,
  planBuildingBackspacePoint,
  planBuildingEdgeDrag,
  planBuildingVertexDrag,
  previewBuildingEdgeDrag,
  previewBuildingVertexDrag,
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

test("DD-012.02/.03: held native ellipse point yields preview contour and unchanged wall style until commit", () => {
  // D03 -> D05 -> D06: native 32-point ellipse; point 23 moves 512 -> 256 px.
  const nativePixels = [
    1276,1031, 1396,1053, 1507,1088, 1604,1136, 1684,1194, 1743,1261,
    1779,1333, 1792,1408, 1779,1482, 1743,1554, 1684,1621, 1604,1679,
    1507,1727, 1396,1762, 1276,1784, 1152,1792, 1027,1784, 907,1762,
    796,1727, 699,1679, 619,1621, 560,1554, 524,1482, 512,1408,
    524,1333, 560,1261, 619,1194, 699,1136, 796,1088, 907,1053,
    1027,1031, 1152,1024,
  ];
  const points = Array.from({ length: nativePixels.length / 2 }, (_, index) => ({
    x: nativePixels[index * 2] / 256,
    y: nativePixels[index * 2 + 1] / 256,
  }));
  const before = building(points);
  const unchangedBefore = structuredClone(before);
  const grip = buildingVertexGrip(before, { x: 2, y: 5.5 }, 0.1);
  assert.ok(grip);
  assert.equal(grip.index, 23);
  const destination = { x: 1, y: 5.5 };
  const preview = previewBuildingVertexDrag(before, grip, destination);
  assert.ok(preview);
  assert.equal(preview.polygons[0].outer.length, 32);
  assert.deepEqual(preview.polygons[0].outer[23], destination);
  assert.equal(preview.wallAssetId, before.wallAssetId);
  assert.equal(preview.wallWidth, before.wallWidth);
  assert.deepEqual(before, unchangedBefore, "held preview must not edit document data");
  const result = planBuildingVertexDrag([before], before, grip, destination);
  assert.deepEqual(changed(result, before.id).polygons, preview.polygons);
  assert.deepEqual(result.command.entities[0].before, before);
  assert.equal(result.command.entities.length, 1);
  assert.deepEqual(before, unchangedBefore);
});

test("DD-012 point drag ignores unchanged, stale, and locked grips", () => {
  const before = building([
    { x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 2, y: 5 },
  ]);
  const grip = buildingVertexGrip(before, { x: 2, y: 2 }, 0.1);
  assert.ok(grip);
  assert.equal(planBuildingVertexDrag([before], before, grip, grip.point).status,
    "unchanged");
  const stale = { ...grip, point: { x: 99, y: 2 } };
  assert.equal(previewBuildingVertexDrag(before, stale, { x: 1, y: 2 }), null);
  assert.equal(planBuildingVertexDrag([before], before, stale, { x: 1, y: 2 }).status,
    "stale");
  assert.equal(previewBuildingVertexDrag({ ...before, locked: true }, grip,
    { x: 1, y: 2 }), null);
  assert.equal(planBuildingVertexDrag([before], { ...before, locked: true }, grip,
    { x: 1, y: 2 }).status, "locked");
});

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
