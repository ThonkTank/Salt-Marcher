import test from "node:test";
import assert from "node:assert/strict";
import {
  nearestSegmentPoint,
  nearestBuildingSegment,
  nearestBoundary,
  nearestEdge,
  nearestPath,
} from "../../src/geometry";
import type { Point, Polygon, MapPath } from "../../src/model";
import { cityScene, hitCity } from "../../src/features/city/scene";
import { cityBuildingOutline } from "../../src/features/city/geometry";
import {
  newCityDocument,
  serializeCityDocument,
} from "../../src/features/city/codec";
import { editCity } from "../../src/features/city/edit";
import {
  screenToWorld,
  worldToScreen,
  panAtlas,
  zoomAtlas,
} from "../../src/features/atlas/camera";
import { fixture } from "./fixtures";

const square = (size = 10, x = 0, y = 0): Polygon => ({
  outer: [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ],
  holes: [],
});
const courtyard: Polygon = { ...square(), holes: [square(4, 3, 3).outer] };
const house = (id = "house") => ({
  id,
  name: "Haus",
  footprint: courtyard,
  position: { x: 0, y: 0 },
  rotationRadians: 0,
  scale: { x: 1, y: 1 },
});
const hit = (
  scene: ReturnType<typeof cityScene>,
  point: Point,
  toleranceMeters = 0,
  includeNodes = false,
) => hitCity(scene, point, { toleranceMeters, includeNodes });

test("Shared segment primitive handles zero length, endpoints, slanted projection and very long meter segments", () => {
  assert.deepEqual(
    nearestSegmentPoint({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 }),
    { point: { x: 0, y: 0 }, t: 0, distance: 5 },
  );
  assert.equal(
    nearestSegmentPoint({ x: -2, y: 1 }, { x: 0, y: 0 }, { x: 10, y: 0 }).t,
    0,
  );
  assert.equal(
    nearestSegmentPoint({ x: 12, y: 1 }, { x: 0, y: 0 }, { x: 10, y: 0 }).t,
    1,
  );
  const slanted = nearestSegmentPoint({ x: 5, y: 1 }, { x: 0, y: 0 }, { x: 6, y: 8 });
  assert(Math.abs(slanted.point.x - 2.28) < 1e-12);
  assert(Math.abs(slanted.point.y - 3.04) < 1e-12);
  assert(Math.abs(slanted.t - 0.38) < 1e-12);
  assert(Math.abs(slanted.distance - 3.4) < 1e-12);
  const long = nearestSegmentPoint(
    { x: 5e199, y: 3 },
    { x: 0, y: 0 },
    { x: 1e200, y: 0 },
  );
  assert.equal(long.t, 0.5);
  assert.equal(long.distance, 3);
  assert.equal(long.point.x, 5e199);
  assert.throws(() =>
    nearestSegmentPoint({ x: NaN, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }),
  );
});

test("Shared Dungeon wrappers keep contour, edge, path position and first tie semantics", () => {
  const { room } = fixture(),
    point = { x: 8, y: 1 };
  assert.deepEqual(nearestBuildingSegment(point, room), {
    contour: 0,
    index: 0,
    distance: 1,
  });
  assert.deepEqual(nearestBoundary(point, room), {
    contour: 0,
    at: 6 / 44,
    distance: 1,
  });
  assert.deepEqual(nearestEdge(point, room), { edge: 0, t: 0.5, distance: 1 });
  const path: MapPath = {
    id: "path",
    floorId: room.floorId,
    kind: "path",
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ],
    closed: false,
    smooth: false,
    width: 1,
    style: "road",
    color: 0,
    outlineColor: 0,
    outlineWidth: 0,
    layer: 1,
    start: "round",
    end: "round",
    blocksLight: false,
  };
  assert.deepEqual(nearestPath({ x: 5, y: 2 }, path), {
    at: 0.25,
    distance: 2,
  });
  assert.equal(nearestBuildingSegment({ x: 8, y: 7 }, room).index, 0);
  // Saved Dungeon baseline: computing distance from a rounded projected point changes this tie.
  const cornerRoom = { ...room, polygons: [square(12)] };
  const outside = { x: -1.21, y: 14.809999999999999 };
  assert.equal(nearestBuildingSegment(outside, cornerRoom).index, 3);
  assert.equal(nearestEdge(outside, cornerRoom).edge, 3);
});

