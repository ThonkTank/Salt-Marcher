import { test } from "node:test";
import assert from "node:assert/strict";
import type { Building } from "../../src/model";
import { nativeDesignId, isNativeCustomColorFloorAssetId } from
  "../../src/features/material/native-path-catalog";
import { floorPolygonTouchesCell, nativeFloorCells, nativeFloorVariants } from
  "../../src/features/material/native-floor-tiles";

const wood = nativeDesignId("tileset",
  "res://textures/tilesets/smart/tileset_wood_vertical.png");
const stone = nativeDesignId("tileset",
  "res://textures/tilesets/smart_double/tileset_stone.png");

test("only the four PCK custom_color designs use the mask shader", () => {
  const custom = ["diamond", "diamond_2", "ornate", "wood_damaged"];
  for (const name of custom)
    assert.equal(isNativeCustomColorFloorAssetId(nativeDesignId("tileset",
      `res://textures/tilesets/simple/tileset_${name}.png`)), true);
  for (const name of ["carpet", "brick_worn", "herringbone"])
    assert.equal(isNativeCustomColorFloorAssetId(nativeDesignId("tileset",
      `res://textures/tilesets/simple/tileset_${name}.png`)), false);
  assert.equal(isNativeCustomColorFloorAssetId(wood), false);
});

test("native saved all-wood map reproduces 64 measured atlas cells", () => {
  const actual = nativeFloorVariants(Array(64).fill(wood), 8, 8);
  assert.deepEqual([...actual], [
    9, 9, 6, 9, 2, 7, 14, 12,
    11, 12, 13, 6, 14, 7, 3, 9,
    3, 1, 7, 13, 13, 5, 13, 2,
    3, 9, 12, 6, 0, 1, 1, 8,
    8, 14, 11, 8, 5, 5, 9, 2,
    0, 12, 3, 2, 12, 9, 10, 1,
    6, 14, 5, 9, 14, 0, 3, 2,
    8, 12, 14, 1, 3, 5, 6, 9,
  ]);
});

test("saved adjacent wood and stone reproduce all measured atlas cells", () => {
  const cells: (string | null)[] = Array(64).fill(null);
  for (let y = 1; y <= 3; y++)
    for (let x = 1; x <= 6; x++)
      cells[y * 8 + x] = x <= 3 ? wood : stone;
  const actual = nativeFloorVariants(cells, 8, 8);
  assert.deepEqual([1, 2, 3].map((y) =>
    [...actual.slice(y * 8 + 1, y * 8 + 7)]), [
    [4, 1, 4, 29, 15, 18],
    [3, 1, 11, 10, 25, 14],
    [14, 2, 12, 7, 21, 0],
  ]);
  assert.equal(actual[0], 255);
});

test("native floor cells follow Building geometry and hole masks", () => {
  const building: Building = {
    id: "wood", kind: "building", floorId: "ground",
    polygons: [{ outer: [
      { x: 1, y: 1 }, { x: 4, y: 1 },
      { x: 4, y: 4 }, { x: 1, y: 4 },
    ], holes: [[
      { x: 2, y: 2 }, { x: 3, y: 2 },
      { x: 3, y: 3 }, { x: 2, y: 3 },
    ]] }], layer: 200, fill: 0xffffff, wall: 0xffffff, wallWidth: 0,
    material: { assetId: wood, tileSize: 4, tint: 0xffffff, rotation: 0 },
  };
  const cells = nativeFloorCells([building], "ground", 5, 5);
  assert.equal(cells.filter(Boolean).length, 8);
  assert.equal(cells[2 * 5 + 2], null);
  assert.equal(cells[1 * 5 + 1], wood);
  const preview = nativeFloorCells([], "ground", 5, 5, building);
  assert.deepEqual(preview, cells);
});

test("diagonal edge receives a clipped texture tile without filling its distant bounding box", () => {
  const right = [
    { x: 4, y: 4 }, { x: 6, y: 4 },
    { x: 7, y: 7 }, { x: 4, y: 7 },
  ];
  assert.equal(floorPolygonTouchesCell(right, 6, 5), true);
  assert.equal(floorPolygonTouchesCell(right, 7, 5), false);
  assert.equal(floorPolygonTouchesCell(right, 2, 5), false);
});
