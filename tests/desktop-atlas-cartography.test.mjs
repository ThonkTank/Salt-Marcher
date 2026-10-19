import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas-cartography';export * from './src/app/atlas-map-labels';export * from './src/app/atlas-label-sources';export * from './src/app/landscape-line';export {cityPaint} from './src/app/city-model';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/atlas-cartography-test.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
});
const require = createRequire(import.meta.url),
  {
    MapLabelLayout,
    MapLabelPool,
    transformLabel,
    buildingOpacity,
    linePresentation,
    landscapeLabel,
    regionMapLabel,
    mapLineParts,
    linePoints,
    cityPaint,
  } = require("../.build/atlas-cartography-test.cjs");
const measure = (text, size) => ({
  width: Math.max(...text.split("\n").map((s) => s.length * size * 0.6)),
  height: text.split("\n").length * size * 1.2,
});
const viewport = { width: 1024, height: 768 };
const label = (id, point = { x: 400, y: 300 }) => ({
  id,
  text: id,
  kind: "place",
  point,
  priority: 50,
});
const layout = (labels, mpp = 1) =>
  new MapLabelLayout().layout(labels, viewport, mpp, measure);
const overlap = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
const square = (x, y, w, h = w) => ({
  outer: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
  holes: [],
});
test("dense mixed names never overlap and input order does not choose the winners", () => {
  const labels = Array.from({ length: 400 }, (_, i) => ({
    ...label("Ort " + i, {
      x: 50 + (i % 20) * 45,
      y: 50 + Math.floor(i / 20) * 30,
    }),
    priority: i % 4,
  }));
  const a = layout(labels),
    b = layout(labels.toReversed());
  assert(a.length > 30 && a.length < labels.length);
  assert.deepEqual(a, b);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < i; j++) assert(!overlap(a[i].box, a[j].box));
});
test("selected name takes precedence and survives zoom visibility without modifying the candidate", () => {
  const a = {
      ...label("Auswahl"),
      kind: "building",
      maxMpp: 2,
      selected: true,
    },
    before = structuredClone(a),
    others = Array.from({ length: 20 }, (_, i) => ({
      ...label("Ort " + i),
      priority: 999,
    }));
  assert.equal(layout([a, ...others], 100)[0].label.id, a.id);
  assert.deepEqual(a, before);
  assert.equal(layout([{ ...a, selected: false }], 100).length, 0);
});
test("label threshold hysteresis holds an existing placement without accepting a fresh one", () => {
  const l = { ...label("Haus"), maxMpp: 2 },
    state = new MapLabelLayout();
  const first = state.layout([l], viewport, 1.9, measure);
  assert.equal(first.length, 1);
  const second = state.layout([l], viewport, 2.1, measure);
  assert.equal(second.length, 1);
  assert.equal(first[0].key, second[0].key);
  assert.equal(layout([l], 2.1).length, 0);
  assert.equal(state.layout([l], viewport, 2.3, measure).length, 0);
});
test("area names fit concave contours and do not cross small offset holes", () => {
  const p = square(100, 100, 700, 500);
  p.holes = [square(480, 310, 12).outer];
  const names = layout([
    {
      id: "region",
      text: "Nebelmark",
      kind: "region",
      polygons: [p],
      priority: 90,
    },
  ]);
  assert.equal(names.length, 1);
  const b = names[0].box;
  assert(!overlap(b, { x: 480, y: 310, width: 12, height: 12 }));
  const concave = {
    outer: [
      { x: 100, y: 100 },
      { x: 800, y: 100 },
      { x: 800, y: 200 },
      { x: 240, y: 200 },
      { x: 240, y: 650 },
      { x: 100, y: 650 },
    ],
    holes: [],
  };
  const n = layout([
    {
      id: "l",
      text: "Land",
      kind: "region",
      polygons: [concave],
      priority: 90,
    },
  ]);
  assert.equal(n.length, 1);
  assert(n[0].y < 200 || n[0].x < 240);
});
test("line labels stay upright, require straight space and repeat at least 400 pixels apart", () => {
  const river = {
    id: "r",
    text: "Nebelstrom",
    kind: "river",
    path: [
      { x: 1000, y: 380 },
      { x: 0, y: 180 },
    ],
    priority: 50,
  };
  const names = layout([river]);
  assert(names.length >= 2);
  for (const p of names) assert(Math.abs(p.angle) <= Math.PI / 2);
  for (let i = 1; i < names.length; i++)
    assert(
      Math.hypot(names[i].x - names[i - 1].x, names[i].y - names[i - 1].y) >=
        400,
    );
  assert.equal(
    layout([
      {
        ...river,
        path: [
          { x: 200, y: 200 },
          { x: 220, y: 210 },
        ],
      },
    ]).length,
    0,
  );
});
test("a small visible part of a very long road still receives labels", () => {
  const names = layout([
    {
      id: "long",
      text: "Königsstraße",
      kind: "road",
      priority: 50,
      path: [
        { x: -1e8, y: 200 },
        { x: 1e8, y: 200 },
      ],
    },
  ]);
  assert(names.length >= 1 && names.length <= 3);
});
test("full long and multiline names are preserved; names that cannot fit are omitted", () => {
  const text = "Das Haus mit einem bewusst vollständig erhaltenen Namen";
  const l = { ...label(text), text };
  assert.equal(layout([l])[0].label.text, text);
  const multiline = { ...label("a"), text: "Erste Zeile\nZweite Zeile" };
  assert.equal(layout([multiline])[0].label.text, multiline.text);
  assert.equal(layout([{ ...l, text: text.repeat(20) }]).length, 0);
});
test("panning preserves point placement and text size while geometry moves", () => {
  const state = new MapLabelLayout(),
    a = label("Eichenfurt"),
    first = state.layout([a], viewport, 1, measure)[0];
  const second = state.layout(
    [transformLabel(a, (p) => ({ x: p.x + 4, y: p.y - 3 }))],
    viewport,
    0.8,
    measure,
  )[0];
  assert.equal(first.key, second.key);
  assert.equal(first.fontSize, second.fontSize);
  assert.equal(second.x - first.x, 4);
  assert.equal(second.y - first.y, -3);
});
test("bounded candidate pool prioritizes selection, is deterministic, and keeps exact text", () => {
  const labels = Array.from({ length: 1000 }, (_, i) => ({
    ...label("label-" + i),
    priority: i,
  }));
  const a = new MapLabelPool(30, 10000),
    b = new MapLabelPool(30, 10000);
  labels.forEach((l) => a.add(l));
  labels.toReversed().forEach((l) => b.add(l));
  assert.deepEqual(a.values(), b.values());
  assert.equal(a.values().length, 30);
  a.add({ ...label("selected"), selected: true, priority: -1 });
  assert.equal(a.values()[0].id, "selected");
});
test("map style changes leave authored widths and curved points unchanged", () => {
  const r = {
    id: "road",
    revision: 1,
    kind: "road",
    name: "Königsstraße",
    width: 8,
    resolution: 1,
    points: [
      { x: 0, y: 0 },
      { x: 2000, y: 300 },
      { x: 4000, y: 0 },
    ],
    polygons: [],
    values: {},
    line: {
      version: 1,
      curve: "smooth",
      color: "#a37e51",
      roughness: 0.3,
      meander: 0,
      fadeIn: false,
      seed: 1,
      style: "double",
      overSymbols: false,
    },
  };
  const before = structuredClone(r),
    points = linePoints(r);
  assert(mapLineParts(r, 100)[0].width >= 100);
  assert(mapLineParts(r, 0.1).length >= 2);
  assert.equal(mapLineParts(r, 1e6).length, 0);
  assert(mapLineParts(r, 1e6, true).length);
  assert.deepEqual(r, before);
  assert.deepEqual(linePoints(r), points);
});
test("tiny building geometry fades out and selected geometry remains visible", () => {
  const p = square(0, 0, 10).outer;
  assert.equal(buildingOpacity(p, 10), 0);
  assert.equal(buildingOpacity(p, 10, true), 1);
  assert.equal(buildingOpacity(p, 1), 1);
  assert.equal(linePresentation("road", 2, 1e6).opacity, 0);
});
test("city label projection supplies roads, areas and buildings without author notes", () => {
  const v = {
    header: {
      id: "c",
      name: "Stadt",
      width: 1000,
      height: 1000,
      paper: "#eee",
      roof: "#ccc",
    },
    units: [
      {
        id: "house",
        kind: "building",
        name: "Taverne",
        position: { x: 100, y: 100 },
        outline: square(-8, -8, 16).outer,
      },
      {
        id: "road",
        kind: "road",
        name: "Hauptstraße",
        width: 6,
        outline: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
      },
      {
        id: "district",
        kind: "district",
        name: "Altstadt",
        outline: square(0, 0, 300).outer,
      },
    ],
  };
  const paint = cityPaint(v, { mpp: 1 }),
    names = paint.children.flatMap((p) => p.geometry.mapLabels ?? []);
  assert.equal(names.length, 3);
  assert.equal(names.find((p) => p.kind === "road").text, "Hauptstraße");
  assert.equal(
    paint.children.some((p) => p.kind === "text"),
    false,
  );
  const far = cityPaint(v, { mpp: 100, selectedId: "house" });
  assert(far.children.some((p) => p.data.cityUnit === "house"));
});
test("region prominence uses existing geographic contours and line naming preserves name provenance", () => {
  const l = regionMapLabel("kingdom", "Königreich", [square(0, 0, 1000)], 80);
  assert.equal(l.maxMpp, 5000);
  assert.equal(layout([l]).length, 1);
  const r = landscapeLabel(
    {
      kind: "river",
      id: "r",
      name: "Rinnsal",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      width: 2,
    },
    1,
  );
  assert.equal(r.text, "Rinnsal");
  assert.equal(r.kind, "river");
});
