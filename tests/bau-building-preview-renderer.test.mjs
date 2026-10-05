import assert from "node:assert/strict";
import test from "node:test";
import { Container, Graphics, Texture } from "pixi.js";
import { MapRenderer } from "../src/renderer.ts";

test("DD-012.03 transient floor and wall preview hides only the live visual", () => {
  const before = {
    id: "held-ellipse",
    kind: "building",
    floorId: "ground",
    layer: 100,
    polygons: [{ outer: [
      { x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 2, y: 5 },
    ], holes: [] }],
    fill: 0xbfb09a,
    wall: 0x403e39,
    wallWidth: 0.2,
  };
  const after = {
    ...before,
    polygons: [{ outer: [
      { x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 1, y: 5 },
    ], holes: [] }],
  };
  const renderer = Object.create(MapRenderer.prototype);
  const source = {
    entity: before,
    container: new Container(),
    shadow: new Graphics(),
  };
  source.container.alpha = 0.8;
  source.container.tint = 0xffffff;
  renderer.session = {
    entities: new Map([[before.id, before]]),
    dependents: () => new Set(),
  };
  renderer.visuals = new Map([[before.id, source]]);
  renderer.floorId = "ground";
  renderer.settings = { buildingWear: 0, wallShadows: true };
  renderer.roomLayer = new Container();
  renderer.roomLayer.sortableChildren = true;
  renderer.areaShadowLayer = new Container();
  renderer.preview = new Graphics();
  renderer.selection = new Graphics();
  renderer.camera = { scale: 24 };
  renderer.textures = { release: () => {} };
  renderer.invalidate = () => {};

  renderer.previewBuildingShape(after, 0);
  assert.equal(source.container.visible, false);
  assert.equal(source.shadow.visible, false);
  assert.equal(renderer.selection.visible, false);
  assert.equal(renderer.buildingPreview.entity, after);
  assert.equal(renderer.buildingPreview.container.parent, renderer.roomLayer);
  assert.equal(renderer.buildingPreview.shadow.parent, renderer.areaShadowLayer);
  const actions = renderer.buildingPreview.graphic.context.instructions
    .map((instruction) => instruction.action);
  assert.ok(actions.includes("fill"));
  assert.ok(actions.includes("stroke"));
  assert.ok(renderer.preview.context.instructions.length > 0);
  assert.equal(renderer.session.entities.get(before.id), before);
  assert.deepEqual(before.polygons[0].outer[3], { x: 2, y: 5 });

  renderer.cancelPreview([before.id]);
  assert.equal(renderer.buildingPreview, undefined);
  assert.equal(source.container.visible, true);
  assert.equal(source.shadow.visible, true);
  assert.equal(renderer.selection.visible, true);
  assert.equal(renderer.roomLayer.children.length, 0);
  assert.equal(renderer.areaShadowLayer.children.length, 0);
  assert.equal(renderer.session.entities.get(before.id), before);
});

test("DD-012.03 package wall preview follows each held contour update and releases its texture", async () => {
  const base = {
    id: "package-ellipse", kind: "building", floorId: "ground", layer: 100,
    polygons: [{ outer: [
      { x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 2, y: 5 },
    ], holes: [] }],
    fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
    wallAssetId: "qa-wall-01",
  };
  const renderer = Object.create(MapRenderer.prototype);
  const source = { entity: base, container: new Container() };
  source.container.tint = 0xffffff;
  renderer.session = {
    entities: new Map([[base.id, base]]), dependents: () => new Set(),
  };
  renderer.visuals = new Map([[base.id, source]]);
  renderer.floorId = "ground";
  renderer.settings = { buildingWear: 0, wallShadows: false };
  renderer.roomLayer = new Container();
  renderer.areaShadowLayer = new Container();
  renderer.preview = new Graphics();
  renderer.selection = new Graphics();
  renderer.camera = { scale: 24 };
  const acquired = [], released = [];
  renderer.textures = {
    acquire: (reference) => { acquired.push(reference); return Promise.resolve(Texture.WHITE); },
    release: (reference) => released.push(reference),
  };
  renderer.invalidate = () => {};
  const first = { ...base, polygons: [{ outer: [
    { x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 1.5, y: 5 },
  ], holes: [] }] };
  renderer.previewBuildingShape(first, 0);
  await Promise.resolve();
  assert.deepEqual(acquired, ["qa-wall-01\0image"]);
  assert.equal(renderer.buildingPreview.wallLayer.children.length, 4);
  const second = { ...first, polygons: [{ outer: [
    { x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 1, y: 5 },
  ], holes: [] }] };
  renderer.previewBuildingShape(second, 0);
  assert.equal(renderer.buildingPreview.entity, second);
  assert.equal(renderer.buildingPreview.wallLayer.children.length, 4);
  assert.deepEqual(acquired, ["qa-wall-01\0image"],
    "each pointer move must reuse the same texture reference");
  renderer.cancelPreview([base.id]);
  assert.deepEqual(released, ["qa-wall-01\0image"]);
  assert.equal(source.container.visible, true);
});