test("City scene derives stable layer order, referenced road endpoints, posed houses and complete meter extent", () => {
  const document = {
    ...newCityDocument("city", "Stadt"),
    districts: [
      { id: "district", name: "Viertel", outline: square(40, -10, -10) },
    ],
    plots: [{ id: "plot", outline: square(15) }],
    plazas: [{ id: "plaza", name: "Platz", outline: square(12) }],
    roadNodes: [
      { id: "a", point: { x: -20, y: -5 } },
      { id: "b", point: { x: 20, y: -5 } },
      { id: "orphan", point: { x: 100, y: 100 } },
    ],
    roads: [
      { id: "road", startNodeId: "a", endNodeId: "b", via: [], widthMeters: 4 },
    ],
    buildings: [house("first"), house("second")],
  };
  const before = serializeCityDocument(document),
    scene = cityScene(document);
  assert.deepEqual(
    scene.shapes.map((s) => s.kind),
    ["district", "plot", "plaza", "road", "building", "building"],
  );
  assert.deepEqual(scene.extent, {
    minX: -22,
    minY: -10,
    maxX: 100,
    maxY: 100,
  });
  const road = scene.shapes[3]!;
  assert.equal(road.kind, "road");
  if (road.kind !== "road") return;
  assert.deepEqual(road.points, [
    document.roadNodes[0]!.point,
    document.roadNodes[1]!.point,
  ]);
  const moved = cityScene(
    editCity(document, [
      { kind: "move-node", nodeId: "a", point: { x: -30, y: -5 } },
    ]),
  );
  assert.equal(moved.extent!.minX, -32);
  assert.equal(serializeCityDocument(document), before);
  assert(!Object.isFrozen(document));
  assert(Object.isFrozen(scene.shapes));
  assert(Object.isFrozen(road.points[0]));
  document.roadNodes[0]!.point.x = 999;
  assert.equal(road.points[0]!.x, -20);
});

test("City house pose and courtyard hits share the codec geometry and preserve transparent holes", () => {
  const building = {
    ...house(),
    position: { x: -50, y: 30 },
    rotationRadians: Math.PI / 2,
    scale: { x: 2, y: 1 },
  };
  const scene = cityScene({
    ...newCityDocument("city", "Stadt"),
    buildings: [building],
  });
  const outline = cityBuildingOutline(building);
  assert.deepEqual(outline.outer[0], { x: -50, y: 30 });
  assert(Math.abs(outline.outer[1]!.x + 50) < 1e-12);
  assert.equal(outline.outer[1]!.y, 50);
  assert.equal(hit(scene, { x: -51, y: 32 })?.elementId, "house");
  assert.equal(hit(scene, { x: -55, y: 40 }), null);
  assert.equal(hit(scene, { x: -53, y: 40 }, 0.01)?.elementId, "house");
  assert.equal(hit(scene, { x: -50, y: 30 })?.kind, "building");
  assert.equal(hit(scene, { x: -49, y: 35 }, 0.5), null);
  assert.equal(hit(scene, { x: -49, y: 35 }, 1)?.kind, "building");
  const huge = {
    ...house(),
    footprint: square(0.001),
    position: { x: 1e9, y: -1e9 },
  };
  assert.equal(
    hit(cityScene({ ...newCityDocument("tiny", "Klein"), buildings: [huge] }), {
      x: 1e9 + 0.0005,
      y: -1e9 + 0.0005,
    })?.elementId,
    "house",
  );
  assert.throws(() =>
    cityScene({
      ...newCityDocument("bad", "Fehler"),
      buildings: [{ ...building, scale: { x: 0, y: 1 } }],
    }),
  );
});

test("City hit order follows drawing order including holes, while visible nodes use nearest and stable ties", () => {
  const doc = {
    ...newCityDocument("city", "Stadt"),
    plazas: [{ id: "plaza", name: "Platz", outline: square(20) }],
    buildings: [house("bottom"), house("top")],
    roadNodes: [
      { id: "first", point: { x: 0, y: 0 } },
      { id: "second", point: { x: 2, y: 0 } },
    ],
  };
  const scene = cityScene(doc);
  assert.equal(hit(scene, { x: 1, y: 1 })?.elementId, "top");
  assert.equal(hit(scene, { x: 5, y: 5 })?.elementId, "plaza");
  assert.equal(hit(scene, { x: 1, y: 0 }, 1, true)?.elementId, "first");
  assert.equal(hit(scene, { x: 1.8, y: 0 }, 2, true)?.elementId, "second");
  assert.equal(hit(scene, { x: 0, y: 0 }, 0, false)?.elementId, "top");
});

