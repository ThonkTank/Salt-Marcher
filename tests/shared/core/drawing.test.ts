import assert from "node:assert/strict";
import { test } from "node:test";
import { composeBuilding, paint, visibility } from "../../../src/compute";
import { inside } from "../../../src/geometry";
import { type Light } from "../../../src/model";

test("paint keeps a fast stroke continuous and erasing creates a real hole", () => {
  const painted = paint({
    kind: "paint",
    polygons: [],
    points: [
      { x: 2, y: 2 },
      { x: 18, y: 2 },
    ],
    radius: 2,
    erase: false,
  });
  assert.equal(painted.length, 1);
  assert.equal(inside({ x: 10, y: 2 }, painted[0]!.outer), true);
  const erased = paint({
    kind: "paint",
    polygons: painted,
    points: [{ x: 10, y: 2 }],
    radius: 0.75,
    erase: true,
  });
  assert.equal(erased.length, 1);
  assert.equal(erased[0]!.holes.length, 1);
  assert.equal(inside({ x: 10, y: 2 }, erased[0]!.holes[0]!), true);
});

test("floor shapes merge on overlap, retain shared walls on touch, and erase real holes", () => {
  const polygon = (x: number, y: number, width: number, height: number) => ({
      outer: [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ],
      holes: [],
    }),
    sources = [
      { id: "left", polygons: [polygon(0, 0, 5, 5)] },
      { id: "right", polygons: [polygon(5, 0, 5, 5)] },
    ];
  const insideLeft = composeBuilding({
    kind: "compose-building",
    sources,
    shape: [polygon(1, 1, 2, 2)],
    erase: false,
  });
  assert.equal(insideLeft.mode, "draw");
  if (insideLeft.mode === "draw")
    assert.deepEqual(insideLeft.mergedIds, ["left"]);

  const fresh = composeBuilding({
    kind: "compose-building",
    sources: [],
    shape: [polygon(12, 2, 4, 3)],
    erase: false,
  });
  assert.equal(fresh.mode, "draw");
  if (fresh.mode === "draw") assert.equal(fresh.polygons[0]!.outer.length, 4);

  const bridge = composeBuilding({
    kind: "compose-building",
    sources,
    shape: [polygon(4, 2, 2, 1)],
    erase: false,
  });
  assert.equal(bridge.mode, "draw");
  if (bridge.mode === "draw") {
    assert.deepEqual(bridge.mergedIds, ["left", "right"]);
    assert.equal(bridge.polygons.length, 1);
  }

  const erased = composeBuilding({
    kind: "compose-building",
    sources: [{ id: "room", polygons: [polygon(0, 0, 10, 10)] }],
    shape: [polygon(2, 2, 6, 6)],
    erase: true,
  });
  assert.equal(erased.mode, "erase");
  if (erased.mode === "erase") {
    assert.equal(erased.changes.length, 1);
    assert.equal(erased.changes[0]!.polygons[0]!.holes.length, 1);
  }
});

test("native tiled floor redraw joins a full shared edge but leaves corner contact separate", () => {
  const cell = (x: number, y: number) => ({
    outer: [
      { x, y },
      { x: x + 1, y },
      { x: x + 1, y: y + 2 },
      { x, y: y + 2 },
    ],
    holes: [],
  });
  const source = { id: "wood", polygons: [cell(1, 0)] };
  const edge = composeBuilding({
    kind: "compose-building",
    nativeBuilding: true,
    mergeTouching: true,
    sources: [source],
    shape: [cell(0, 0)],
    erase: false,
  });
  assert.equal(edge.mode, "draw");
  if (edge.mode !== "draw") return;
  assert.deepEqual(edge.mergedIds, ["wood"]);
  assert.equal(edge.polygons.length, 1);
  const corner = composeBuilding({
    kind: "compose-building",
    nativeBuilding: true,
    mergeTouching: true,
    sources: [source],
    shape: [cell(0, -2)],
    erase: false,
  });
  assert.equal(corner.mode, "draw");
  if (corner.mode === "draw") assert.deepEqual(corner.mergedIds, []);
});

test("corridor strokes join and split the same floor geometry", () => {
  const room = {
      outer: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 8 },
        { x: 0, y: 8 },
      ],
      holes: [],
    },
    joined = composeBuilding({
      kind: "compose-building",
      sources: [{ id: "room", polygons: [room] }],
      stroke: {
        points: [
          { x: 7.5, y: 4 },
          { x: 12, y: 4 },
          { x: 12, y: 7 },
        ],
        radius: 0.5,
      },
      erase: false,
    });
  assert.equal(joined.mode, "draw");
  if (joined.mode !== "draw") return;
  assert.deepEqual(joined.mergedIds, ["room"]);
  assert.equal(joined.polygons.length, 1);
  assert.equal(inside({ x: 12, y: 6 }, joined.polygons[0]!.outer), true);

  const split = composeBuilding({
    kind: "compose-building",
    sources: [{ id: "room", polygons: joined.polygons }],
    stroke: {
      points: [
        { x: 4, y: -1 },
        { x: 4, y: 9 },
      ],
      radius: 0.5,
    },
    erase: true,
  });
  assert.equal(split.mode, "erase");
  if (split.mode === "erase") {
    assert.equal(split.changes.length, 1);
    assert.equal(split.changes[0]!.polygons.length, 2);
  }
});

test("light visibility stops at walls but remains open through a portal gap", () => {
  const light: Light = {
    id: "light",
    kind: "light",
    floorId: "floor",
    x: 0,
    y: 0,
    radius: 10,
    intensity: 1,
    color: 0xffffff,
    shadows: true,
  };
  const closestToEast = (points: readonly { x: number; y: number }[]) =>
    points.reduce((best, point) =>
      Math.abs(point.y) < Math.abs(best.y) ? point : best,
    );
  const blocked = closestToEast(
    visibility(light, [{ a: { x: 4, y: -5 }, b: { x: 4, y: 5 } }]),
  );
  assert.ok(blocked.x <= 4.001);
  const throughGap = closestToEast(
    visibility(light, [
      { a: { x: 4, y: -5 }, b: { x: 4, y: -1 } },
      { a: { x: 4, y: 1 }, b: { x: 4, y: 5 } },
    ]),
  );
  assert.ok(throughGap.x > 9.9);
});
