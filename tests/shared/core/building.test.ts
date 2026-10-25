import assert from "node:assert/strict";
import { test } from "node:test";
import { composeBuilding } from "../../../src/compute";
import { buildingPolygonPoints, rectangle } from "../../../src/geometry";
import {
  parseDocument,
  type Building,
  type Surface,
  type Wall,
} from "../../../src/model";
import { newDocument } from "./fixtures";

test("consecutive Shift input and crossing cleanup match native Building contours", () => {
  const consecutive = [
      { x: 1, y: 1 },
      { x: 6, y: 1 },
      { x: 6, y: 4 },
      { x: 4, y: 6 },
      { x: 1, y: 6 },
    ],
    firstCurve = { index: 2, handle: { x: 5, y: 3 } },
    secondCurve = { index: 3, handle: { x: 3, y: 5 } },
    p18 = buildingPolygonPoints(consecutive, [firstCurve, secondCurve], true);
  assert.deepEqual(p18, buildingPolygonPoints(consecutive, [firstCurve], true));
  assert.equal(p18.length, 20);
  const draw = (outer: ReturnType<typeof buildingPolygonPoints>) =>
    composeBuilding({
      kind: "compose-building",
      sources: [],
      shape: [{ outer, holes: [] }],
      nativeBuilding: true,
      erase: false,
    });
  const split = draw(p18);
  assert.equal(split.mode, "draw");
  if (split.mode !== "draw") return;
  assert.deepEqual(
    split.polygons.map((p) => p.outer.length),
    [14, 8],
  );
  assert.ok(Math.abs(split.polygons[0]!.outer[0]!.x * 256 - 1510) <= 1);
  assert.ok(Math.abs(split.polygons[1]!.outer[0]!.y * 256 - 1048) <= 1);

  const p19 = buildingPolygonPoints(
    [
      { x: 1, y: 1 },
      { x: 6, y: 1 },
      { x: 6, y: 3 },
      { x: 5, y: 4 },
      { x: 4, y: 6 },
      { x: 1, y: 6 },
    ],
    [
      { index: 2, handle: { x: 5, y: 2 } },
      { index: 4, handle: { x: 3, y: 5 } },
    ],
    true,
  );
  assert.equal(p19.length, 37);
  const joined = draw(p19);
  assert.equal(joined.mode, "draw");
  if (joined.mode !== "draw") return;
  assert.equal(joined.polygons.length, 1);
  assert.equal(joined.polygons[0]!.outer.length, 39);
  assert.ok(
    joined.polygons[0]!.outer.some(
      (p) => Math.abs(p.x * 256 - 1469) <= 1 && Math.abs(p.y * 256 - 808) <= 1,
    ),
  );

  const p30 = buildingPolygonPoints(
    [
      { x: 1, y: 1 },
      { x: 6, y: 1 },
      { x: 6, y: 4 },
      { x: 5, y: 5 },
      { x: 1, y: 6 },
    ],
    [firstCurve],
    true,
  );
  const narrow = draw(p30);
  assert.equal(narrow.mode, "draw");
  if (narrow.mode !== "draw") return;
  assert.deepEqual(
    narrow.polygons.map((p) => p.outer.length),
    [17, 5],
  );
});

test("point mutation validation does not add the topology guard to document loading", () => {
  const document = newDocument("Bestehende Kontur", 40, 40),
    floorId = document.floors[0]!.id,
    existing: Building = {
      id: "existing-self-intersection",
      kind: "building",
      floorId,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 10, y: 0 },
            { x: 0, y: 8 },
          ],
          holes: [],
        },
      ],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    },
    parsed = parseDocument(
      JSON.stringify({
        ...document,
        entities: [existing],
      }),
    );
  assert.deepEqual(parsed.entities, [existing]);
});

test("Building floor and wall alpha and bevel survive parsing without altering older records", () => {
  const document = newDocument("Stilwerte", 12, 12);
  const original: Building = {
    id: "building-style",
    kind: "building",
    floorId: document.floors[0]!.id,
    polygons: [{ outer: rectangle({ x: 1, y: 1 }, { x: 4, y: 4 }), holes: [] }],
    layer: 200,
    fill: 0xff0000,
    floorAlpha: 128,
    wall: 0xff00ff,
    wallAlpha: 64,
    wallWidth: 0.2,
    wallBevel: true,
  };
  const parsed = parseDocument(
    JSON.stringify({ ...document, entities: [original] }),
  );
  assert.deepEqual(parsed.entities[0], original);
  const legacy: Record<string, unknown> = { ...original };
  delete legacy.floorAlpha;
  delete legacy.wallAlpha;
  delete legacy.wallBevel;
  assert.deepEqual(
    parseDocument(JSON.stringify({ ...document, entities: [legacy] }))
      .entities[0],
    legacy,
  );
  for (const broken of [
    { floorAlpha: -1 },
    { floorAlpha: 256 },
    { wallAlpha: 3.5 },
    { wallBevel: "yes" },
  ])
    assert.throws(() =>
      parseDocument(
        JSON.stringify({
          ...document,
          entities: [{ ...original, ...broken }],
        }),
      ),
    );
});

test("Wall and Cave picker alpha survive parsing while old records remain opaque", () => {
  const document = newDocument("Gemeinsamer Picker", 8, 8),
    floorId = document.floors[0]!.id;
  const wall: Wall = {
    id: "wall-picker",
    kind: "wall",
    floorId,
    points: [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
    ],
    closed: false,
    smooth: false,
    color: 0x74591d,
    alpha: 128,
    width: 0.22,
  };
  const cave: Surface = {
    id: "cave-picker",
    kind: "surface",
    floorId,
    category: "cave",
    polygons: [{ outer: rectangle({ x: 3, y: 3 }, { x: 5, y: 5 }), holes: [] }],
    layer: -300,
    color: 0xafa99b,
    wallColor: 0x73581d,
    wallAlpha: 128,
    wallWidth: 0.3,
  };
  for (const entities of [
    [wall, cave],
    [
      { ...wall, alpha: undefined },
      { ...cave, wallAlpha: undefined },
    ],
  ])
    assert.deepEqual(
      parseDocument(JSON.stringify({ ...document, entities })).entities,
      JSON.parse(JSON.stringify(entities)),
    );
  for (const [key, value] of [
    ["alpha", -1],
    ["alpha", 256],
    ["wallAlpha", 3.5],
  ] as const) {
    const entities =
      key === "alpha"
        ? [{ ...wall, alpha: value }, cave]
        : [wall, { ...cave, wallAlpha: value }];
    assert.throws(() =>
      parseDocument(JSON.stringify({ ...document, entities })),
    );
  }
});
