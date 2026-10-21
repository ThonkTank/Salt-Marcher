import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents:
      "export * from './src/app/map-label-collisions';export * from './src/app/atlas-cartography';export * from './src/app/atlas-paint';",
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".build/atlas-camera-labels-test.cjs",
});
const { MapLabelCollisions, MapLabelLayout, paintMapLabels, atlasPaint } =
  createRequire(import.meta.url)("../.build/atlas-camera-labels-test.cjs");
const box = { x: 0, y: 0, width: 800, height: 600 },
  measure = (text, font) => text.length * font * 0.6;
const label = (id, point, rank = 2) => ({
  id,
  text: id,
  point,
  kind: "road",
  rank,
});
const projected = (point, mpp = 1, angle = 0) => ({ point, mpp, angle });

test("Camera projection, not flat-world spacing, owns label collisions and readable angle", () => {
  const candidates = [
    label("west", { x: -1e6, y: 0 }),
    label("east", { x: 1e6, y: 0 }),
  ];
  const overlapping = new MapLabelLayout().layout(
    candidates,
    box,
    1,
    measure,
    undefined,
    false,
    () => projected({ x: 400, y: 300 }),
  );
  assert.equal(overlapping.length, 1);
  const separated = new MapLabelLayout().layout(
    candidates,
    box,
    1,
    measure,
    undefined,
    false,
    (c) =>
      projected({ x: c.id === "west" ? 100 : 650, y: 300 }, 1, Math.PI / 4),
  );
  assert.equal(separated.length, 2);
  assert.equal(separated[0].angle, Math.PI / 4);
  assert(separated.every((p) => p.box.x >= 0 && p.box.x + p.box.w <= 800));
});
test("Local projected scale smoothly hides names without new data and selected names remain", () => {
  const candidates = [label("path", { x: 0, y: 0 }, 1)],
    layout = new MapLabelLayout();
  const at = (mpp, selected) =>
    layout.layout(candidates, box, 1, measure, selected, false, () =>
      projected({ x: 400, y: 300 }, mpp),
    );
  const values = [10, 11, 12, 13].map((mpp) => at(mpp)[0].opacity);
  assert(values.every((v, i) => !i || v < values[i - 1]));
  assert.equal(at(14).length, 0);
  assert.equal(at(100, "path")[0].opacity, 1);
  assert.equal(layout.animating, false);
});
test("Occluded labels cannot reserve collision slots and screen-space place offsets stay small", () => {
  const hidden = label("hidden", { x: 0, y: 0 }, 5),
    visible = { ...label("visible", { x: 8e9, y: -3e9 }), kind: "place" };
  const placed = new MapLabelLayout().layout(
    [hidden, visible],
    box,
    1,
    measure,
    undefined,
    false,
    (c) => (c === hidden ? null : projected({ x: 400, y: 300 }, 2)),
  );
  assert.equal(placed.length, 1);
  assert.deepEqual(placed[0].point, { x: 400, y: 286 });
});
test("Spatial publication retains all candidates while flat output keeps its placed labels", () => {
  const candidates = [
      label("near", { x: 300, y: 300 }),
      label("far", { x: 1e6, y: 1e6 }),
    ],
    root = atlasPaint("group");
  const placed = new MapLabelLayout().layout(candidates, box, 1, measure);
  paintMapLabels(root, placed, box, 1, { candidates, selected: "far" });
  assert.equal(root.mapLabels.candidates, candidates);
  assert.equal(root.mapLabels.selected, "far");
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].text, "near");
});

test("Expensive anchor visibility runs after collision rejection without reserving hidden slots", () => {
  const candidates = Array.from({ length: 100 }, (_, i) =>
    label(String(i), { x: 0, y: 0 }, i === 0 ? 5 : 2),
  );
  let calls = 0;
  const result = new MapLabelLayout().layout(
    candidates,
    box,
    1,
    measure,
    undefined,
    false,
    () => projected({ x: 400, y: 300 }),
    (c) => {
      calls++;
      return c.id !== "0";
    },
  );
  assert.equal(result.length, 1);
  assert.notEqual(result[0].candidate.id, "0");
  assert.equal(calls, 2);
});

test("Prefetched line names still obey physical line readability and selected exceptions", () => {
  const candidate = { ...label("thin", { x: 0, y: 0 }, 5), maxMpp: 2.5 },
    layout = new MapLabelLayout();
  const at = (mpp, selected) =>
    layout.layout([candidate], box, 1, measure, selected, false, () =>
      projected({ x: 400, y: 300 }, mpp),
    );
  assert.equal(at(4).length, 0);
  assert(at(2).length === 1);
  assert.equal(at(4, "thin")[0].opacity, 1);
});

test("Screen-cell collisions agree with a direct rectangle oracle across cell boundaries", () => {
  const grid = new MapLabelCollisions(1000),
    accepted = [];
  let seed = 71;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let i = 0; i < 1200; i++) {
    const r = {
      x: random() * 900,
      y: random() * 900,
      w: random() * 90 + 1,
      h: random() * 30 + 1,
    };
    const overlap = accepted.some(
      (b) =>
        r.x < b.x + b.w &&
        r.x + r.w > b.x &&
        r.y < b.y + b.h &&
        r.y + r.h > b.y,
    );
    assert.equal(grid.overlaps(r), overlap);
    if (!overlap) {
      grid.add(r);
      accepted.push(r);
    }
  }
  const edge = new MapLabelCollisions(1000);
  edge.add({ x: 0, y: 0, w: 64, h: 64 });
  assert.equal(edge.overlaps({ x: 64, y: 0, w: 64, h: 64 }), false);
  assert.equal(edge.overlaps({ x: 63.99, y: 0, w: 64, h: 64 }), true);
});
