import { test } from "node:test";
import assert from "node:assert/strict";
import type { Building, Point } from "../../src/model";
import { inside } from "../../src/geometry";
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

test("clipped floor cells retain the former footprint for concave and boundary rings", () => {
  const former = (outer: readonly Point[], x: number, y: number) => {
    if (inside({ x: x + 0.5, y: y + 0.5 }, outer)) return true;
    if (outer.some(p => p.x >= x && p.x <= x + 1 &&
        p.y >= y && p.y <= y + 1)) return true;
    for (const corner of [
      { x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y + 1 },
    ]) if (inside(corner, outer)) return true;
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i]!, b = outer[(i + 1) % outer.length]!,
        dx = b.x - a.x, dy = b.y - a.y;
      let low = 0, high = 1;
      for (const [p, q] of [
        [-dx, a.x - x], [dx, x + 1 - a.x],
        [-dy, a.y - y], [dy, y + 1 - a.y],
      ] as const) {
        if (p === 0 && q < 0) { low = 2; break; }
        if (p < 0) low = Math.max(low, q / p);
        if (p > 0) high = Math.min(high, q / p);
      }
      if (low <= high) return true;
    }
    return false;
  };
  const rings: Point[][] = [
    [{ x: 1, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 7 }, { x: 1, y: 7 }],
    [{ x: 1, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 2 },
      { x: 2, y: 2 }, { x: 2, y: 7 }, { x: 1, y: 7 }],
    [{ x: 0.2, y: 0.2 }, { x: 7.8, y: 7.1 },
      { x: 7.7, y: 7.8 }, { x: 0.1, y: 0.8 }],
    [{ x: 3.1, y: 3.1 }, { x: 3.7, y: 3.2 }, { x: 3.4, y: 3.8 }],
    [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 4, y: 4 }],
    Array.from({ length: 64 }, (_, i) => ({
      x: 4 + 3.2 * Math.cos(i * 2 * Math.PI / 64),
      y: 4 + 3.2 * Math.sin(i * 2 * Math.PI / 64),
    })),
  ];
  for (const [index, outer] of rings.entries())
    for (let y = -1; y < 9; y++)
      for (let x = -1; x < 9; x++)
        assert.equal(floorPolygonTouchesCell(outer, x, y), former(outer, x, y),
          `ring ${index}, cell ${x},${y}`);
});