test("City road hit geometry includes width, round ends and joins without accepting its whole bounding box", () => {
  const scene = cityScene({
    ...newCityDocument("city", "Straße"),
    roadNodes: [
      { id: "a", point: { x: 0, y: 0 } },
      { id: "b", point: { x: 10, y: 10 } },
    ],
    roads: [
      {
        id: "road",
        startNodeId: "a",
        endNodeId: "b",
        via: [{ x: 10, y: 0 }],
        widthMeters: 4,
      },
    ],
  });
  assert.deepEqual(scene.extent, { minX: -2, minY: -2, maxX: 12, maxY: 12 });
  for (const p of [
    { x: 5, y: 2 },
    { x: -2, y: 0 },
    { x: 10, y: -2 },
    { x: 12, y: 10 },
  ])
    assert.equal(hit(scene, p)?.elementId, "road");
  assert.equal(hit(scene, { x: 5, y: 2.01 }), null);
  assert.equal(hit(scene, { x: 5, y: 2.01 }, 0.02)?.elementId, "road");
  assert.equal(hit(scene, { x: 0, y: 10 }), null);
  assert.equal(hit(scene, { x: -2, y: -2 }), null);
});

test("City empty scenes and orphan nodes are explicit, invalid hit inputs or overflow bounds reject without mutating documents", () => {
  const empty = cityScene(newCityDocument("empty", "Leer"));
  assert.equal(empty.extent, null);
  assert.equal(hit(empty, { x: 0, y: 0 }), null);
  const orphan = cityScene({
    ...newCityDocument("node", "Knoten"),
    roadNodes: [{ id: "a", point: { x: -20, y: -30 } }],
  });
  assert.deepEqual(orphan.extent, {
    minX: -20,
    minY: -30,
    maxX: -20,
    maxY: -30,
  });
  assert.equal(hit(orphan, { x: -20, y: -30 }), null);
  assert.equal(hit(orphan, { x: -20, y: -30 }, 0, true)?.kind, "node");
  for (const tolerance of [-1, NaN, Infinity])
    assert.throws(() => hit(empty, { x: 0, y: 0 }, tolerance));
  assert.throws(() => hit(empty, { x: Infinity, y: 0 }));
  const overflow = {
    ...newCityDocument("over", "Groß"),
    roadNodes: [
      { id: "a", point: { x: 1.5e308, y: 0 } },
      { id: "b", point: { x: 1.6e308, y: 0 } },
    ],
    roads: [
      {
        id: "road",
        startNodeId: "a",
        endNodeId: "b",
        via: [],
        widthMeters: 1e308,
      },
    ],
  };
  const before = serializeCityDocument(overflow);
  assert.throws(() => cityScene(overflow), /nicht darstellbar/);
  assert.equal(serializeCityDocument(overflow), before);
  const extra = { ...newCityDocument("extra", "Metadaten"), future: 1 };
  assert.throws(() => cityScene(extra));
});

test("City pure scene uses caller unprojection and existing Atlas camera across pan/zoom without retaining a camera", () => {
  const scene = cityScene({
    ...newCityDocument("city", "Stadt"),
    buildings: [{ ...house(), footprint: square() }],
  });
  const viewport = { width: 800, height: 600 },
    original = { center: { x: 1005, y: 2005 }, metersPerPixel: 1 };
  const cameras = [
    original,
    panAtlas(original, 20, -30),
    zoomAtlas(original, viewport, { x: 400, y: 300 }, 0.1),
  ];
  for (const camera of cameras) {
    // Hypothetical test translation only; no persisted Atlas placement API is claimed.
    const project = (p: Point) =>
      worldToScreen(camera, viewport, { x: p.x + 1000, y: p.y + 2000 });
    const unproject = (p: Point) => {
      const w = screenToWorld(camera, viewport, p);
      return { x: w.x - 1000, y: w.y - 2000 };
    };
    assert.equal(
      hit(scene, unproject(project({ x: 5, y: 5 })), 6 * camera.metersPerPixel)
        ?.elementId,
      "house",
    );
  }
  assert(!("camera" in scene));
  assert(!("history" in scene));
});
