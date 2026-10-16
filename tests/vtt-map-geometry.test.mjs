import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// geometry.ts uses bundler-style type imports; bundle the feature for Node's
// test runtime without changing any shared product source.
const bundle = await build({
  entryPoints: [new URL("../src/features/verwaltung/vtt-map-geometry.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "node", format: "esm", target: "es2022",
});
const { universalVttGeometryForFloor } = await import(
  "data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64")
);

// Native source: 06-source-wall-portal-light.dungeondraft_map, wall points
// divided by its 256-pixel grid. Native output: wall-portal-light.dd2vtt.
const wallPoints = [
  { x: 4, y: 5 }, { x: 2, y: 2 }, { x: 4, y: 1 },
  { x: 6, y: 2 }, { x: 6, y: 4 },
];
const edgeLengths = wallPoints.map((point, index) => {
  const next = wallPoints[(index + 1) % wallPoints.length];
  return Math.hypot(next.x - point.x, next.y - point.y);
});
const perimeter = edgeLengths.reduce((sum, length) => sum + length, 0);
const wall = {
  kind: "wall", id: "wall", floorId: "ground", points: wallPoints,
  closed: true, smooth: false, shadow: true, color: 0x726e65, width: 0.22,
};
const door = {
  kind: "door", id: "door", floorId: "ground",
  anchor: { boundaryId: "wall", contour: 0,
    at: (edgeLengths[0] + edgeLengths[1] + edgeLengths[2] + 1) / perimeter },
  width: 1, variant: "door", blocksLight: true,
  passage: { description: "", state: "closed", hidden: false },
};
const light = {
  kind: "light", id: "light", floorId: "ground", x: 4, y: 2.84375,
  radius: 5, intensity: 1, color: 0xeccd8b, shadows: true,
};

test("DD-043.22 maps the native closed wall, door gap, portal and light exactly", () => {
  const result = universalVttGeometryForFloor([wall, door, light], "ground");
  assert.deepEqual(result, {
    lineOfSightSegments: [[
      { x: 6, y: 3.5 }, { x: 6, y: 4 }, { x: 4, y: 5 },
      { x: 2, y: 2 }, { x: 4, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 2.5 },
    ]],
    objectLineOfSightSegments: [],
    portals: [{
      position: { x: 6, y: 3 },
      bounds: [{ x: 6, y: 2.5 }, { x: 6, y: 3.5 }],
      rotation: 1.570796, closed: true, freestanding: false,
    }],
    lights: [{
      position: { x: 4, y: 2.84375 }, range: 5, intensity: 1,
      color: "ffeccd8b", shadows: true,
    }],
  });
  assert.deepEqual(wall.points, wallPoints);
  assert.equal(door.anchor.at, (edgeLengths[0] + edgeLengths[1] + edgeLengths[2] + 1) / perimeter);
});

test("empty and light-only floors have no invented LOS or portals", () => {
  assert.deepEqual(universalVttGeometryForFloor([], "ground"), {
    lineOfSightSegments: [], objectLineOfSightSegments: [], portals: [], lights: [],
  });
  const result = universalVttGeometryForFloor([light, { ...wall, floorId: "upper" }], "ground");
  assert.equal(result.lights.length, 1);
  assert.deepEqual(result.lineOfSightSegments, []);
});

test("unmeasured buildings, wall forms, doors and occluders fail explicitly", () => {
  assert.throws(() => universalVttGeometryForFloor([{
    kind: "building", id: "room", floorId: "ground", polygons: [],
  }], "ground"), /building ist im Originalexport nicht belegt/);
  assert.throws(() => universalVttGeometryForFloor([wall], "ground"), /genau einer Tür/);
  assert.throws(() => universalVttGeometryForFloor([{ ...wall, smooth: true }, door], "ground"), /ungeglättete/);
  assert.throws(() => universalVttGeometryForFloor([{
    ...wall, points: [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }],
  }, door], "ground"), /einfache geschlossene Wandkonturen/);
  assert.throws(() => universalVttGeometryForFloor([wall, { ...door, passage: { ...door.passage, state: "open" } }], "ground"), /Türform/);
  assert.throws(() => universalVttGeometryForFloor([wall, { ...door, anchor: undefined, x: 6, y: 3, rotation: 0 }], "ground"), /Türform/);
  assert.throws(() => universalVttGeometryForFloor([wall, { ...door, width: 3 }], "ground"), /vollständig auf einer Wandkante/);
  assert.throws(() => universalVttGeometryForFloor([{ ...light, rotation: 0.5 }], "ground"), /Gedrehte Lichter/);
  assert.throws(() => universalVttGeometryForFloor([{
    kind: "object", id: "crate", floorId: "ground", blocksLight: true,
  }], "ground"), /object ist im Originalexport nicht belegt/);
});
