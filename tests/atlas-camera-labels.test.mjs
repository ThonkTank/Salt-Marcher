import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents:
      "export * from './src/app/atlas-cartography';export * from './src/app/atlas-paint';",
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".build/atlas-camera-labels-test.cjs",
});
const { MapLabelLayout, paintMapLabels, atlasPaint } = createRequire(
  import.meta.url,
)("../.build/atlas-camera-labels-test.cjs");
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

test('Expensive anchor visibility runs after collision rejection without reserving hidden slots',()=>{
 const candidates=Array.from({length:100},(_,i)=>label(String(i),{x:0,y:0},i===0?5:2));let calls=0;
 const result=new MapLabelLayout().layout(candidates,box,1,measure,undefined,false,()=>projected({x:400,y:300}),c=>{calls++;return c.id!=='0';});
 assert.equal(result.length,1);assert.notEqual(result[0].candidate.id,'0');assert.equal(calls,2);
});
