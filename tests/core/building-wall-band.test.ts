import { test } from "node:test";
import assert from "node:assert/strict";
import type { Building, Door } from "../../src/model";
import { wallSegments } from "../../src/geometry";
import { buildingWallBands } from "../../src/features/bau/building-wall-band";

const building: Building = {
  id: "qa-wall", kind: "building", floorId: "ground",
  polygons: [{ outer: [
    { x: 2, y: 2 }, { x: 4, y: 2 },
    { x: 4, y: 4 }, { x: 2, y: 4 },
  ], holes: [] }],
  layer: 200, fill: 0xffffff, wall: 0xffffff, wallWidth: 0.2,
};

test("QAWall01 keeps the measured outer, inner and bevel corner edges", () => {
  const segments = wallSegments(building, []),
    square = buildingWallBands(building, segments, 0.25, 256, 64),
    bevel = buildingWallBands(building, segments, 0.25, 256, 64, true);
  assert.equal(square.length, 1);
  assert.equal(bevel.length, 1);
  assert.equal(square[0]!.pathLength, 8);
  assert.deepEqual(square[0]!.positions.slice(0, 4),
    [2.125, 2.125, 1.875, 1.875]);
  assert.deepEqual(bevel[0]!.positions.slice(0, 6),
    [1.875, 2, 2.125, 2.125, 2, 1.875]);
  assert.equal(square[0]!.uvs[0], 0.5 / 256);
  assert.equal(bevel[0]!.uvs[0], 0.5 / 256);
});

test("a bound portal leaves an open seven-field texture band", () => {
  const portal: Door = {
    id: "portal", kind: "door", floorId: "ground", width: 1,
    variant: "door", anchor: { boundaryId: building.id, contour: 0, at: 0.125 },
  };
  const bands = buildingWallBands(building,
    wallSegments(building, [portal]), 0.25, 256, 64, true);
  assert.equal(bands.length, 1);
  assert.equal(bands[0]!.pathLength, 7);
  assert.equal(bands[0]!.closurePhase, null);
  const opposite: Door = {
    ...portal, id: "opposite", anchor: { ...portal.anchor!, at: 0.625 },
  };
  const separated = buildingWallBands(building,
    wallSegments(building, [portal, opposite]), 0.25, 256, 64, true);
  assert.equal(separated.length, 2);
  assert.equal(separated.reduce((sum, band) => sum + band.pathLength, 0), 6);
});

test("an inner ring keeps a separate finite wall band", () => {
  const withHole: Building = {
    ...building,
    polygons: [{ outer: [
      { x: 0, y: 0 }, { x: 5, y: 0 },
      { x: 5, y: 5 }, { x: 0, y: 5 },
    ], holes: [[
      { x: 1, y: 1 }, { x: 1, y: 3 },
      { x: 3, y: 3 }, { x: 3, y: 1 },
    ]] }],
  };
  const bands = buildingWallBands(withHole,
    wallSegments(withHole, []), 0.25, 256, 64, true);
  assert.equal(bands.length, 2);
  assert.deepEqual(bands.map((band) => band.pathLength), [20, 8]);
  assert(bands.every((band) =>
    [...band.positions, ...band.uvs].every(Number.isFinite)));
});
