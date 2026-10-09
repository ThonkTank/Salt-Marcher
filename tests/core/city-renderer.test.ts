import test from "node:test";
import assert from "node:assert/strict";
import { Container, Graphics, Texture, type FillInstruction } from "pixi.js";
import { CityRenderer } from "../../src/features/city/renderer";
import { cityScene } from "../../src/features/city/scene";
import {
  newCityDocument,
  serializeCityDocument,
} from "../../src/features/city/codec";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";
import { CitySource } from "../../src/features/city/commands";
import { CityDraft } from "../../src/features/city/draft";
import {
  TerrainSource,
  TerrainStroke,
} from "../../src/features/atlas/terrain-source";
import { newOverworld } from "../../src/features/atlas/overworld";
import type { Point } from "../../src/model";
const ring = (x: number, y: number, size: number) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
];
const document = () => ({
  ...newCityDocument("city", "Stadt"),
  plazas: [
    {
      id: "plaza",
      name: "Platz",
      outline: { outer: ring(-10, -10, 50), holes: [] },
    },
  ],
  buildings: [
    {
      id: "house",
      name: "Haus",
      footprint: {
        outer: ring(0, 0, 20),
        holes: [ring(2, 2, 3), ring(12, 12, 3)],
      },
      position: { x: 0, y: 0 },
      rotationRadians: 0,
      scale: { x: 1, y: 1 },
    },
  ],
});
const identity = (p: Point) => p;
const graphics = (r: CityRenderer, index = 0) =>
  r.container.children[index] as Graphics;
const fills = (r: CityRenderer, index = 0) =>
  graphics(r, index).context.instructions.filter(
    (i): i is FillInstruction => i.action === "fill",
  );

test("City renderer keeps true projected layer contours and multiple courtyard holes on only their own fill", () => {
  const r = new CityRenderer(),
    doc = document(),
    before = serializeCityDocument(doc);
  r.draw(cityScene(doc), (p) => ({ x: p.x * 2 + 100, y: p.y * 3 + 200 }), {
    selection: { ownerId: "city", kind: "building", elementId: "house" },
  });
  const layers = fills(r);
  assert.equal(layers.length, 2);
  assert.equal(layers[0]!.data.style.color, 0x98a6ad);
  assert.equal(layers[0]!.data.hole, undefined);
  assert.equal(layers[1]!.data.style.color, 0x5b7287);
  assert.deepEqual(
    layers[1]!.data.path.instructions.find((i) => i.action === "poly")!.data[0],
    [100, 200, 140, 200, 140, 260, 100, 260],
  );
  const holes = layers[1]!.data.hole!.instructions.filter(
    (i) => i.action === "poly",
  );
  assert.equal(holes.length, 2);
  assert.deepEqual(holes[0]!.data[0], [104, 206, 110, 206, 110, 215, 104, 215]);
  assert.deepEqual(holes[1]!.data[0], [124, 236, 130, 236, 130, 245, 124, 245]);
  const strokes = graphics(r, 1).context.instructions.filter(
    (i) => i.action === "stroke",
  );
  assert.equal(strokes.length, 3);
  assert(strokes.every((i) => i.data.style.width === 2));
  assert.equal(serializeCityDocument(doc), before);
  assert(!Object.isFrozen(doc));
  r.destroy();
});

test("City meter roads use projected segment width and affine round caps/joins rather than screen width assumptions", () => {
  const r = new CityRenderer(),
    scene = cityScene({
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
  r.draw(scene, (p) => ({ x: 100 - p.y * 3, y: 200 + p.x * 2 }));
  const layers = fills(r);
  assert.equal(layers.length, 5);
  assert.deepEqual(
    layers[0]!.data.path.instructions.find((i) => i.action === "poly")!.data[0],
    [94, 200, 94, 220, 106, 220, 106, 200],
  );
  for (const [index, center] of [
    [2, [100, 200]],
    [3, [100, 220]],
    [4, [70, 220]],
  ] as const) {
    const circle = layers[index]!.data.path.instructions.find(
      (i) => i.action === "circle",
    )!;
    assert.deepEqual(circle.data.slice(0, 3), [0, 0, 1]);
    const m = circle.data[3];
    assert.deepEqual(
      [m.a, m.b, m.c, m.d, m.tx, m.ty],
      [0, 4, -6, 0, ...center],
    );
    assert.equal(layers[index]!.data.style.alpha, 1);
  }
  r.draw(scene, (p) => ({ x: p.x * 4, y: p.y * 4 }));
  const m = fills(r)[2]!.data.path.instructions.find(
    (i) => i.action === "circle",
  )!.data[3];
  assert.deepEqual([m.a, m.b, m.c, m.d], [8, 0, 0, 8]);
  r.destroy();
});

test("City selection belongs to the caller, node handles are explicit fixed pixels including orphan nodes", () => {
  const r = new CityRenderer(),
    scene = cityScene({
      ...document(),
      roadNodes: [{ id: "orphan", point: { x: 50, y: -20 } }],
    });
  for (const selection of [
    null,
    { ownerId: "other", kind: "building" as const, elementId: "house" },
    { ownerId: "city", kind: "building" as const, elementId: "missing" },
  ]) {
    const before = JSON.stringify(selection);
    r.draw(scene, identity, { selection });
    assert.equal(graphics(r, 1).context.instructions.length, 0);
    assert.equal(JSON.stringify(selection), before);
  }
  for (const scale of [0.1, 100]) {
    r.draw(scene, (p) => ({ x: p.x * scale, y: p.y * scale }), {
      showNodes: true,
      selection: { ownerId: "city", kind: "node", elementId: "orphan" },
    });
    const c = fills(r, 1)[0]!.data.path.instructions.find(
      (i) => i.action === "circle",
    )!;
    assert.deepEqual(c.data.slice(0, 3), [50 * scale, -20 * scale, 5]);
  }
  r.draw(cityScene(newCityDocument("empty", "Leer")), identity, {
    showNodes: true,
  });
  assert.equal(graphics(r).context.instructions.length, 0);
  assert.equal(graphics(r, 1).context.instructions.length, 0);
  r.destroy();
});

test("City frames release replaced contexts and clear partial/stale frames on projection failures", () => {
  const r = new CityRenderer(),
    scene = cityScene(document()),
    parent = new Container();
  parent.addChild(r.container);
  r.draw(scene, identity);
  const old = graphics(r).context,
    oldOverlay = graphics(r, 1).context;
  r.draw(scene, identity);
  assert(old.destroyed);
  assert(oldOverlay.destroyed);
  let calls = 0;
  assert.throws(
    () =>
      r.draw(scene, (p) => {
        if (++calls === 6) throw new Error("projection interrupted");
        return p;
      }),
    /interrupted/,
  );
  assert.equal(graphics(r).context.instructions.length, 0);
  assert.equal(graphics(r, 1).context.instructions.length, 0);
  for (const p of [
    { x: NaN, y: 0 },
    { x: 0, y: Infinity },
  ]) {
    r.draw(scene, identity);
    assert.throws(() => r.draw(scene, () => p));
    assert.equal(graphics(r).context.instructions.length, 0);
  }
  r.draw(scene, identity);
  r.clear();
  r.clear();
  assert.equal(graphics(r).context.instructions.length, 0);
  const last = graphics(r).context;
  r.destroy();
  r.destroy();
  assert(last.destroyed);
  assert(!parent.destroyed);
  assert(!Texture.WHITE.destroyed);
  assert.equal(parent.children.length, 0);
  assert.throws(() => r.draw(scene, identity), /freigegeben/);
  r.clear();
  parent.destroy();
});

test("City renderer uses actual Draft preview/cancel/apply without editing shared Source, Terrain or History", async () => {
  const history = new AtlasHistory(),
    source = new CitySource(document(), history),
    terrain = new TerrainSource(
      newOverworld("terrain", "Welt", "pointy"),
      history,
      async () => {
        throw new Error("no files");
      },
    ),
    r = new CityRenderer();
  await terrain.ensure([{ q: 0, r: 0 }]);
  const stroke = new TerrainStroke(terrain, "forest");
  stroke.add({ q: 0, r: 0 });
  stroke.finish();
  const initialDepth = history.undoDepth;
  const terrainBefore = JSON.stringify(terrain.read({ q: 0, r: 0 })),
    original = serializeCityDocument(source.read());
  const preview = new CityDraft(source);
  preview.setEdits([
    {
      kind: "set-building-pose",
      buildingId: "house",
      position: { x: 30, y: 40 },
      rotationRadians: 0,
      scale: { x: 1, y: 1 },
    },
  ]);
  r.draw(preview.preview!.scene, identity);
  assert.equal(history.undoDepth, initialDepth);
  assert.equal(serializeCityDocument(source.read()), original);
  assert.deepEqual(
    fills(r)[1]!
      .data.path.instructions.find((i) => i.action === "poly")!
      .data[0].slice(0, 2),
    [30, 40],
  );
  preview.cancel();
  r.draw(cityScene(source.read()), identity);
  assert.equal(history.undoDepth, initialDepth);
  const applied = new CityDraft(source);
  applied.setEdits([
    {
      kind: "set-building-pose",
      buildingId: "house",
      position: { x: 30, y: 40 },
      rotationRadians: 0,
      scale: { x: 1, y: 1 },
    },
  ]);
  assert(applied.apply("Haus verschieben"));
  r.draw(cityScene(source.read()), identity);
  assert.equal(history.undoDepth, initialDepth + 1);
  history.undo();
  r.draw(cityScene(source.read()), identity);
  assert.equal(serializeCityDocument(source.read()), original);
  assert.equal(history.canRedo, true);
  assert.equal(JSON.stringify(terrain.read({ q: 0, r: 0 })), terrainBefore);
  r.destroy();
});

test("City road radius and normal offsets survive large X/Y origins before rotated affine projection", () => {
  const matrices = [
    [1000, 0, 0, 2000],
    [0, 1000, -2000, 0],
    [600, 800, -1600, 1200],
  ];
  for (const origin of [
    { x: 1e16, y: 0 },
    { x: 0, y: -1e16 },
    { x: 1e16, y: -1e16 },
  ]) {
    for (const [a, b, c, d] of matrices as [number, number, number, number][]) {
      const r = new CityRenderer(),
        doc = {
          ...newCityDocument("city", "Feine Straße"),
          roadNodes: [
            { id: "a", point: origin },
            { id: "b", point: { x: origin.x + 20, y: origin.y + 20 } },
          ],
          roads: [
            {
              id: "r",
              startNodeId: "a",
              endNodeId: "b",
              via: [],
              widthMeters: 0.01,
            },
          ],
        },
        before = serializeCityDocument(doc);
      r.draw(cityScene(doc), (p) => ({
        x: a * (p.x - origin.x) + c * (p.y - origin.y),
        y: b * (p.x - origin.x) + d * (p.y - origin.y),
      }));
      const layers = fills(r),
        circle = layers[1]!.data.path.instructions.find(
          (i) => i.action === "circle",
        )!.data[3];
      for (const [actual, expected] of [
        [circle.a, a * 0.005],
        [circle.b, b * 0.005],
        [circle.c, c * 0.005],
        [circle.d, d * 0.005],
      ])
        assert(Math.abs(actual - expected) < 1e-12);
      const quad = layers[0]!.data.path.instructions.find(
        (i) => i.action === "poly",
      )!.data[0];
      const nx = -Math.SQRT1_2,
        ny = Math.SQRT1_2;
      assert(Math.abs(quad[0] - 0.005 * (nx * a + ny * c)) < 1e-12);
      assert(Math.abs(quad[1] - 0.005 * (nx * b + ny * d)) < 1e-12);
      assert.equal(serializeCityDocument(doc), before);
      r.destroy();
    }
  }
});

test("City road affine probe uses the finite opposite direction at coordinate maximum, and clears unresolvable projection", () => {
  const r = new CityRenderer(),
    origin = Number.MAX_VALUE;
  const scene = cityScene({
    ...newCityDocument("city", "Rand"),
    roadNodes: [
      { id: "a", point: { x: origin, y: 0 } },
      { id: "b", point: { x: origin, y: 20 } },
    ],
    roads: [
      { id: "r", startNodeId: "a", endNodeId: "b", via: [], widthMeters: 2 },
    ],
  });
  r.draw(scene, (p) => ({ x: p.x - origin, y: p.y }));
  const m = fills(r)[1]!.data.path.instructions.find(
    (i) => i.action === "circle",
  )!.data[3];
  assert(
    Math.abs(m.a - 1) < 1e-12 &&
      Math.abs(m.b) < 1e-12 &&
      Math.abs(m.c) < 1e-12 &&
      Math.abs(m.d - 1) < 1e-12,
  );
  assert.throws(() => r.draw(scene, () => ({ x: 0, y: 0 })), /nicht auflösbar/);
  assert.equal(graphics(r).context.instructions.length, 0);
  r.destroy();
});
