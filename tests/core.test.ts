import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  newDocument,
  parseDocument,
  type Entity,
  type MapObject,
  type MapPath,
  type Light,
  type Door,
  type Roof,
  type Wall,
  type Surface,
  type Building,
  type Polygon,
  isRoom,
} from "../src/model";
import { Session, textPatch } from "../src/session";
import { createPrefab, placePrefab } from "../src/prefabs";
import {
  createRoom,
  adoptFloorAsRoom,
  createDoor,
  createObject,
  scatterObjects,
  createLight,
  createPortal,
  createWall,
  createSurface,
  createBuilding,
  createMapPath,
  createRoof,
  addFloor,
  duplicateFloor,
  resizeMap,
  createReferenceImage,
  editNote,
  updatePassage,
  planBuildingMutation,
  planBuildingContourMutation,
} from "../src/commands";
import { compactWheelNavigation, wheelNavigation } from "../src/navigation";
import {
  selectableByClick,
  selectionAllowed,
  selectionLayer,
  selectionLayers,
  selectionType,
  selectionCenter,
  selectionMirrorChanges,
  selectionTransformAt,
  selectionFrame,
  selectionFrameTransformAt,
  selectionInsideBox,
  transformSelectionGroup,
  scaleBoxSelection,
  scaleSelectionFrame,
  rotateBoxSelection,
  selectionStackChange,
  captureSelectionClipboard,
  copyAtViewportCenter,
  type SelectionType,
} from "../src/selection";

test("selected box gives the measured corner grip priority over its interior at two zooms", () => {
  const box = {
    kind: "object", x: 10, y: 10, width: 4, height: 6,
    rotation: 0,
  } as MapObject;
  assert.deepEqual(selectionTransformAt(box, { x: 10, y: 10 }, 40), { mode: "move" });
  assert.deepEqual(selectionTransformAt(box, { x: 12.2, y: 13.2 }, 40),
    { mode: "scale", corner: 2 });
  assert.deepEqual(selectionTransformAt(box, { x: 14, y: 15 }, 40),
    { mode: "rotate" });
  assert.deepEqual(selectionTransformAt(box, { x: 11.5, y: 12.5 }, 40),
    { mode: "scale", corner: 2 });
  assert.deepEqual(selectionTransformAt(box, { x: 11.35, y: 12.35 }, 40),
    { mode: "move" });
  assert.deepEqual(selectionTransformAt(box, { x: 12.8, y: 13 }, 40),
    { mode: "scale", corner: 2 });
  assert.deepEqual(selectionTransformAt(box, { x: 12.85, y: 13 }, 40),
    { mode: "rotate" });
  assert.deepEqual(selectionTransformAt(box, { x: 12.4, y: 13 }, 80),
    { mode: "scale", corner: 2 });
  assert.deepEqual(selectionTransformAt(box, { x: 12.425, y: 13 }, 80),
    { mode: "rotate" });
  for (const [corner, x, y, sx, sy] of [
    [0, 8, 7, 1, 1], [1, 12, 7, -1, 1],
    [2, 12, 13, -1, -1], [3, 8, 13, 1, -1],
  ] as const) {
    for (const pixelsPerField of [40, 80]) {
      const at = (pixels: number, inward: number) => ({
        x: x + sx * inward * pixels / pixelsPerField,
        y: y + sy * inward * pixels / pixelsPerField,
      });
      assert.deepEqual(selectionTransformAt(box, at(20, 1), pixelsPerField),
        { mode: "scale", corner });
      assert.deepEqual(selectionTransformAt(box, at(25, 1), pixelsPerField),
        { mode: "move" });
      assert.deepEqual(selectionTransformAt(box, at(23, -1), pixelsPerField),
        { mode: "scale", corner });
      assert.deepEqual(selectionTransformAt(box, at(26, -1), pixelsPerField),
        { mode: "rotate" });
    }
  }
});

test("rotated furniture uses the world-aligned native frame for grips and movement", () => {
  const box = { kind: "object", x: 10, y: 10, width: 4, height: 4,
    rotation: Math.PI / 4 } as MapObject;
  const half = 2 * Math.SQRT2;
  for (const pixelsPerField of [40, 80]) {
    assert.deepEqual(selectionTransformAt(box, { x: 10 - half, y: 10 - half }, pixelsPerField),
      { mode: "scale", corner: 0 });
    assert.deepEqual(selectionTransformAt(box, { x: 10 + half, y: 10 - half }, pixelsPerField),
      { mode: "scale", corner: 1 });
    assert.deepEqual(selectionTransformAt(box, { x: 10 + half, y: 10 + half }, pixelsPerField),
      { mode: "scale", corner: 2 });
    assert.deepEqual(selectionTransformAt(box, { x: 10 - half, y: 10 + half }, pixelsPerField),
      { mode: "scale", corner: 3 });
    assert.deepEqual(selectionTransformAt(box, { x: 12, y: 12 }, pixelsPerField),
      { mode: "move" });
    assert.deepEqual(selectionTransformAt(box, { x: 10 + half + 0.03, y: 10 }, pixelsPerField),
      { mode: "rotate" });
  }
});

test("marquee selects placed graphics by their anchor, independent of visible size and light range", () => {
  const object = { id: "object", kind: "object", x: 3, y: 3,
    width: 2, height: 1.5, rotation: 0 } as MapObject;
  const light = { id: "light", kind: "light", x: 6, y: 3,
    radius: 4 } as Light;
  const get = () => undefined;
  assert.equal(selectionInsideBox(object, { x: 1, y: 2, width: 1.8, height: 2 }, get), false);
  assert.equal(selectionInsideBox(object, { x: 1, y: 2, width: 2.2, height: 2 }, get), true);
  assert.equal(selectionInsideBox(light, { x: 5.5, y: 2.5, width: 0.3, height: 1 }, get), false);
  assert.equal(selectionInsideBox(light, { x: 5.5, y: 2.5, width: 0.7, height: 1 }, get), true);
});

test("marquee requires the entire path extent, as in the native path probe", () => {
  const path: MapPath = {
    id: "path", floorId: "floor", kind: "path",
    points: [{ x: 2, y: 3 }, { x: 7, y: 3 }],
    closed: false, smooth: false, width: 0.25, style: "rope",
    color: 0xffffff, outlineColor: 0, outlineWidth: 0, layer: 100,
    start: "round", end: "round", blocksLight: false,
  };
  const get = () => undefined;
  assert.equal(selectionInsideBox(path, { x: 3, y: 2, width: 3, height: 2 }, get), false);
  assert.equal(selectionInsideBox(path, { x: 1, y: 2, width: 2, height: 2 }, get), false);
  assert.equal(selectionInsideBox(path, { x: 1, y: 2, width: 7, height: 2 }, get), true);
});

test("free wall remains directly clickable but is not captured by a marquee", () => {
  const wall: Wall = {
    id: "wall", floorId: "floor", kind: "wall",
    points: [{ x: 2, y: 3 }, { x: 7, y: 3 }],
    smooth: false, closed: false, color: 0x403e39,
    width: 0.22, layer: 700, shadow: true,
  };
  const get = () => undefined;
  assert.equal(selectionInsideBox(wall, { x: 3, y: 2, width: 3, height: 2 }, get), false);
  assert.equal(selectionInsideBox(wall, { x: 1, y: 2, width: 7, height: 2 }, get), false);
});

test("roof marquee encloses the drawn contour without render padding", () => {
  const roof: Roof = {
    id: "roof", floorId: "floor", kind: "roof",
    points: [{ x: 3, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 7 }, { x: 3, y: 7 }],
    ridge: [{ x: 3.4, y: 6 }, { x: 4.6, y: 6 }],
    roofType: "gable", color: 0x776a60, outlineColor: 0x332b29, layer: 400,
  };
  const get = () => undefined;
  assert.equal(selectionInsideBox(roof, { x: 2.5, y: 4.5, width: 1.5, height: 1.5 }, get), false);
  assert.equal(selectionInsideBox(roof, { x: 2.5, y: 4.5, width: 3, height: 3 }, get), true);
});

test("pattern marquee encloses the contour without a fixed geometric margin", () => {
  const pattern: Surface = {
    id: "pattern", floorId: "floor", kind: "surface", category: "pattern",
    polygons: [{outer: [{x: 3, y: 5}, {x: 5, y: 5},
      {x: 5, y: 7}, {x: 3, y: 7}], holes: []}],
    layer: 100, color: 0x7c6c5d, wallColor: 0, wallWidth: 0,
  };
  const get = () => undefined;
  assert.equal(selectionInsideBox(pattern, {x: 2.5, y: 4.5, width: 1.5, height: 1.5}, get), false);
  assert.equal(selectionInsideBox(pattern, {x: 2.5, y: 4.5, width: 2.5, height: 2.5}, get), true);
  assert.equal(selectionInsideBox(pattern, {x: 3, y: 5, width: 2, height: 2}, get), true);
  assert.equal(selectionInsideBox(pattern, {x: 3.01, y: 5, width: 2, height: 2}, get), false);
  assert.equal(selectionInsideBox(pattern, {x: 3, y: 5.01, width: 2, height: 2}, get), false);
  assert.equal(selectionInsideBox(pattern, {x: 2.5, y: 4.5, width: 3, height: 3}, get), true);
});

test("marquee uses the free portal center but skips wall-anchored portals", () => {
  const free: Door = {
    id: "free", floorId: "floor", kind: "door", x: 3, y: 3,
    width: 1, variant: "door",
  };
  const anchored: Door = {
    ...free,
    id: "anchored",
    x: undefined,
    y: undefined,
    anchor: { boundaryId: "wall", contour: 0, at: 0.5 },
  };
  const get = () => undefined;
  assert.equal(selectionInsideBox(free, { x: 2.2, y: 2.8, width: 0.5, height: 0.4 }, get), false);
  assert.equal(selectionInsideBox(free, { x: 2.9, y: 2.8, width: 0.2, height: 0.4 }, get), true);
  assert.equal(selectionInsideBox(anchored, { x: -10, y: -10, width: 20, height: 20 }, get), false);
});

test("dragging a rotated object's frame keeps its opposite AABB corner fixed through save and undo", async () => {
  const s = new Session(newDocument("Transform", 20, 20)),
    floor = s.floors.values().next().value!.id,
    original = createObject(s, floor, { x: 8, y: 8 }),
    before = { ...original, x: 8, y: 8, width: 4, height: 6,
      rotation: Math.PI / 2 };
  s.execute({ label: "Testform", entities: [{ id: original.id, before: original, after: before }] });
  const after = scaleBoxSelection(before, 2, { x: 11, y: 10 }, { x: 12, y: 11 });
  assert.ok(after.width > before.width);
  assert.ok(after.height > before.height);
  assert.ok(Math.abs(after.width / before.width - after.height / before.height) < 1e-9);
  const opposite = (box: { x: number; y: number; width: number; height: number; rotation: number }) => ({
    x: box.x - (Math.abs(box.width * Math.cos(box.rotation)) +
      Math.abs(box.height * Math.sin(box.rotation))) / 2,
    y: box.y - (Math.abs(box.width * Math.sin(box.rotation)) +
      Math.abs(box.height * Math.cos(box.rotation))) / 2,
  });
  assert.ok(Math.hypot(opposite(after).x - opposite(before).x,
    opposite(after).y - opposite(before).y) < 1e-9);
  const rotated = rotateBoxSelection(after,
    { x: after.x + 2, y: after.y }, { x: after.x, y: after.y + 2 });
  assert.ok(Math.abs((rotated.rotation ?? 0) - after.rotation - Math.PI / 2) < 1e-9);
  s.execute({ label: "Transformieren", entities: [{ id: before.id, before, after }] });
  const store = new MemoryStore(),
    repo = new MapRepository(store, "QA/Transform.dungeon");
  await repo.save(s);
  const reopened = await new MapRepository(store, "QA/Transform.dungeon").open();
  assert.deepEqual(reopened.entities.get(before.id), after);
  s.undo();
  assert.deepEqual(s.entities.get(before.id), before);
});

test("a horizontal-only corner drag does not distort furniture", () => {
  const box = { kind: "object", x: 10, y: 10, width: 4, height: 6,
    rotation: 0 } as MapObject;
  assert.deepEqual(scaleBoxSelection(box, 2,
    { x: 12, y: 13 }, { x: 13, y: 13 }), box);
});

test("native furniture diagonal scaling follows the limiting frame axis at both zooms", () => {
  // The original's grips are about 122 by 161 px apart; its effective limiting height is 161.5 px.
  const frame = { x: 0, y: 0, width: 122, height: 161.5, rotation: 0 },
    start = { x: frame.width / 2, y: frame.height / 2 };
  for (const [zoom, pixels, nativeScale] of [
    [1, 20, 4.495356], [1, 40, 4.990712], [1, 80, 5.981424],
    [2, 20, 4.247678], [2, 40, 4.495356],
  ] as const) {
    const offset = pixels / zoom,
      after = scaleSelectionFrame(frame, 2, start,
        { x: start.x + offset, y: start.y + offset }),
      scale = 4 * after.width / frame.width;
    assert.ok(Math.abs(scale - nativeScale) < 0.000001);
    assert.ok(Math.abs(after.x - after.width / 2 + frame.width / 2) < 1e-9);
    assert.ok(Math.abs(after.y - after.height / 2 + frame.height / 2) < 1e-9);
  }
});

test("a light rotates around its own center and undo restores its saved angle", async () => {
  const session = new Session(newDocument("Light rotation", 20, 20));
  const floor = session.floors.values().next().value!.id;
  const before = createLight(session, floor, { x: 8, y: 8 }, {
    radius: 2, intensity: 1, color: 0xffffff, shadows: false,
  });
  assert.deepEqual(selectionTransformAt(before, { x: 8, y: 8 }, 50), { mode: "move" });
  assert.deepEqual(selectionTransformAt(before, { x: 10, y: 8 }, 40), { mode: "rotate" });
  const after = rotateBoxSelection(before, { x: 10, y: 8 }, { x: 8, y: 10 });
  assert.equal(after.kind, "light");
  assert.equal(after.x, before.x);
  assert.equal(after.y, before.y);
  assert.ok(Math.abs((after.rotation ?? 0) - Math.PI / 2) < 1e-9);
  session.execute({ label: "Licht drehen", entities: [{ id: before.id, before, after }] });
  const repo = new MapRepository(new MemoryStore(), "QA/Light rotation.dungeon");
  await repo.save(session);
  const reopened = await repo.open();
  assert.deepEqual(reopened.entities.get(before.id), after);
  session.undo();
  assert.deepEqual(session.entities.get(before.id), before);
});

test("a light corner scales its selection frame and moves the source without changing its reach", async () => {
  const session = new Session(newDocument("Light frame", 20, 20));
  const floor = session.floors.values().next().value!.id;
  const before = createLight(session, floor, { x: 8, y: 8 }, {
    radius: 2, intensity: 1, color: 0xffffff, shadows: false,
  });
  for (const [corner, x, y] of [
    [0, 7.5, 7.5], [1, 8.5, 7.5],
    [2, 8.5, 8.5], [3, 7.5, 8.5],
  ] as const)
    assert.deepEqual(selectionTransformAt(before, { x, y }, 40),
      { mode: "scale", corner });
  const result = transformSelectionGroup([before], selectionFrame([before])!,
    { mode: "scale", corner: 2 }, { x: 8.5, y: 8.5 }, { x: 9, y: 9 });
  const after = result.entities[0] as Light;
  assert.equal(after.x, 8.25);
  assert.equal(after.y, 8.25);
  assert.equal(after.radius, before.radius);
  assert.equal(after.intensity, before.intensity);
  assert.equal(after.rotation, before.rotation);
  assert.equal(result.frame.width, 1.5);
  session.execute({ label: "Lichtrahmen skalieren", entities: [{ id: before.id, before, after }] });
  const repo = new MapRepository(new MemoryStore(), "QA/Light frame.dungeon");
  await repo.save(session);
  const reopened = await repo.open();
  assert.deepEqual(reopened.entities.get(before.id), after);
  session.undo();
  assert.deepEqual(session.entities.get(before.id), before);
});

test("a light uses the native fixed grip radius at 50, 75 and 100 percent zoom", () => {
  const light = { kind: "light", x: 8, y: 8, rotation: 0 } as Light;
  const frame = selectionFrame([light])!;
  const at = (point: { x: number; y: number }, scale: number) => {
    const expected = selectionTransformAt(light, point, scale);
    assert.deepEqual(selectionFrameTransformAt(frame, point, scale, "light"), expected);
    return expected;
  };
  assert.deepEqual(at({ x: 8, y: 8 }, 32), { mode: "scale", corner: 0 });
  assert.deepEqual(at({ x: 8 + 0.01 / 32, y: 8 + 0.01 / 32 }, 32),
    { mode: "scale", corner: 0 });
  assert.deepEqual(at({ x: 8, y: 7.5 }, 32), { mode: "scale", corner: 0 });
  assert.deepEqual(at({ x: 8 + 15 / 32, y: 7.5 }, 32),
    { mode: "scale", corner: 0 });
  assert.deepEqual(at({ x: 8.5, y: 7.5 }, 32),
    { mode: "scale", corner: 1 });
  assert.deepEqual(at({ x: 8.5, y: 8 + 15 / 32 }, 32),
    { mode: "scale", corner: 1 });
  assert.deepEqual(at({ x: 8.5, y: 8.5 }, 32),
    { mode: "scale", corner: 2 });
  assert.deepEqual(at({ x: 8 - 15 / 32, y: 8.5 }, 32),
    { mode: "scale", corner: 2 });
  assert.deepEqual(at({ x: 7.5, y: 8.5 }, 32),
    { mode: "scale", corner: 3 });
  for (const pixelsPerField of [48, 64]) {
    assert.deepEqual(at({ x: 8, y: 8 }, pixelsPerField), { mode: "move" });
    for (const [corner, sign] of [[0, -1], [2, 1]] as const) {
      const near = 8 + sign * (0.5 - 22 / pixelsPerField);
      const far = 8 + sign * (0.5 - 23 / pixelsPerField);
      assert.deepEqual(at({ x: near, y: near }, pixelsPerField),
        { mode: "scale", corner });
      assert.deepEqual(at({ x: far, y: far }, pixelsPerField),
        { mode: "move" });
    }
  }
});

test("a mixed selection rotates and scales one frame without changing light reach", async () => {
  const session = new Session(newDocument("Group transform", 20, 20));
  const floor = session.floors.values().next().value!.id;
  const object = createObject(session, floor, { x: 3, y: 3 });
  const light = createLight(session, floor, { x: 9, y: 3 }, {
    radius: 1.5, intensity: 1, color: 0xffffff, shadows: false,
  });
  const frame = selectionFrame([object, light])!;
  assert.ok(frame.x < 9);
  assert.ok(frame.x > 3);
  const rotated = transformSelectionGroup([object, light], frame,
    { mode: "rotate" },
    { x: frame.x + 4, y: frame.y }, { x: frame.x, y: frame.y + 4 });
  const [rotatedObject, rotatedLight] = rotated.entities;
  assert(rotatedObject?.kind === "object" && rotatedLight?.kind === "light");
  assert.ok(Math.abs(rotatedObject.rotation - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs((rotatedLight.rotation ?? 0) - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(rotatedLight.x - rotatedObject.x) < 1e-9);
  assert.ok(Math.abs(rotatedLight.y - rotatedObject.y - 6) < 1e-9);
  assert.equal(rotatedLight.radius, light.radius);
  const start = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
  const scaled = transformSelectionGroup([object, light], frame,
    { mode: "scale", corner: 2 }, start,
    { x: start.x + 1, y: start.y + 1 });
  const [scaledObject, scaledLight] = scaled.entities;
  assert(scaledObject?.kind === "object" && scaledLight?.kind === "light");
  const factor = scaledObject.width / object.width;
  assert.ok(factor > 1);
  assert.ok(Math.abs(scaledObject.height / object.height - factor) < 1e-9);
  assert.ok(Math.abs((scaledLight.x - scaledObject.x) / (light.x - object.x) - factor) < 1e-9);
  assert.equal(scaledLight.radius, light.radius);
  assert.ok(Math.abs(scaled.frame.x - scaled.frame.width / 2 -
    (frame.x - frame.width / 2)) < 1e-9);
  assert.ok(Math.abs(scaled.frame.y - scaled.frame.height / 2 -
    (frame.y - frame.height / 2)) < 1e-9);
  session.execute({ label: "Gruppe skalieren", entities: [
    { id: object.id, before: object, after: scaledObject },
    { id: light.id, before: light, after: scaledLight },
  ] });
  const repo = new MapRepository(new MemoryStore(), "QA/Group transform.dungeon");
  await repo.save(session);
  const reopened = await repo.open();
  assert.deepEqual(reopened.entities.get(object.id), scaledObject);
  assert.deepEqual(reopened.entities.get(light.id), scaledLight);
  session.undo();
  assert.deepEqual(session.entities.get(object.id), object);
  assert.deepEqual(session.entities.get(light.id), light);
});
import {
  compactObjectVisible,
  gridStep,
  objectNearViewport,
  fieldMeasurementLabel,
  pathRenderGroup,
  roomMeasurement,
} from "../src/rendering";

test("compact overview reveals decorations and linked markers only when legible", () => {
  const decoration = { width: 1, height: 0.8, label: "", note: undefined };
  assert.equal(compactObjectVisible(decoration, 2), false);
  assert.equal(compactObjectVisible(decoration, 10), true);
  assert.equal(compactObjectVisible({ ...decoration, label: "A" }, 10), false);
  assert.equal(compactObjectVisible({ ...decoration, label: "A" }, 12), true);
  assert.equal(
    compactObjectVisible({ ...decoration, note: { path: "Räume/1.md" } }, 2),
    false,
  );
});

test("object viewport culling keeps rotated objects near the screen edge", () => {
  const camera = { x: 0, y: 0, scale: 10 };
  const viewport = { width: 100, height: 100 };
  assert.equal(
    objectNearViewport({ x: 5, y: 5, width: 2, height: 2 }, camera, viewport),
    true,
  );
  assert.equal(
    objectNearViewport({ x: -4, y: 5, width: 2, height: 2 }, camera, viewport),
    true,
  );
  assert.equal(
    objectNearViewport({ x: -10, y: 5, width: 2, height: 2 }, camera, viewport),
    false,
  );
  assert.equal(
    objectNearViewport({ x: 20, y: 5, width: 2, height: 2 }, camera, viewport),
    false,
  );
});

test("overview grid spacing follows zoom while detail grid keeps every field", () => {
  assert.equal(gridStep(2.15), 10);
  assert.equal(gridStep(5.01), 5);
  assert.equal(gridStep(8), 1);
});

test("locked map elements need Alt for direct selection", () => {
  const types = new Set<SelectionType>(["objects"]);
  const layers = new Set(selectionLayers.map(([value]) => value));
  const locked = { kind: "object", locked: true, layer: 100 } as Entity;
  assert.equal(selectableByClick(locked, types, layers, false), false);
  assert.equal(selectableByClick(locked, types, layers, true), true);
  assert.equal(selectableByClick({ ...locked, locked: false }, types, layers, false), true);
  assert.equal(selectableByClick({ kind: "door" } as Entity, types, layers, true), false);
});

test("selection type and layer filters intersect without treating object locks as layers", () => {
  const object = { kind: "object", layer: 100 } as Entity;
  const light = { kind: "light", locked: true } as Entity;
  const path = { kind: "path", layer: 80 } as Entity;
  const room = { kind: "building" } as Entity;
  const material = { kind: "surface", category: "material", layer: 500 } as Entity;
  const pattern = { kind: "surface", category: "pattern", layer: 500 } as Entity;
  assert.equal(selectionLayer(object), "100");
  assert.equal(selectionLayer(light), "fixed");
  assert.equal(selectionLayer(path), "100");
  assert.equal(selectionLayer(room), "fixed");
  assert.equal(selectionLayer(material), "400");
  assert.equal(selectionType(room), "walls");
  assert.equal(selectionType(material), "materials");
  assert.equal(selectionType(pattern), "patterns");
  assert.equal(selectionAllowed(material,new Set(["patterns"]),new Set(["400"])),false);
  assert.equal(selectionAllowed(material,new Set(["materials"]),new Set(["400"])),true);
  assert.equal(selectionType({ kind: "surface", category: "water" } as Entity), "water");
  const types = new Set<SelectionType>(["objects", "lights"]);
  const fixed = new Set(["fixed"] as const);
  assert.equal(selectionAllowed(light, types, fixed), true);
  assert.equal(selectionAllowed(object, types, fixed), false);
  assert.equal(selectionAllowed(room, types, fixed), false);
  assert.equal(selectableByClick(light, types, fixed, false), false);
  assert.equal(selectableByClick(light, types, fixed, true), true);
  assert.equal(selectionAllowed(room, new Set(["walls"]), fixed), true);
});


test("mirroring an object selection is one undoable edit and leaves locked and non-object elements alone", () => {
  const session = new Session(newDocument("Spiegelprobe", 12, 12)),
    floor = session.floors.values().next().value!.id,
    first = createObject(session, floor, { x: 2, y: 3 }),
    second = createObject(session, floor, { x: 5, y: 3 }),
    light = createLight(session, floor, { x: 7, y: 3 }, {
      radius: 3,
      intensity: 1,
      color: 0xeccd8b,
      shadows: false,
    });
  session.setLocked(second.id, true);
  const changes = selectionMirrorChanges([
    session.entities.get(first.id)!,
    session.entities.get(second.id)!,
    session.entities.get(light.id)!,
  ]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0]!.before, session.entities.get(first.id));
  const history = session.historySize;
  session.execute({
    label: "Auswahl spiegeln",
    entities: changes.map(({ before, after }) => ({
      id: before.id,
      before,
      after,
    })),
  });
  assert.equal(session.historySize, history + 1);
  assert.equal((session.entities.get(first.id) as MapObject).flip, true);
  assert.equal((session.entities.get(second.id) as MapObject).flip, undefined);
  assert.equal(session.entities.get(light.id)?.kind, "light");
  session.undo();
  assert.equal((session.entities.get(first.id) as MapObject).flip, undefined);
  session.redo();
  assert.equal((session.entities.get(first.id) as MapObject).flip, true);
  const reopened = parseDocument(JSON.stringify(session.document()));
  assert.equal(
    (reopened.entities.find((entity) => entity.id === first.id) as MapObject).flip,
    true,
  );
});

test("stack order changes are visible, undoable, saveable and dirty without changing object fields", () => {
  const session = new Session(newDocument("Reihenfolge", 12, 12));
  const floor = session.floors.values().next().value!.id;
  const first = createObject(session, floor, { x: 4, y: 4 });
  const second = createObject(session, floor, { x: 4, y: 4 });
  const third = createObject(session, floor, { x: 4, y: 4 });
  session.markSaved(session.snapshot());
  assert.equal(session.dirty, false);
  const original = session.document();
  const change = selectionStackChange(session.entities, first.id, "front");
  assert(change);
  let orderChanged = false;
  session.subscribe((event) => { orderChanged ||= event.entityOrder; });
  session.execute({ label: "Nach vorn", entities: [change] });
  assert.deepEqual([...session.entities.keys()], [second.id, third.id, first.id]);
  assert.equal(orderChanged, true);
  assert.equal(session.dirty, true);
  assert.deepEqual(session.entities.get(first.id), original.entities[0]);
  assert.equal(selectionStackChange(session.entities, first.id, "front"), undefined);
  session.undo();
  assert.deepEqual(session.document(), original);
  assert.equal(session.dirty, false);
  session.redo();
  assert.deepEqual([...session.entities.keys()], [second.id, third.id, first.id]);
  assert.equal(session.dirty, true);
  session.markSaved(session.snapshot());
  assert.equal(session.dirty, false);
  assert.deepEqual(parseDocument(JSON.stringify(session.document())).entities.map((e) => e.id),
    [second.id, third.id, first.id]);
  session.undo();
  assert.equal(session.dirty, true);
  session.redo();
  assert.equal(session.dirty, false);
});

test("front and back reorder objects across numeric layers as Dungeondraft stores them", () => {
  const session = new Session(newDocument("Ebenenfolge", 12, 12));
  const floor = session.floors.values().next().value!.id;
  const first = createObject(session, floor, {x:4,y:4});
  const middle = createObject(session, floor, {x:4,y:4});
  const last = createObject(session, floor, {x:4,y:4});
  const higher = session.entities.get(middle.id)! as MapObject;
  session.execute({label:"Andere Ebene",entities:[{
    id:middle.id,before:higher,after:{...higher,layer:200},
  }]});
  const back = selectionStackChange(session.entities,last.id,"back");
  assert(back);
  session.execute({label:"Nach hinten",entities:[back]});
  assert.deepEqual([...session.entities.keys()],[last.id,first.id,middle.id]);
  const front = selectionStackChange(session.entities,last.id,"front");
  assert(front);
  session.execute({label:"Nach vorn",entities:[front]});
  assert.deepEqual([...session.entities.keys()],[first.id,middle.id,last.id]);
  session.undo();
  assert.deepEqual([...session.entities.keys()],[last.id,first.id,middle.id]);
});

test("a saved drawing prefab retains light properties without carrying map note links", () => {
  const session = new Session(newDocument("Vorlage", 12, 12));
  const floor = session.floors.values().next().value!.id;
  const light = createLight(session, floor, { x: 3, y: 4 }, {
    radius: 2.5, intensity: 0.7, color: 0xeccd8b, shadows: true,
  });
  const source = session.entities.get(light.id)!;
  const tagged = { ...source, note: { path: "Dungeons/Quelle.md" }, roomId: "room-a" };
  const prefab = createPrefab("Beispiele", "Fackel", [tagged],
    (id) => session.entities.get(id), () => "prefab-1");
  assert.equal(prefab.entities[0]?.kind, "light");
  assert.equal(prefab.entities[0]?.prefabId, undefined);
  assert.equal(prefab.entities[0]?.note, undefined);
  assert.equal(prefab.entities[0]?.roomId, undefined);
  const copies = placePrefab(prefab, { x: 8, y: 7 }, floor, () => "copy-1");
  assert.equal(copies[0]?.kind, "light");
  assert.deepEqual([copies[0]?.id,copies[0]?.prefabId], ["copy-1","prefab-1"]);
  session.execute({label:"Vorlage einsetzen",entities:copies.map((entity) => ({
    id:entity.id,before:null,after:entity,
  }))});
  assert.deepEqual(session.entities.get(light.id),source);
  assert.deepEqual(session.entities.get("copy-1"),{
    ...source,id:"copy-1",x:8,y:7,groupId:undefined,prefabId:"prefab-1",
    roomId:undefined,note:undefined,
  });
  session.undo();
  assert.equal(session.entities.has("copy-1"),false);
  session.redo();
  assert.equal(parseDocument(JSON.stringify(session.document())).entities.at(-1)?.id,"copy-1");
});

test("a mixed object and light prefab preserves their offset and places both in one undo step", () => {
  const session = new Session(newDocument("Gemischte Vorlage", 12, 12));
  const floor = session.floors.values().next().value!.id;
  const object = createObject(session, floor, { x: 3, y: 3 });
  const light = createLight(session, floor, { x: 9, y: 3 }, {
    radius: 0.8, intensity: 1, color: 0xeccd8b, shadows: false,
  });
  const sources = [session.entities.get(object.id)!, session.entities.get(light.id)!];
  const prefab = createPrefab("Beispiele", "Möbellicht", sources,
    (id) => session.entities.get(id), () => "mixed-prefab");
  assert.deepEqual(prefab.entities.map((entity) => entity.kind), ["object", "light"]);
  const ids = ["mixed-object", "mixed-light"];
  const copies = placePrefab(prefab, { x: 6, y: 7 }, floor, () => ids.shift()!);
  const [newObject, newLight] = copies;
  assert(newObject?.kind === "object" && newLight?.kind === "light");
  assert.deepEqual([newLight.x - newObject.x, newLight.y - newObject.y], [6, 0]);
  assert(copies.every((entity) => entity.prefabId === prefab.id));
  session.execute({ label: "Gemischte Vorlage einsetzen", entities: copies.map((entity) => ({
    id: entity.id, before: null, after: entity,
  })) });
  session.undo();
  assert(copies.every((entity) => !session.entities.has(entity.id)));
  session.redo();
  assert(copies.every((entity) => session.entities.has(entity.id)));
});

test("a copied selection immediately lands at the viewport center, including repeat paste", () => {
  const object = {
    id: "object",
    kind: "object",
    x: 2,
    y: 3,
    width: 2,
    height: 2,
    rotation: 0,
  } as Entity;
  const light = {
    id: "light",
    kind: "light",
    x: 6,
    y: 7,
    radius: 1,
  } as Entity;
  const source = selectionCenter([object, light], () => undefined);
  assert.deepEqual(source, { x: 3.75, y: 4.75 });
  assert.deepEqual(selectionCenter([light], () => undefined), { x: 6, y: 7 });
  const viewport = { x: 10, y: 12 },
    paste = (entity: Entity) =>
      moveEntity(entity, viewport.x - source!.x, viewport.y - source!.y);
  assert.deepEqual(
    selectionCenter([paste(object), paste(light)], () => undefined),
    viewport,
  );
  const singleCenter = selectionCenter([light], () => undefined)!;
  const firstPaste = moveEntity(light, viewport.x - singleCenter.x, viewport.y - singleCenter.y) as Light;
  const secondPaste = moveEntity(light, viewport.x - singleCenter.x, viewport.y - singleCenter.y) as Light;
  assert.deepEqual([firstPaste.x, firstPaste.y], [10, 12]);
  assert.deepEqual([secondPaste.x, secondPaste.y], [10, 12]);
});

test("native light copy and repeated paste create separate undoable sources at the same viewport center", () => {
  const doc = newDocument("Auswahl", 32, 32),
    session = new Session(doc),
    floorId = doc.floors[0]!.id,
    source = createLight(session, floorId, { x: 14.0625, y: 8.40625 }, {
      radius: 5.1,
      intensity: 1,
      color: 0xeccd8b,
      shadows: true,
    }),
    sourceCenter = selectionCenter([source], (id) => session.entities.get(id))!,
    viewportCenter = { x: 17.5, y: 10 };
  let counter = 0;
  for (let paste = 0; paste < 2; paste++) {
    const [copy] = copyAtViewportCenter(
      [source],
      sourceCenter,
      viewportCenter,
      floorId,
      () => `copy-${++counter}`,
    );
    assert.equal(copy?.kind, "light");
    assert.deepEqual([copy.x, copy.y], [17.5, 10]);
    session.execute({
      label: "Elemente einfügen",
      entities: [{ id: copy.id, before: null, after: copy }],
    });
  }
  assert.equal(session.entities.size, 3);
  assert.equal(session.entities.get(source.id)?.kind, "light");
  session.undo();
  assert.equal(session.entities.size, 2);
  session.undo();
  assert.equal(session.entities.size, 1);
  session.redo();
  session.redo();
  assert.equal(session.entities.size, 3);
  assert.deepEqual(
    ["copy-1", "copy-2"].map((id) => {
      const copy = session.entities.get(id);
      return copy?.kind === "light" ? [copy.x, copy.y] : null;
    }),
    [[17.5, 10], [17.5, 10]],
  );
});

test("clipboard freezes a portal pose when its wall is not copied and remaps it when the wall is copied", () => {
  const doc = newDocument("Durchgang", 32, 32),
    session = new Session(doc),
    floorId = doc.floors[0]!.id,
    wall = createWall(session, floorId, [
      { x: 2, y: 2 },
      { x: 8, y: 2 },
    ]),
    portal = createPortal(
      session,
      floorId,
      { boundary: wall, anchor: { contour: 0, at: 0.5 } },
      { variant: "door", width: 1, blocksLight: true },
    ),
    originalPose = portalPose(portal, (id) => session.entities.get(id)),
    get = (id: string) => session.entities.get(id),
    viewport = { x: 18, y: 15 };
  const single = captureSelectionClipboard([portal], get);
  assert.equal(single.entities[0]?.kind, "door");
  const detached = single.entities[0];
  if (detached?.kind !== "door") throw new Error("Durchgang fehlt.");
  assert.equal(detached.anchor, undefined);
  assert.deepEqual([detached.x, detached.y], [originalPose.x, originalPose.y]);
  const [freeCopy] = copyAtViewportCenter(
    single.entities,
    single.center!,
    viewport,
    floorId,
    () => "free-copy",
  );
  assert.equal(freeCopy?.kind, "door");
  if (freeCopy?.kind !== "door") throw new Error("Kopie fehlt.");
  assert.deepEqual([freeCopy.x, freeCopy.y], [18, 15]);

  const together = captureSelectionClipboard([wall, portal], get);
  let next = 0;
  const copies = copyAtViewportCenter(
    together.entities,
    together.center!,
    viewport,
    floorId,
    () => `pair-${++next}`,
  );
  const copiedWall = copies.find((entity) => entity.kind === "wall"),
    copiedPortal = copies.find((entity) => entity.kind === "door");
  assert.equal(copiedPortal?.kind, "door");
  if (copiedPortal?.kind !== "door" || !copiedWall)
    throw new Error("Verbund fehlt.");
  assert.equal(copiedPortal.anchor?.boundaryId, copiedWall.id);
  const expectedDx = viewport.x - together.center!.x,
    expectedDy = viewport.y - together.center!.y,
    pose = portalPose(copiedPortal, (id) =>
      copies.find((entity) => entity.id === id),
    );
  assert.deepEqual([pose.x, pose.y], [originalPose.x + expectedDx, originalPose.y + expectedDy]);
});

test("touchpad wheel navigation zooms vertically at a bounded rate and keeps horizontal pan", () => {
  const vertical = wheelNavigation({
    deltaX: 0,
    deltaY: 18,
    deltaMode: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  });
  assert.equal(vertical.kind, "zoom");
  if (vertical.kind === "zoom") assert.ok(vertical.factor < 1);

  const pinch = wheelNavigation({
    deltaX: 30,
    deltaY: -8,
    deltaMode: 0,
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
  });
  assert.equal(pinch.kind, "zoom");
  if (pinch.kind === "zoom") assert.ok(pinch.factor > 1);

  assert.deepEqual(
    wheelNavigation({
      deltaX: 12,
      deltaY: 2,
      deltaMode: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    }),
    { kind: "pan", x: -12, y: -2 },
  );
  assert.deepEqual(
    wheelNavigation({
      deltaX: 0,
      deltaY: 3,
      deltaMode: 1,
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
    }),
    { kind: "pan", x: -0, y: -48 },
  );
});

test("compact reading map keeps the established ctrl-wheel contract", () => {
  assert.deepEqual(compactWheelNavigation({ deltaY: 18, ctrlKey: false }), {
    kind: "none",
  });
  assert.deepEqual(compactWheelNavigation({ deltaY: 0, ctrlKey: true }), {
    kind: "none",
  });
  assert.deepEqual(compactWheelNavigation({ deltaY: 18, ctrlKey: true }), {
    kind: "zoom",
    viewFactor: 1.15,
  });
  assert.deepEqual(compactWheelNavigation({ deltaY: -18, ctrlKey: true }), {
    kind: "zoom",
    viewFactor: 1 / 1.15,
  });
});

test("walkable paths compose as ground while line symbols stay above rooms", () => {
  assert.equal(pathRenderGroup({ style: "road" }), "ground");
  for (const style of ["rope", "rail", "stones", "hedge"] as const)
    assert.equal(pathRenderGroup({ style }), "detail");
});

test("focused room measurements use the maximum exterior width and depth", () => {
  const measurement = roomMeasurement({
    polygons: [{
      outer: [
        { x: 3, y: 2 },
        { x: 10.5, y: 2 },
        { x: 10.5, y: 6 },
        { x: 7, y: 6 },
        { x: 7, y: 11 },
        { x: 3, y: 11 },
      ],
      holes: [],
    }],
  });
  assert.deepEqual(measurement, { x: 3, y: 2, width: 7.5, height: 9 });
  assert.equal(fieldMeasurementLabel(measurement.width), "7,5 Felder");
  assert.equal(fieldMeasurementLabel(measurement.height), "9 Felder");
  assert.equal(fieldMeasurementLabel(1), "1 Feld");
});
import {
  MapRepository,
  FileConflict,
  type FileStore,
} from "../src/persistence";
import {
  boundarySegments,
  alignedPortalAt,
  inside,
  portalPose,
  smoothPath,
  hit,
  moveEntity,
  nearestPath,
  rectangle,
  reanchorPortal,
  buildingContourEntries,
  nearestBuildingVertex,
  nearestBuildingSegment,
  replaceBuildingContour,
} from "../src/geometry";

test("bound portals snap to the center of a matching corridor endpoint", () => {
  const room = {
      id: "room",
      kind: "building" as const,
      floorId: "floor",
      number: "1",
      name: "Eingang",
      note: { path: "Dungeons/Test/Räume/01 Eingang.md" },
      polygons: [{
        outer: rectangle({ x: 0, y: 0 }, { x: 7, y: 7 }),
        holes: [],
      }],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    },
    corridor = {
      id: "corridor",
      kind: "path" as const,
      floorId: "floor",
      points: [
        { x: 3.5, y: 0 },
        { x: 3.5, y: -5 },
      ],
      width: 3,
      style: "road" as const,
      color: 0xffffff,
      outlineColor: 0,
      outlineWidth: 0.1,
      layer: 0,
      start: "round" as const,
      end: "round" as const,
      blocksLight: false,
      smooth: false,
      closed: false,
    };
  assert.deepEqual(
    alignedPortalAt({ x: 3.1, y: 0 }, room, [corridor], 3),
    { contour: 0, at: 0.125 },
  );
  assert.notDeepEqual(
    alignedPortalAt({ x: 3.1, y: 0 }, room, [corridor], 1),
    { contour: 0, at: 0.125 },
  );
});
import { composeBuilding, paint, visibility } from "../src/compute";
import { floorEraseActive } from "../src/drawing";

test("floor erase state follows the persistent mode and transient Alt modifier", () => {
  assert.equal(floorEraseActive("draw", false), false);
  assert.equal(floorEraseActive("draw", true), true);
  assert.equal(floorEraseActive("erase", false), true);
  assert.equal(floorEraseActive("erase", true), true);
});

test("building keeps multiple parts, holes and the same id when assigned a room key", () => {
  const document = newDocument("Gebäudeaggregat", 40, 40),
    session = new Session(document),
    floorId = document.floors[0]!.id,
    polygons = [
      {
        outer: rectangle({ x: 1, y: 1 }, { x: 12, y: 12 }),
        holes: [rectangle({ x: 4, y: 4 }, { x: 7, y: 7 })],
      },
      {
        outer: rectangle({ x: 18, y: 2 }, { x: 24, y: 8 }),
        holes: [],
      },
    ],
    building = createBuilding(session, floorId, polygons, {
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    }),
    room = adoptFloorAsRoom(
      session,
      building.id,
      "QA/Räume",
      {},
      "QA/Gebäudeaggregat.dungeon",
    );
  assert.equal(session.document().version, 3);
  assert.equal(room.id, building.id);
  assert.deepEqual(room.polygons, polygons);
  assert.equal(isRoom(room), true);
  session.undo();
  const restored = session.entities.get(building.id);
  assert.equal(restored?.kind, "building");
  assert.equal(isRoom(restored), false);
  if (restored?.kind !== "building") throw new Error("Gebäude fehlt.");
  assert.deepEqual(restored.polygons, polygons);
  assert.equal(session.note(room.note.path), null);
});

test("room assignment binds existing building portals and creates their key blocks atomically", () => {
  const document = newDocument("Portale vor Raum", 30, 30),
    session = new Session(document),
    floorId = document.floors[0]!.id,
    building = createBuilding(session, floorId, [{
      outer: rectangle({ x: 2, y: 2 }, { x: 12, y: 10 }),
      holes: [],
    }], {
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    }),
    northDoor = createPortal(session, floorId,
      { boundary: building, anchor: { contour: 0, at: 0.125 } },
      { variant: "door", width: 1, blocksLight: true,
        passage: { description: "Steintür", state: "locked", hidden: true,
          hiddenDC: 14, hp: 20, ac: 15, key: "Messingschlüssel" } },
    ),
    westOpening = createPortal(session, floorId,
      { boundary: building, anchor: { contour: 0, at: 0.875 } },
      { variant: "opening", width: 1, blocksLight: false },
    ),
    room = adoptFloorAsRoom(session, building.id, "QA/Räume"),
    key = session.note(room.note.path)!;
  assert.equal(northDoor.note, undefined);
  assert.equal(westOpening.note, undefined);
  assert.match(key, new RegExp(`\\^durchgang-${northDoor.id}`));
  assert.match(key, new RegExp(`\\^durchgang-${westOpening.id}`));
  assert.match(key, /Steintür\. Verschlossen\. Versteckt \(SG 14\)\. 20 HP, RK 15\. Schlüssel: Messingschlüssel\./);
  for (const id of [northDoor.id, westOpening.id]) {
    const door = session.entities.get(id);
    assert.equal(door?.kind, "door");
    if (door?.kind !== "door") continue;
    assert.equal(door.note?.path, room.note.path);
    assert.ok(door.passage?.direction);
  }
  const finalDocument = session.document();
  session.undo();
  assert.equal(session.note(room.note.path), null);
  assert.deepEqual(session.entities.get(northDoor.id), northDoor);
  assert.deepEqual(session.entities.get(westOpening.id), westOpening);
  assert.equal(isRoom(session.entities.get(building.id)), false);
  session.redo();
  assert.equal(session.note(room.note.path), key);
  assert.deepEqual(session.document(), finalDocument);
  assert.deepEqual(parseDocument(JSON.stringify(finalDocument)), finalDocument);
});

test("room assignment refuses to replace an existing portal key reference", () => {
  const document = newDocument("Geschützter Durchgang", 20, 20),
    session = new Session(document),
    floorId = document.floors[0]!.id,
    building = createBuilding(session, floorId, [{
      outer: rectangle({ x: 2, y: 2 }, { x: 10, y: 10 }),
      holes: [],
    }], { layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2 }),
    door = createPortal(session, floorId,
      { boundary: building, anchor: { contour: 0, at: 0.125 } },
      { variant: "door", width: 1, blocksLight: true },
    ),
    existing = { ...door, note: { path: "QA/Andere.md", anchor: "alter-anker" } };
  session.loadNote("QA/Andere.md", "Bewahrter Text.\r\n");
  session.execute({ label: "Vorhandenen Verweis setzen", entities: [
    { id: door.id, before: door, after: existing },
  ] });
  const before = session.document();
  assert.throws(
    () => adoptFloorAsRoom(session, building.id, "QA/Räume"),
    /anderen Key-Verweis/,
  );
  assert.deepEqual(session.document(), before);
  assert.equal(session.note("QA/Andere.md"), "Bewahrter Text.\r\n");
  assert.equal(isRoom(session.entities.get(building.id)), false);
});

test("building room metadata is all-or-nothing", () => {
  const document = newDocument("Raumidentität", 20, 20),
    floorId = document.floors[0]!.id,
    partial: Building = {
      id: "partial-room",
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x: 1, y: 1 }, { x: 5, y: 5 }),
        holes: [],
      }],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
      name: "Unvollständig",
    };
  assert.throws(
    () => new Session({ ...document, entities: [partial] }),
    /Gebäudedaten/,
  );
});

test("portal anchors address one building contour and reject missing contours", () => {
  const document = newDocument("Konturportal", 30, 30),
    session = new Session(document),
    floorId = document.floors[0]!.id,
    building = createBuilding(
      session,
      floorId,
      [{
        outer: rectangle({ x: 1, y: 1 }, { x: 12, y: 12 }),
        holes: [rectangle({ x: 3, y: 3 }, { x: 7, y: 7 })],
      }],
      {
        layer: 200,
        fill: 0xbfb09a,
        wall: 0x403e39,
        wallWidth: 0.2,
      },
    ),
    door = createPortal(
      session,
      floorId,
      { boundary: building, anchor: { contour: 1, at: 0.125 } },
      { variant: "door", width: 2, blocksLight: true },
    ),
    pose = portalPose(door, (id) => session.entities.get(id));
  assert.deepEqual(pose, { x: 5, y: 3, angle: 0 });
  assert.equal(boundarySegments(building, [door]).length, 9);
  assert.deepEqual(
    parseDocument(JSON.stringify(session.document())).entities.find(
      (entity) => entity.id === door.id,
    ),
    door,
  );
  assert.throws(
    () =>
      createPortal(
        session,
        floorId,
        { boundary: building, anchor: { contour: 2, at: 0.5 } },
        { variant: "door", width: 1, blocksLight: true },
      ),
    /Wandbindung/,
  );
});

test("portal reanchoring follows point edits but survives booleans only on retained walls", () => {
  const document = newDocument("Portalabgleich", 30, 30),
    session = new Session(document),
    floorId = document.floors[0]!.id,
    before = createBuilding(
      session,
      floorId,
      [{
        outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
        holes: [],
      }],
      {
        layer: 200,
        fill: 0xbfb09a,
        wall: 0x403e39,
        wallWidth: 0.2,
      },
    ),
    door = createPortal(
      session,
      floorId,
      { boundary: before, anchor: { contour: 0, at: 0.125 } },
      { variant: "door", width: 1, blocksLight: true },
    ),
    extended: Building = {
      ...before,
      polygons: [{
        outer: rectangle({ x: 0, y: 0 }, { x: 12, y: 10 }),
        holes: [],
      }],
    },
    retained = reanchorPortal(door, before, extended, "survive");
  assert.ok(retained);
  assert.deepEqual(
    portalPose(retained, (id) => (id === extended.id ? extended : undefined)),
    { x: 5, y: 0, angle: 0 },
  );
  const moved: Building = {
      ...before,
      polygons: [{
        outer: [
          { x: 0, y: 1 },
          { x: 10, y: 1 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        holes: [],
      }],
    },
    followed = reanchorPortal(door, before, moved, "follow");
  assert.ok(followed);
  assert.equal(
    portalPose(followed, (id) => (id === moved.id ? moved : undefined)).y,
    1,
  );
  const cut: Building = {
    ...before,
    polygons: [{
      outer: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
        { x: 6, y: 2 },
        { x: 6, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      holes: [],
    }],
  };
  assert.equal(reanchorPortal(door, before, cut, "survive"), null);
});

test("building draw keeps the sole room id and commits portal loss without touching key bytes", () => {
  const document = newDocument("Atomarer Grundriss", 30, 30),
    floorId = document.floors[0]!.id,
    style = {
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    },
    plain: Building = {
      id: "plain-first",
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x: 9, y: 0 }, { x: 16, y: 10 }),
        holes: [],
      }],
      ...style,
    },
    room: Building = {
      id: "numbered-later",
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
        holes: [],
      }],
      number: "7",
      name: "Sonderraum",
      note: { path: "QA/Räume/07 Sonderraum.md" },
      ...style,
    },
    kept: Door = {
      id: "kept-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: room.id, contour: 0, at: 0.875 },
      width: 1,
      variant: "door",
    },
    lost: Door = {
      id: "lost-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: plain.id, contour: 0, at: 29 / 34 },
      width: 1,
      variant: "door",
    },
    session = new Session({
      ...document,
      entities: [plain, room, kept, lost],
    }),
    keyBytes = "---\r\nroom_id: \"numbered-later\"\r\n---\r\n# 7  Sonderraum!\r\n\r\n- Tür:  unverändert.\r\n";
  session.loadNote(room.note!.path, keyBytes);
  const beforeEntities = session.document().entities,
    beforePose = portalPose(kept, (id) => session.entities.get(id)),
    result = composeBuilding({
      kind: "compose-building",
      sources: [
        { id: plain.id, polygons: plain.polygons },
        { id: room.id, polygons: room.polygons },
      ],
      shape: [{
        outer: rectangle({ x: 8, y: 4 }, { x: 11, y: 6 }),
        holes: [],
      }],
      erase: false,
    }),
    plan = planBuildingMutation({
      entities: [...session.entities.values()],
      floorId,
      result,
      expectedRevision: session.revision,
      currentRevision: session.revision,
    });
  assert.equal(plan.selectedId, room.id);
  assert.ok(plan.command);
  assert.equal(Object.hasOwn(plan.command!, "texts"), false);
  session.execute(plan.command!);
  assert.equal(session.historySize, 1);
  assert.equal(session.entities.has(plain.id), false);
  assert.equal(isRoom(session.entities.get(room.id)), true);
  assert.equal(session.entities.has(lost.id), false);
  const keptAfter = session.entities.get(kept.id);
  assert.equal(keptAfter?.kind, "door");
  if (keptAfter?.kind !== "door") throw new Error("Portal fehlt.");
  assert.equal(keptAfter.anchor?.boundaryId, room.id);
  const afterPose = portalPose(keptAfter, (id) => session.entities.get(id));
  assert.ok(Math.abs(afterPose.x - beforePose.x) < 1e-8);
  assert.ok(Math.abs(afterPose.y - beforePose.y) < 1e-8);
  assert.equal(session.note(room.note!.path), keyBytes);
  const afterEntities = session.document().entities;

  session.undo();
  assert.deepEqual(session.document().entities, beforeEntities);
  assert.equal(session.note(room.note!.path), keyBytes);
  session.redo();
  assert.deepEqual(session.document().entities, afterEntities);
  assert.equal(session.note(room.note!.path), keyBytes);
});

test("building draw chooses the earlier unnumbered id independent of worker id order", () => {
  const document = newDocument("Deterministische ID", 30, 30),
    floorId = document.floors[0]!.id,
    style = {
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    },
    first: Building = {
      id: "document-first",
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x: 0, y: 0 }, { x: 6, y: 6 }),
        holes: [],
      }],
      ...style,
    },
    second: Building = {
      id: "worker-first",
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x: 5, y: 0 }, { x: 11, y: 6 }),
        holes: [],
      }],
      ...style,
    },
    geometry = composeBuilding({
      kind: "compose-building",
      sources: [
        { id: second.id, polygons: second.polygons },
        { id: first.id, polygons: first.polygons },
      ],
      shape: [{
        outer: rectangle({ x: 4, y: 2 }, { x: 7, y: 4 }),
        holes: [],
      }],
      erase: false,
    });
  assert.equal(geometry.mode, "draw");
  if (geometry.mode !== "draw") return;
  assert.deepEqual(geometry.mergedIds, [second.id, first.id]);
  const plan = planBuildingMutation({
    entities: [first, second],
    floorId,
    result: geometry,
    expectedRevision: 4,
    currentRevision: 4,
  });
  assert.equal(plan.selectedId, first.id);
  assert.ok(
    plan.command?.entities?.some(
      (change) => change.id === second.id && change.after === null,
    ),
  );
});

test("building planner creates and fully erases an unnumbered building with ordinary undo", () => {
  const document = newDocument("Neuer Grundriss", 20, 20),
    floorId = document.floors[0]!.id,
    polygon = {
      outer: rectangle({ x: 2, y: 2 }, { x: 8, y: 8 }),
      holes: [],
    },
    fresh: Building = {
      id: "fresh-building",
      kind: "building",
      floorId,
      polygons: [polygon],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    },
    session = new Session(document),
    draw = composeBuilding({
      kind: "compose-building",
      sources: [],
      shape: [polygon],
      erase: false,
    }),
    create = planBuildingMutation({
      entities: [],
      floorId,
      result: draw,
      expectedRevision: 0,
      currentRevision: 0,
      newBuilding: fresh,
    });
  assert.ok(create.command);
  session.execute(create.command!);
  assert.equal(session.entities.has(fresh.id), true);
  assert.equal(session.historySize, 1);

  const erase = composeBuilding({
      kind: "compose-building",
      sources: [{ id: fresh.id, polygons: fresh.polygons }],
      shape: [{
        outer: rectangle({ x: 1, y: 1 }, { x: 9, y: 9 }),
        holes: [],
      }],
      erase: true,
    }),
    remove = planBuildingMutation({
      entities: [...session.entities.values()],
      floorId,
      result: erase,
      expectedRevision: 1,
      currentRevision: 1,
    });
  assert.ok(remove.command);
  session.execute(remove.command!);
  assert.equal(session.entities.has(fresh.id), false);
  assert.equal(session.historySize, 2);
  session.undo();
  assert.deepEqual(session.entities.get(fresh.id), fresh);
  session.undo();
  assert.equal(session.entities.has(fresh.id), false);
  session.redo();
  session.redo();
  assert.equal(session.entities.has(fresh.id), false);
});

test("building erase removes only unsupported portals in the same undo step", () => {
  const document = newDocument("Portalradierer", 20, 20),
    floorId = document.floors[0]!.id,
    room: Building = {
      id: "erase-room",
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
        holes: [],
      }],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
      number: "1",
      name: "Radierraum",
      note: { path: "QA/Räume/01 Radierraum.md" },
    },
    lost: Door = {
      id: "erased-wall-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: room.id, contour: 0, at: 0.05 },
      width: 1,
      variant: "door",
    },
    kept: Door = {
      id: "remaining-wall-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: room.id, contour: 0, at: 0.2 },
      width: 1,
      variant: "door",
    },
    session = new Session({ ...document, entities: [room, lost, kept] }),
    keyBytes = "# 1  Radierraum\r\n\r\nUngewöhnlich; exakt!\r\n";
  session.loadNote(room.note!.path, keyBytes);
  const before = session.document().entities,
    keptPose = portalPose(kept, (id) => session.entities.get(id)),
    result = composeBuilding({
      kind: "compose-building",
      sources: [{ id: room.id, polygons: room.polygons }],
      shape: [{
        outer: rectangle({ x: 1, y: -1 }, { x: 3, y: 2 }),
        holes: [],
      }],
      erase: true,
    }),
    plan = planBuildingMutation({
      entities: [...session.entities.values()],
      floorId,
      result,
      expectedRevision: 0,
      currentRevision: 0,
    });
  assert.ok(plan.command);
  assert.equal(Object.hasOwn(plan.command!, "texts"), false);
  session.execute(plan.command!);
  assert.equal(session.historySize, 1);
  assert.equal(session.entities.has(lost.id), false);
  const keptAfter = session.entities.get(kept.id);
  assert.equal(keptAfter?.kind, "door");
  if (keptAfter?.kind !== "door") throw new Error("Portal fehlt.");
  const nextPose = portalPose(keptAfter, (id) => session.entities.get(id));
  assert.ok(Math.abs(nextPose.x - keptPose.x) < 1e-8);
  assert.ok(Math.abs(nextPose.y - keptPose.y) < 1e-8);
  assert.equal(session.note(room.note!.path), keyBytes);
  const after = session.document().entities;
  session.undo();
  assert.deepEqual(session.document().entities, before);
  session.redo();
  assert.deepEqual(session.document().entities, after);
  assert.equal(session.note(room.note!.path), keyBytes);
});

test("building planner rejects two rooms, full room erase and stale worker output", () => {
  const document = newDocument("Schutzregeln", 20, 20),
    floorId = document.floors[0]!.id,
    room = (id: string, number: string, x: number): Building => ({
      id,
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x, y: 0 }, { x: x + 6, y: 6 }),
        holes: [],
      }],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
      number,
      name: "Raum " + number,
      note: { path: `QA/Räume/${number}.md` },
    }),
    first = room("room-a", "1", 0),
    second = room("room-b", "2", 5),
    draw = composeBuilding({
      kind: "compose-building",
      sources: [
        { id: first.id, polygons: first.polygons },
        { id: second.id, polygons: second.polygons },
      ],
      shape: [{
        outer: rectangle({ x: 4, y: 2 }, { x: 7, y: 4 }),
        holes: [],
      }],
      erase: false,
    });
  assert.throws(
    () => planBuildingMutation({
      entities: [first, second],
      floorId,
      result: draw,
      expectedRevision: 0,
      currentRevision: 0,
    }),
    /Zwei nummerierte Räume/,
  );
  const erase = composeBuilding({
    kind: "compose-building",
    sources: [{ id: first.id, polygons: first.polygons }],
    shape: [{
      outer: rectangle({ x: -1, y: -1 }, { x: 7, y: 7 }),
      holes: [],
    }],
    erase: true,
  });
  assert.throws(
    () => planBuildingMutation({
      entities: [first],
      floorId,
      result: erase,
      expectedRevision: 0,
      currentRevision: 0,
    }),
    /Archivierungsablauf/,
  );
  assert.throws(
    () => planBuildingMutation({
      entities: [first],
      floorId,
      result: draw,
      expectedRevision: 8,
      currentRevision: 9,
    }),
    /inzwischen geändert/,
  );
});

function multiContourBuilding(floorId: string): Building {
  return {
    id: "multi-contour-room",
    kind: "building",
    floorId,
    polygons: [
      {
        outer: rectangle({ x: 0, y: 0 }, { x: 12, y: 12 }),
        holes: [rectangle({ x: 3, y: 3 }, { x: 7, y: 7 })],
      },
      {
        outer: rectangle({ x: 20, y: 0 }, { x: 28, y: 8 }),
        holes: [],
      },
    ],
    layer: 200,
    fill: 0xbfb09a,
    wall: 0x403e39,
    wallWidth: 0.2,
    number: "4",
    name: "Mehrkonturraum",
    note: { path: "QA/Räume/04 Mehrkonturraum.md" },
  };
}

test("building contour addressing distinguishes outer rings, holes and detached parts", () => {
  const building = multiContourBuilding("floor"),
    entries = buildingContourEntries(building);
  assert.deepEqual(
    entries.map(({ contour, polygon, hole }) => ({ contour, polygon, hole })),
    [
      { contour: 0, polygon: 0, hole: undefined },
      { contour: 1, polygon: 0, hole: 0 },
      { contour: 2, polygon: 1, hole: undefined },
    ],
  );
  const vertex = nearestBuildingVertex({ x: 7.1, y: 3 }, building);
  assert.equal(vertex.contour, 1);
  assert.equal(vertex.index, 1);
  assert.ok(Math.abs(vertex.distance - 0.1) < 1e-9);
  const segment = nearestBuildingSegment({ x: 24, y: 0.1 }, building);
  assert.equal(segment.contour, 2);
  assert.equal(segment.index, 0);
  assert.ok(Math.abs(segment.distance - 0.1) < 1e-9);
  const changedHole = [
      { x: 3, y: 3 },
      { x: 9, y: 4 },
      { x: 7, y: 7 },
      { x: 3, y: 7 },
    ],
    after = replaceBuildingContour(building, 1, changedHole);
  assert.deepEqual(after.polygons[0]!.outer, building.polygons[0]!.outer);
  assert.deepEqual(after.polygons[0]!.holes[0], changedHole);
  assert.deepEqual(after.polygons[1], building.polygons[1]);
});

test("moving a hole point follows its portal atomically and preserves exact key bytes", () => {
  const document = newDocument("Lochpunkt", 40, 30),
    floorId = document.floors[0]!.id,
    building = multiContourBuilding(floorId),
    holeDoor: Door = {
      id: "hole-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: building.id, contour: 1, at: 0.125 },
      width: 0.5,
      variant: "door",
    },
    detachedDoor: Door = {
      id: "detached-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: building.id, contour: 2, at: 0.125 },
      width: 0.5,
      variant: "door",
    },
    session = new Session({
      ...document,
      entities: [building, holeDoor, detachedDoor],
    }),
    keyBytes = "# 4  Mehrkonturraum\r\n\r\nLochwand:  exakt; bitte!\r\n";
  session.loadNote(building.note!.path, keyBytes);
  const hole = [...building.polygons[0]!.holes[0]!];
  hole[1] = { x: 9, y: 4 };
  const after = replaceBuildingContour(building, 1, hole),
    command = planBuildingContourMutation({
      entities: [...session.entities.values()],
      before: building,
      after,
      edit: { kind: "move", contour: 1, index: 1 },
    });
  assert.ok(command);
  assert.equal(Object.hasOwn(command!, "texts"), false);
  assert.deepEqual(
    command!.entities?.map((change) => change.id),
    [building.id, holeDoor.id],
  );
  const beforeEntities = session.document().entities;
  session.execute(command!);
  assert.equal(session.historySize, 1);
  const movedDoor = session.entities.get(holeDoor.id);
  assert.equal(movedDoor?.kind, "door");
  if (movedDoor?.kind !== "door") throw new Error("Lochportal fehlt.");
  const pose = portalPose(movedDoor, (id) => session.entities.get(id));
  assert.ok(Math.abs(pose.x - 6) < 1e-8);
  assert.ok(Math.abs(pose.y - 3.5) < 1e-8);
  assert.ok(Math.abs(pose.angle - Math.atan2(1, 6)) < 1e-8);
  assert.deepEqual(session.entities.get(detachedDoor.id), detachedDoor);
  assert.equal(session.note(building.note!.path), keyBytes);
  const afterEntities = session.document().entities;
  session.undo();
  assert.deepEqual(session.document().entities, beforeEntities);
  assert.equal(session.note(building.note!.path), keyBytes);
  session.redo();
  assert.deepEqual(session.document().entities, afterEntities);
  assert.equal(session.note(building.note!.path), keyBytes);
});

test("inserting on a detached contour follows the same wall segment through undo", () => {
  const document = newDocument("Getrennte Restfläche", 40, 30),
    floorId = document.floors[0]!.id,
    building = multiContourBuilding(floorId),
    door: Door = {
      id: "detached-edit-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: building.id, contour: 2, at: 0.1875 },
      width: 0.5,
      variant: "door",
    },
    session = new Session({ ...document, entities: [building, door] }),
    contour = [...building.polygons[1]!.outer];
  contour.splice(1, 0, { x: 24, y: -2 });
  const after = replaceBuildingContour(building, 2, contour),
    command = planBuildingContourMutation({
      entities: [...session.entities.values()],
      before: building,
      after,
      edit: { kind: "insert", contour: 2, index: 1 },
    });
  assert.ok(command);
  const beforeEntities = session.document().entities;
  session.execute(command!);
  const followed = session.entities.get(door.id);
  assert.equal(followed?.kind, "door");
  if (followed?.kind !== "door") throw new Error("Portal fehlt.");
  const pose = portalPose(followed, (id) => session.entities.get(id));
  assert.ok(Math.abs(pose.x - 26) < 1e-8);
  assert.ok(Math.abs(pose.y + 1) < 1e-8);
  assert.ok(Math.abs(pose.angle - Math.atan2(2, 4)) < 1e-8);
  session.undo();
  assert.deepEqual(session.document().entities, beforeEntities);
  session.redo();
  assert.equal(session.entities.has(door.id), true);
});

test("removing a hole point projects an adjacent portal onto the joined edge", () => {
  const document = newDocument("Lochpunkt entfernen", 40, 30),
    floorId = document.floors[0]!.id,
    building = multiContourBuilding(floorId),
    door: Door = {
      id: "removed-hole-point-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: building.id, contour: 1, at: 0.125 },
      width: 0.5,
      variant: "door",
    },
    session = new Session({ ...document, entities: [building, door] }),
    hole = building.polygons[0]!.holes[0]!.filter((_, index) => index !== 1),
    after = replaceBuildingContour(building, 1, hole),
    command = planBuildingContourMutation({
      entities: [...session.entities.values()],
      before: building,
      after,
      edit: { kind: "remove", contour: 1, index: 1 },
    });
  assert.ok(command);
  session.execute(command!);
  const followed = session.entities.get(door.id);
  assert.equal(followed?.kind, "door");
  if (followed?.kind !== "door") throw new Error("Portal fehlt.");
  const pose = portalPose(followed, (id) => session.entities.get(id));
  assert.ok(Math.abs(pose.x - 4) < 1e-8);
  assert.ok(Math.abs(pose.y - 4) < 1e-8);
  assert.ok(Math.abs(pose.angle - Math.PI / 4) < 1e-8);
  session.undo();
  assert.deepEqual(session.entities.get(door.id), door);
  session.redo();
  assert.equal(session.entities.has(door.id), true);
});

function rejectsBuildingTopology(
  name: string,
  polygons: readonly Polygon[],
  contour: number,
  afterPoints: readonly { x: number; y: number }[],
  edit: Parameters<typeof planBuildingContourMutation>[0]["edit"],
): void {
  const document = newDocument(name, 40, 40),
    floorId = document.floors[0]!.id,
    building: Building = {
      id: "guarded-building",
      kind: "building",
      floorId,
      polygons,
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
      number: "9",
      name: "Topologieschutz",
      note: { path: "QA/Räume/09 Topologieschutz.md" },
    },
    door: Door = {
      id: "guarded-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: building.id, contour: 0, at: 0.75 },
      width: 0.5,
      variant: "door",
    },
    session = new Session({ ...document, entities: [building, door] }),
    keyBytes = "# 9  Topologieschutz\r\n\r\nUnverändert!\r\n",
    after = replaceBuildingContour(building, contour, afterPoints),
    beforeDocument = session.document();
  session.loadNote(building.note!.path, keyBytes);
  assert.throws(
    () =>
      planBuildingContourMutation({
        entities: [...session.entities.values()],
        before: building,
        after,
        edit,
      }),
    /Ungültige Gebäudetopologie/,
  );
  assert.deepEqual(session.document(), beforeDocument);
  assert.deepEqual(session.entities.get(door.id), door);
  assert.equal(session.note(building.note!.path), keyBytes);
  assert.equal(session.historySize, 0);
  assert.equal(session.dirty, false);
}

test("point mutation rejects a near-zero-area contour before creating a command", () => {
  const document = newDocument("Fast flächenlose Kontur", 40, 40),
    floorId = document.floors[0]!.id,
    building: Building = {
      id: "near-zero-area-building",
      kind: "building",
      floorId,
      polygons: [{
        outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }],
        holes: [],
      }],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
      number: "10",
      name: "Flächenschutz",
      note: { path: "QA/Räume/10 Flächenschutz.md" },
    },
    door: Door = {
      id: "near-zero-area-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: building.id, contour: 0, at: 0.1 },
      width: 0.5,
      variant: "door",
    },
    session = new Session({ ...document, entities: [building, door] }),
    keyBytes = "# 10  Flächenschutz\r\n\r\nUnverändert!\r\n",
    points = [...building.polygons[0]!.outer];
  session.loadNote(building.note!.path, keyBytes);
  points[2] = { x: 0, y: 0.000005 };
  const after = replaceBuildingContour(building, 0, points),
    twiceArea = points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length]!;
      return sum + point.x * next.y - next.x * point.y;
    }, 0),
    beforeDocument = session.document();
  assert.ok(Math.abs(twiceArea - 0.00005) < 1e-12);
  let command: ReturnType<typeof planBuildingContourMutation> | undefined;
  assert.throws(
    () => {
      command = planBuildingContourMutation({
        entities: [...session.entities.values()],
        before: building,
        after,
        edit: { kind: "move", contour: 0, index: 2 },
      });
    },
    /Die Kontur hat keine Fläche\./,
  );
  assert.equal(command, undefined);
  assert.deepEqual(session.document(), beforeDocument);
  assert.deepEqual(session.entities.get(door.id), door);
  assert.equal(session.note(building.note!.path), keyBytes);
  assert.equal(session.revision, 0);
  assert.equal(session.historySize, 0);
  assert.equal(session.dirty, false);
  assert.equal(session.canUndo, false);
  assert.equal(session.canRedo, false);
});

test("point mutation validation does not add the topology guard to document loading", () => {
  const document = newDocument("Bestehende Kontur", 40, 40),
    floorId = document.floors[0]!.id,
    existing: Building = {
      id: "existing-self-intersection",
      kind: "building",
      floorId,
      polygons: [{
        outer: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 10, y: 0 },
          { x: 0, y: 8 },
        ],
        holes: [],
      }],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    },
    parsed = parseDocument(JSON.stringify({
      ...document,
      entities: [existing],
    }));
  assert.deepEqual(parsed.entities, [existing]);
});

test("point topology guard rejects the self-intersecting move reproducer", () => {
  rejectsBuildingTopology(
    "Selbstschnitt Move",
    [{
      outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
      holes: [],
    }],
    0,
    [{ x: 0, y: 0 }, { x: 5, y: 12 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
    { kind: "move", contour: 0, index: 1 },
  );
});

test("point topology guard rejects the self-intersecting insert reproducer", () => {
  rejectsBuildingTopology(
    "Selbstschnitt Insert",
    [{
      outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
      holes: [],
    }],
    0,
    [
      { x: 0, y: 0 },
      { x: 5, y: 12 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    { kind: "insert", contour: 0, index: 1 },
  );
});

test("point topology guard rejects the self-intersecting remove reproducer", () => {
  const before = [
    { x: 3, y: 1 },
    { x: 7, y: 2 },
    { x: 6, y: 3 },
    { x: 4, y: 3 },
    { x: 4, y: 5 },
    { x: 5, y: 8 },
    { x: 1, y: 7 },
  ];
  rejectsBuildingTopology(
    "Selbstschnitt Remove",
    [{ outer: before, holes: [] }],
    0,
    before.slice(1),
    { kind: "remove", contour: 0, index: 0 },
  );
});

test("point topology guard rejects a hole escaping its outer ring", () => {
  rejectsBuildingTopology(
    "Auslaufendes Loch",
    [{
      outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
      holes: [rectangle({ x: 3, y: 3 }, { x: 7, y: 7 })],
    }],
    1,
    [{ x: 3, y: 3 }, { x: 12, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }],
    { kind: "move", contour: 1, index: 1 },
  );
});

test("point topology guard also rejects null edges, hole overlap and part overlap", () => {
  rejectsBuildingTopology(
    "Nullkante",
    [{
      outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
      holes: [],
    }],
    0,
    [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    { kind: "insert", contour: 0, index: 1 },
  );
  rejectsBuildingTopology(
    "Lochüberlappung",
    [{
      outer: rectangle({ x: 0, y: 0 }, { x: 20, y: 20 }),
      holes: [
        rectangle({ x: 2, y: 2 }, { x: 6, y: 6 }),
        rectangle({ x: 8, y: 2 }, { x: 12, y: 6 }),
      ],
    }],
    1,
    [{ x: 2, y: 2 }, { x: 10, y: 2 }, { x: 6, y: 6 }, { x: 2, y: 6 }],
    { kind: "move", contour: 1, index: 1 },
  );
  rejectsBuildingTopology(
    "Teilüberlappung",
    [
      {
        outer: rectangle({ x: 0, y: 0 }, { x: 6, y: 6 }),
        holes: [],
      },
      {
        outer: rectangle({ x: 10, y: 0 }, { x: 16, y: 6 }),
        holes: [],
      },
    ],
    1,
    [{ x: 4, y: 0 }, { x: 16, y: 0 }, { x: 16, y: 6 }, { x: 10, y: 6 }],
    { kind: "move", contour: 1, index: 0 },
  );
});
import {
  AssetCatalog,
  discoverPackAssets,
  PackAssetLibrary,
  readDungeondraftPack,
  type AssetCatalogStore,
  type BinarySource,
} from "../src/assets";
import { generateLayout } from "../src/generators";
import {
  analyzeDungeon,
  archiveDefinition,
  archiveEntities,
  archiveFloor,
  archiveOccurrence,
  archiveRoute,
  createFeatureDefinition,
  createFeatureOccurrence,
  createRoute,
  restoreArchive,
  updateFeatureQuantity,
  updateFeatureDefinition,
  updateFeatureOccurrence,
} from "../src/content";

class MemoryStore implements FileStore {
  files = new Map<string, string>();
  calls = 0;
  failAt = Infinity;
  hook?: (path: string) => void;
  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }
  async compareAndWrite(
    path: string,
    before: string | null,
    after: string | null,
  ): Promise<void> {
    this.hook?.(path);
    this.calls++;
    if (this.calls === this.failAt)
      throw new Error("simulated interrupted write");
    if ((await this.read(path)) !== before) throw new FileConflict(path);
    if (after === null) this.files.delete(path);
    else this.files.set(path, after);
  }
}
const mapPath = "QA/Karte.dungeon";
function fixture() {
  const s = new Session(newDocument("Prüfdungeon", 80, 60));
  const floor = s.floors.values().next().value!.id;
  const room = createRoom(
    s,
    floor,
    [
      { x: 2, y: 2 },
      { x: 14, y: 2 },
      { x: 14, y: 12 },
      { x: 2, y: 12 },
    ],
    "QA/Räume",
  );
  return { s, floor, room };
}

test("V2 map and pending draft migrate to V3 without changing linked content or Markdown", async () => {
  const store = new MemoryStore(),
    repo = new MapRepository(store, mapPath),
    { s, room } = fixture();
  await repo.save(s);
  const noteBefore = await store.read(room.note.path);
  const door = createDoor(s, room, 0, 0.5);
  await repo.persistDraft(s);
  const v3Map = JSON.parse((await store.read(mapPath))!);
  const v2Map = JSON.stringify({ ...v3Map, version: 2 }, null, 2) + "\n";
  const v3Draft = JSON.parse((await store.read(repo.draftPath))!);
  const v2Draft = JSON.stringify({
    ...v3Draft,
    baseline: v2Map,
    draft: {
      ...v3Draft.draft,
      document: { ...v3Draft.draft.document, version: 2 },
    },
  });
  store.files.set(mapPath, v2Map);
  store.files.set(repo.draftPath, v2Draft);

  const reopened = new MapRepository(store, mapPath);
  const restored = await reopened.open();
  assert.equal(restored.document().version, 3);
  assert.deepEqual(restored.document().entities, s.document().entities);
  assert.deepEqual(restored.document().content, s.document().content);
  assert.ok(restored.entities.has(door.id));
  assert.equal(await store.read(mapPath), v2Map);
  assert.equal(await store.read(room.note.path), noteBefore);
  assert.equal(restored.note(room.note.path), s.note(room.note.path));
  await reopened.save(restored);
  assert.equal(parseDocument((await store.read(mapPath))!).version, 3);
  assert.equal(await store.read(room.note.path), s.note(room.note.path));
});

test("locking has no undo step and survives geometry undo, redo and deletion", async () => {
  const store = new MemoryStore(),
    repo = new MapRepository(store, "QA/Sperre.dungeon"),
    s = new Session(newDocument("Sperrprobe", 12, 12)),
    floor = s.floors.values().next().value!.id,
    object = createObject(s, floor, { x: 3, y: 4 });
  s.execute({
    label: "Verschieben",
    entities: [
      { id: object.id, before: object, after: { ...object, x: 6 } },
    ],
  });
  const history = s.historySize;
  s.setLocked(object.id, true);
  assert.equal(s.historySize, history);
  assert.equal((s.entities.get(object.id) as MapObject).locked, true);
  s.undo();
  assert.equal((s.entities.get(object.id) as MapObject).x, 3);
  assert.equal((s.entities.get(object.id) as MapObject).locked, true);
  s.redo();
  assert.equal((s.entities.get(object.id) as MapObject).x, 6);
  assert.equal((s.entities.get(object.id) as MapObject).locked, true);
  const archived = archiveEntities(s, [object.id]);
  assert.equal(archived.entities.length, 1);
  assert.equal(s.entities.has(object.id), false);
  s.undo();
  assert.equal((s.entities.get(object.id) as MapObject).locked, true);
  s.setLocked(object.id, false);
  assert.equal(s.historySize, history);
  s.undo();
  assert.equal((s.entities.get(object.id) as MapObject).x, 3);
  assert.equal((s.entities.get(object.id) as MapObject).locked, false);
  await repo.save(s);
  const reopened = await new MapRepository(store, "QA/Sperre.dungeon").open();
  assert.equal((reopened.entities.get(object.id) as MapObject).locked, false);
});

test("locking a multi-selection publishes one change and adds no undo step", () => {
  const session = new Session(newDocument("Gruppensperre", 12, 12)),
    floor = session.floors.values().next().value!.id,
    first = createObject(session, floor, { x: 2, y: 2 }),
    second = createObject(session, floor, { x: 4, y: 4 }),
    history = session.historySize,
    revision = session.revision,
    events: string[][] = [];
  session.subscribe((event) => events.push([...event.ids]));
  session.setLockedMany([first.id, second.id, first.id], true);
  assert.equal(session.historySize, history);
  assert.equal(session.revision, revision + 1);
  assert.deepEqual(events, [[first.id, second.id]]);
  assert.equal(session.entities.get(first.id)?.locked, true);
  assert.equal(session.entities.get(second.id)?.locked, true);
  session.undo();
  assert.equal(session.entities.has(second.id), false);
  session.redo();
  assert.equal(session.entities.get(second.id)?.locked, true);
  session.setLockedMany([first.id, second.id], false);
  assert.equal(session.historySize, history);
  assert.equal(session.entities.get(first.id)?.locked, false);
  assert.equal(session.entities.get(second.id)?.locked, false);
});

test("editing the shadow of an Alt-selected locked light remains undoable without unlocking it", () => {
  const session = new Session(newDocument("Lichtsperre", 12, 12)),
    floor = session.floors.values().next().value!.id,
    source = createLight(session, floor, { x: 4, y: 5 }, {
      radius: 3,
      intensity: 1,
      color: 0xeccd8b,
      shadows: false,
    });
  session.setLocked(source.id, true);
  const locked = session.entities.get(source.id) as Light,
    history = session.historySize;
  session.execute({
    label: "Schatten ändern",
    entities: [{
      id: source.id,
      before: locked,
      after: { ...locked, shadows: true },
    }],
  });
  assert.equal(session.historySize, history + 1);
  assert.deepEqual(
    [(session.entities.get(source.id) as Light).shadows, session.entities.get(source.id)?.locked],
    [true, true],
  );
  session.undo();
  assert.deepEqual(
    [(session.entities.get(source.id) as Light).shadows, session.entities.get(source.id)?.locked],
    [false, true],
  );
  session.redo();
  assert.deepEqual(
    [(session.entities.get(source.id) as Light).shadows, session.entities.get(source.id)?.locked],
    [true, true],
  );
});

test("room, wall-bound door, object and exact text share undo; save and fresh repository reopen", async () => {
  const store = new MemoryStore(),
    repo = new MapRepository(store, mapPath),
    { s, room, floor } = fixture();
  const original = s.note(room.note.path)!;
  const door = createDoor(s, room, 0, 0.5),
    doorText = s.note(room.note.path)!;
  assert.match(doorText, /## Tür/);
  s.undo();
  assert.equal(s.note(room.note.path), original);
  assert.equal(s.entities.has(door.id), false);
  s.redo();
  assert.equal(s.note(room.note.path), doorText);
  assert.equal(s.entities.has(door.id), true);
  const obj = createObject(s, floor, { x: 7, y: 7 });
  const moved = { ...obj, x: 9 };
  s.execute({
    label: "Möbel verschieben",
    entities: [{ id: obj.id, before: obj, after: moved }],
  });
  const preserved =
    doorText + "**Absichtlich  doppelt.** [[Anders#Titel|Wortlaut]]\r\n";
  editNote(s, room.note.path, doorText, preserved);
  s.undo();
  assert.equal(s.note(room.note.path), doorText);
  s.redo();
  await repo.save(s);
  assert.equal(s.dirty, false);
  assert.equal(await store.read(repo.journalPath), null);
  const freshRepo = new MapRepository(store, mapPath),
    fresh = await freshRepo.open();
  await freshRepo.loadNote(fresh, room.note.path);
  assert.deepEqual(fresh.document(), s.document());
  assert.equal(fresh.note(room.note.path), preserved);
  assert.equal((fresh.entities.get(obj.id) as MapObject).x, 9);
  assert.equal(fresh.dirty, false);
});

test("structured passages and encounters render readable key prose and undo atomically", () => {
  const { s, room } = fixture(),
    door = createDoor(s, room, 0, 0.5);
  updatePassage(s, door.id, {
    direction: "north",
    description: "Massive Eichentür",
    state: "locked",
    hidden: true,
    hiddenDC: 15,
    hp: 18,
    ac: 16,
    key: "[[Messingschlüssel]]",
  });
  const passageText = s.note(room.note.path)!;
  assert.match(
    passageText,
    /Norden: Massive Eichentür\. Verschlossen\. Versteckt \(SG 15\)\. 18 HP, RK 16\. Schlüssel: \[\[Messingschlüssel\]\]\./,
  );
  assert.equal((s.entities.get(door.id) as typeof door).passage?.hiddenDC, 15);
  s.undo();
  assert.doesNotMatch(s.note(room.note.path)!, /Massive Eichentür/);
  s.redo();

  const definition = createFeatureDefinition(s, {
      name: "Schattenwache",
      kind: "creature",
      xp: 450,
      description: "Bewacht den Nordausgang",
      reference: "[[Schattenwache]]",
      encounter: "Torwachen",
      encounterLink: "[[Encounter Torwachen]]",
    }),
    occurrence = createFeatureOccurrence(
      s,
      definition.id,
      room.id,
      2,
      undefined,
      {
        situation: "wartet reglos",
        reaction: "greift bei Alarm an",
      },
    );
  let key = s.note(room.note.path)!;
  assert.match(
    key,
    /Bewacht den Nordausgang\. Besetzung: 2× Schattenwache\. Auswertung: 900 XP\. Aktuelle Situation: wartet reglos\. Reaktion: greift bei Alarm an\. Regeln: \[\[Schattenwache\]\]\. Encounter: Torwachen \(\[\[Encounter Torwachen\]\]\)\./,
  );
  updateFeatureOccurrence(s, occurrence.id, {
    quantity: 3,
    situation: "patrouilliert",
    reaction: "schlägt Alarm",
  });
  updateFeatureDefinition(s, definition.id, {
    ...definition,
    name: "Schattenwächter",
    description: "Bewacht den Nordausgang",
  });
  key = s.note(room.note.path)!;
  assert.match(key, /## SC · Schattenwächter/);
  assert.match(
    key,
    /Besetzung: 3× Schattenwächter\. Auswertung: 1\.350 XP\. Aktuelle Situation: patrouilliert\./,
  );
  assert.equal(
    (key.match(/<!-- dungeon-feature:[^\n]+:start -->/g) ?? []).length,
    1,
  );
});
test("an imported heading anchor gains managed prose without rewriting existing key text", () => {
  const { s, room } = fixture(),
    before = s.note(room.note.path)!,
    protectedText = before + "## A · Säulen:\n\nAbsichtlich  unverändert.\n";
  editNote(s, room.note.path, before, protectedText);
  const definition = createFeatureDefinition(s, {
      name: "Säulen",
      kind: "feature",
      description: "Goldverzierte Säulen",
    }),
    occurrence = {
      id: "imported-feature",
      definitionId: definition.id,
      roomId: room.id,
      marker: "A",
      quantity: 6,
      note: { path: room.note.path, anchor: "A · Säulen:" },
    },
    current = s.content;
  s.execute({
    label: "Bestehendes Feature verknüpfen",
    content: {
      before: current,
      after: { ...current, occurrences: [...current.occurrences, occurrence] },
    },
  });
  updateFeatureOccurrence(s, occurrence.id, {
    quantity: 6,
    situation: "steht unverändert",
  });
  const after = s.note(room.note.path)!;
  assert.match(after, /^## A · Säulen:$/m);
  assert.match(after, /Absichtlich  unverändert\./);
  assert.match(after, /Menge: 6\. Aktuelle Situation: steht unverändert\./);
  assert.equal(
    (after.match(/<!-- dungeon-feature:imported-feature:start -->/g) ?? [])
      .length,
    1,
  );
});
test("rooms stay numbered while features use letters and creatures use named codes", () => {
  const { s, room } = fixture(),
    column = createFeatureDefinition(s, {
      name: "Säule",
      kind: "feature",
    }),
    guardian = createFeatureDefinition(s, {
      name: "Schattenwache",
      kind: "creature",
    }),
    trap = createFeatureDefinition(s, {
      name: "Falltür",
      kind: "trap",
    }),
    first = createFeatureOccurrence(s, column.id, room.id),
    creature = createFeatureOccurrence(s, guardian.id, room.id),
    second = createFeatureOccurrence(s, trap.id, room.id),
    key = s.note(room.note.path)!;
  assert.equal(first.marker, "A");
  assert.equal(creature.marker, "SC");
  assert.equal(second.marker, "B");
  assert.match(key, /^# 1 Raum 1$/m);
  assert.match(key, /^## A · Säule /m);
  assert.match(key, /^## SC · Schattenwache /m);
  assert.match(key, /^## B · Falltür /m);
});
test("failure at each write rolls back; committed cleanup failure retains completed result", async () => {
  for (let failAt = 1; failAt <= 5; failAt++) {
    const { s, room } = fixture(),
      store = new MemoryStore(),
      repo = new MapRepository(store, mapPath);
    store.failAt = failAt;
    await assert.rejects(repo.save(s));
    if (failAt < 5) {
      assert.equal(await store.read(mapPath), null);
      assert.equal(await store.read(room.note.path), null);
      assert.equal(s.dirty, true);
    } else {
      assert.ok(await store.read(mapPath));
      assert.equal(s.dirty, false);
    }
    assert.equal(await store.read(repo.journalPath), null);
  }
});
test("concurrent note modification is preserved and map is not partially saved", async () => {
  const { s, room } = fixture(),
    store = new MemoryStore(),
    repo = new MapRepository(store, mapPath);
  await repo.save(s);
  const savedMap = await store.read(mapPath),
    before = s.note(room.note.path)!;
  editNote(s, room.note.path, before, before + "Unser Entwurf\n");
  store.files.set(room.note.path, before + "Fremde Änderung\n");
  await assert.rejects(repo.save(s), FileConflict);
  assert.equal(await store.read(mapPath), savedMap);
  assert.equal(await store.read(room.note.path), before + "Fremde Änderung\n");
  assert.equal(s.dirty, true);
});
test("external edit during partial save is not overwritten by rollback; journal survives fresh recovery", async () => {
  const { s, room } = fixture(),
    store = new MemoryStore(),
    repo = new MapRepository(store, mapPath);
  store.hook = (path) => {
    if (path === mapPath) {
      store.files.set(room.note.path, "Extern!");
      throw new Error("interruption");
    }
  };
  await assert.rejects(repo.save(s), AggregateError);
  assert.equal(await store.read(room.note.path), "Extern!");
  assert.ok(await store.read(repo.journalPath));
  store.hook = undefined;
  await assert.rejects(new MapRepository(store, mapPath).open(), FileConflict);
  assert.equal(await store.read(room.note.path), "Extern!");
});
test("prepared transaction recovers in fresh process after a partial write", async () => {
  const store = new MemoryStore();
  store.files.set("QA/Räume/a.md", "neu");
  store.files.set(
    mapPath + ".journal",
    JSON.stringify({
      version: 1,
      mapPath,
      state: "prepared",
      writes: [
        { path: "QA/Räume/a.md", before: "alt", after: "neu" },
        { path: mapPath, before: null, after: "not written" },
      ],
    }),
  );
  await new MapRepository(store, mapPath).recover();
  assert.equal(await store.read("QA/Räume/a.md"), "alt");
  assert.equal(await store.read(mapPath + ".journal"), null);
});
test("joint validation prevents partial changes and broken bindings", () => {
  const { s, room } = fixture();
  const door = createDoor(s, room, 1, 0.4);
  const before = s.document();
  assert.throws(
    () =>
      s.execute({
        label: "Unvollständig",
        entities: [{ id: room.id, before: room, after: null }],
      }),
    /Wandbindung/,
  );
  assert.deepEqual(s.document(), before);
  assert.ok(s.entities.has(door.id));
  const changed = { ...room, name: "Nicht übernehmen" };
  assert.throws(() =>
    s.execute({
      label: "Veralteter Text",
      entities: [{ id: room.id, before: room, after: changed }],
      texts: [
        { path: room.note.path, offset: 0, before: "falsch", after: "kaputt" },
      ],
    }),
  );
  assert.deepEqual(s.document(), before);
});
test("ordinary furniture move preserves unrelated records, does not recalculate rules and reports only the object", () => {
  const { s, floor } = fixture(),
    a = createObject(s, floor, { x: 5, y: 5 }),
    b = createObject(s, floor, { x: 7, y: 7 });
  const stable = s.entities.get(b.id),
    revision = s.rulesRevision;
  let ids: ReadonlySet<string> = new Set();
  s.subscribe((e) => (ids = e.ids));
  s.execute({
    label: "Verschieben",
    entities: [{ id: a.id, before: a, after: { ...a, x: 8 } }],
  });
  assert.equal(s.entities.get(b.id), stable);
  assert.equal(s.rulesRevision, revision);
  assert.deepEqual([...ids], [a.id]);
});
test("room geometry invalidates bound door without mutating its semantic record", () => {
  const { s, room } = fixture(),
    door = createDoor(s, room, 1, 0.4);
  const stable = s.entities.get(door.id);
  let ids: ReadonlySet<string> = new Set();
  s.subscribe((e) => (ids = e.ids));
  s.execute({
    label: "Raum ändern",
    entities: [
      {
        id: room.id,
        before: room,
        after: {
          ...room,
          polygons: room.polygons.map((polygon) => ({
            outer: polygon.outer.map((point) => ({
              ...point,
              x: point.x + 1,
            })),
            holes: polygon.holes.map((hole) =>
              hole.map((point) => ({ ...point, x: point.x + 1 })),
            ),
          })),
        },
      },
    ],
  });
  assert.deepEqual(new Set(ids), new Set([room.id, door.id]));
  assert.equal(s.entities.get(door.id), stable);
});
test("save captures a revision while subsequent edits remain dirty and undo is preserved", async () => {
  const { s, room } = fixture(),
    store = new MemoryStore(),
    repo = new MapRepository(store, mapPath);
  const base = s.note(room.note.path)!;
  let changed = false;
  store.hook = (path) => {
    if (path === mapPath && !changed) {
      changed = true;
      editNote(s, room.note.path, base, base + "Später\n");
    }
  };
  await repo.save(s);
  assert.equal(s.dirty, true);
  assert.equal(await store.read(room.note.path), base);
  s.undo();
  assert.equal(s.dirty, false);
});
test("text patch keeps unrelated bytes and undoing a saved new room removes its created text from the draft", async () => {
  assert.deepEqual(textPatch("a.md", "AB\r\n  CD", "AB\r\n  XD"), {
    path: "a.md",
    offset: 6,
    before: "C",
    after: "X",
  });
  const { s, room } = fixture(),
    store = new MemoryStore(),
    repo = new MapRepository(store, mapPath);
  await repo.save(s);
  s.undo();
  assert.equal(s.note(room.note.path), null);
  await repo.save(s);
  assert.equal(await store.read(room.note.path), null);
  assert.equal(parseDocument((await store.read(mapPath))!).entities.length, 0);
});
test("rejects malformed and legacy maps and escaping note paths", () => {
  assert.throws(() => parseDocument("<svg/>"));
  assert.throws(() =>
    parseDocument(JSON.stringify({ ...newDocument("A", 20, 20), version: 1 })),
  );
  const { s, floor } = fixture();
  assert.throws(() =>
    createRoom(
      s,
      floor,
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
      ],
      "../outside",
    ),
  );
});
test("unsaved joint draft survives repository recreation without modifying saved originals", async () => {
  const store = new MemoryStore(),
    repo = new MapRepository(store, mapPath),
    { s, room } = fixture();
  await repo.save(s);
  const originalMap = await store.read(mapPath),
    originalNote = await store.read(room.note.path),
    door = createDoor(s, room, 0, 0.5);
  await repo.persistDraft(s);
  assert.equal(await store.read(mapPath), originalMap);
  assert.equal(await store.read(room.note.path), originalNote);
  const reopened = new MapRepository(store, mapPath),
    restored = await reopened.open();
  assert.equal(restored.dirty, true);
  assert.ok(restored.entities.has(door.id));
  assert.equal(restored.note(room.note.path), s.note(room.note.path));
  await reopened.save(restored);
  assert.equal(restored.dirty, false);
  assert.equal(await store.read(reopened.draftPath), null);
  assert.deepEqual(
    (await new MapRepository(store, mapPath).open()).document(),
    s.document(),
  );
});
test("draft recovery rejects changed map or text; preserves both external work and draft", async () => {
  const store = new MemoryStore(),
    repo = new MapRepository(store, mapPath),
    { s, room } = fixture();
  await repo.save(s);
  createDoor(s, room, 0, 0.5);
  await repo.persistDraft(s);
  const draft = await store.read(repo.draftPath);
  store.files.set(room.note.path, "Andere Person");
  await assert.rejects(new MapRepository(store, mapPath).open(), FileConflict);
  assert.equal(await store.read(room.note.path), "Andere Person");
  assert.equal(await store.read(repo.draftPath), draft);
});
test("undo listeners observe the updated history and door changes invalidate their wall", () => {
  const { s, room } = fixture();
  let canRedo = false;
  let ids: ReadonlySet<string> = new Set();
  s.subscribe((e) => {
    canRedo = s.canRedo;
    ids = e.ids;
  });
  const door = createDoor(s, room, 0, 0.5);
  assert.ok(ids.has(room.id));
  assert.ok(ids.has(door.id));
  s.undo();
  assert.equal(canRedo, true);
});
test("crash after commit but before draft cleanup reopens the completed save exactly", async () => {
  for (const textOnly of [false, true]) {
    const store = new MemoryStore(),
      repo = new MapRepository(store, mapPath),
      { s, room } = fixture();
    await repo.save(s);
    if (textOnly) {
      const before = s.note(room.note.path)!;
      editNote(s, room.note.path, before, before + "Nur Text\n");
    } else createDoor(s, room, 0, 0.5);
    await repo.persistDraft(s);
    store.hook = (path) => {
      if (path === repo.draftPath)
        throw new Error("crash before draft cleanup");
    };
    await assert.rejects(repo.save(s));
    assert.ok(await store.read(repo.draftPath));
    store.hook = undefined;
    const fresh = await new MapRepository(store, mapPath).open();
    assert.equal(fresh.dirty, false);
    assert.deepEqual(fresh.document(), s.document());
    assert.equal(await store.read(room.note.path), s.note(room.note.path));
    assert.equal(await store.read(repo.draftPath), null);
  }
});

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

test("a drawn floor becomes a numbered room with the same id and one undo restores it", () => {
  const document = newDocument("Grundriss", 30, 30),
    session = new Session(document),
    floorId = document.floors[0]!.id,
    surface = createBuilding(
      session,
      floorId,
      [{
        outer: [
          { x: 2, y: 3 },
          { x: 9, y: 3 },
          { x: 9, y: 8 },
          { x: 2, y: 8 },
        ],
        holes: [],
      }],
      {
        layer: 200,
        fill: 0xbfb09a,
        wall: 0x403e39,
        wallWidth: 0.2,
      },
    ),
    room = adoptFloorAsRoom(
      session,
      surface.id,
      "Dungeons/Grundriss/Räume",
      {},
      "Dungeons/Grundriss/Karte.dungeon",
    );
  assert.equal(room.id, surface.id);
  assert.equal(room.number, "1");
  assert.equal(room.polygons[0]!.outer.length, 4);
  assert.match(session.note(room.note.path)!, /^---\nroom_id:/);
  session.undo();
  assert.equal(session.entities.get(surface.id)?.kind, "building");
  assert.equal(isRoom(session.entities.get(surface.id)), false);
  assert.equal(session.note(room.note.path), null);
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

test("floor and light commands are validated and share normal undo redo", () => {
  const { s, floor } = fixture();
  const upper = addFloor(s);
  const light = createLight(
    s,
    upper.id,
    { x: 8, y: 9 },
    { radius: 7, intensity: 1.2, color: 0xffcc88, shadows: true },
  );
  assert.equal(s.entities.get(light.id)?.floorId, upper.id);
  s.undo();
  assert.equal(s.entities.has(light.id), false);
  s.undo();
  assert.equal(s.floors.has(upper.id), false);
  s.redo();
  s.redo();
  assert.equal(s.entities.get(light.id)?.floorId, upper.id);
  assert.throws(
    () =>
      createLight(
        s,
        floor,
        { x: 1, y: 1 },
        { radius: 0, intensity: 1, color: 0xffffff, shadows: false },
      ),
    /Lichtquelle/,
  );
});

test("independent curved wall keeps a bound portal opening while points move", () => {
  const { s, floor } = fixture();
  const wall = createWall(
    s,
    floor,
    [
      { x: 2, y: 20 },
      { x: 10, y: 14 },
      { x: 18, y: 20 },
    ],
    true,
  );
  const door = createPortal(
    s,
    floor,
    { boundary: wall, anchor: { contour: 0, at: 0.5 } },
    { variant: "door", width: 2, blocksLight: true },
  );
  const stableDoor = s.entities.get(door.id)!;
  const curved = smoothPath(wall.points, false);
  assert.ok(curved.length > wall.points.length);
  const beforePose = portalPose(stableDoor as typeof door, (id) =>
    s.entities.get(id),
  );
  const visible = boundarySegments(wall, [stableDoor as typeof door]);
  assert.ok(visible.length > 2);
  assert.ok(
    visible.every(
      (segment) =>
        Math.hypot(
          (segment.a.x + segment.b.x) / 2 - beforePose.x,
          (segment.a.y + segment.b.y) / 2 - beforePose.y,
        ) > 0.5,
    ),
  );
  const moved = {
    ...wall,
    points: wall.points.map((point, index) =>
      index === 1 ? { x: point.x, y: point.y - 4 } : point,
    ),
  };
  s.execute({
    label: "Wandpunkt verschieben",
    entities: [{ id: wall.id, before: wall, after: moved }],
  });
  const afterPose = portalPose(s.entities.get(door.id) as typeof door, (id) =>
    s.entities.get(id),
  );
  assert.notEqual(afterPose.y, beforePose.y);
  assert.equal(s.entities.get(door.id), stableDoor);
  s.undo();
  assert.deepEqual(
    portalPose(door, (id) => s.entities.get(id)),
    beforePose,
  );
});

test("freestanding portal remains independent from room geometry", () => {
  const { s, floor } = fixture();
  const portal = createPortal(
    s,
    floor,
    { point: { x: 22, y: 17 }, rotation: Math.PI / 4 },
    { variant: "bars", width: 1.5, blocksLight: false, flip: true },
  );
  assert.deepEqual(
    portalPose(portal, (id) => s.entities.get(id)),
    {
      x: 22,
      y: 17,
      angle: Math.PI / 4,
    },
  );
  assert.equal(portal.anchor, undefined);
  assert.equal(portal.blocksLight, false);
});

test("pattern, water, terrain, textured path and roof share the validated model", () => {
  const { s, floor } = fixture();
  const pattern = createSurface(
    s,
    floor,
    "pattern",
    [
      { x: 20, y: 2 },
      { x: 28, y: 2 },
      { x: 28, y: 8 },
      { x: 20, y: 8 },
    ],
    {
      layer: 100,
      color: 0xb4976c,
      wallColor: 0x5d4a35,
      wallWidth: 0.08,
      opacity: 0.9,
      effect: "none",
    },
  );
  const water = createSurface(
    s,
    floor,
    "water",
    [
      { x: 20, y: 10 },
      { x: 30, y: 10 },
      { x: 30, y: 16 },
      { x: 20, y: 16 },
    ],
    {
      layer: -50,
      color: 0x6faac2,
      wallColor: 0xbed9df,
      wallWidth: 0.2,
      opacity: 0.82,
      effect: "ripples",
    },
  );
  const path = createMapPath(
    s,
    floor,
    [
      { x: 3, y: 20 },
      { x: 10, y: 17 },
      { x: 18, y: 22 },
    ],
    {
      closed: false,
      smooth: true,
      width: 1.2,
      style: "road",
      color: 0xa99473,
      outlineColor: 0x625744,
      outlineWidth: 0.12,
      layer: 500,
      start: "round",
      end: "taper",
      blocksLight: false,
    },
  );
  const roof = createRoof(
    s,
    floor,
    [
      { x: 32, y: 2 },
      { x: 44, y: 2 },
      { x: 44, y: 10 },
      { x: 32, y: 10 },
    ],
    {
      roofType: "hip",
      color: 0x8d5d4a,
      outlineColor: 0x46352f,
      layer: 400,
    },
  );
  assert.equal(s.document().entities.length, 5);
  assert.equal(
    hit({ x: 24, y: 5 }, pattern, () => undefined, 0),
    true,
  );
  assert.equal(
    hit({ x: 25, y: 13 }, water, () => undefined, 0),
    true,
  );
  assert.ok(nearestPath({ x: 10, y: 17 }, path).distance < 0.001);
  assert.equal(
    hit({ x: 38, y: 6 }, roof, () => undefined, 0),
    true,
  );
  assert.equal(roof.ridge.length, 2);
  const moved = moveEntity(path, 2, -1);
  assert.equal(moved.kind, "path");
  if (moved.kind === "path") assert.deepEqual(moved.points[0], { x: 5, y: 19 });
});

test("terrain surfaces and blocking paths reject malformed values", () => {
  const { s, floor } = fixture();
  const terrain = createSurface(
    s,
    floor,
    "terrain",
    [
      { x: 1, y: 20 },
      { x: 8, y: 20 },
      { x: 8, y: 28 },
      { x: 1, y: 28 },
    ],
    {
      layer: -500,
      color: 0x718657,
      wallColor: 0x718657,
      wallWidth: 0,
      opacity: 0.75,
      effect: "none",
    },
  );
  assert.equal(terrain.category, "terrain");
  assert.throws(
    () =>
      createMapPath(
        s,
        floor,
        [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
        {
          closed: false,
          smooth: false,
          width: 0,
          style: "rail",
          color: 0xffffff,
          outlineColor: 0,
          outlineWidth: 0,
          layer: 1,
          start: "square",
          end: "square",
          blocksLight: true,
        },
      ),
    /Texturpfad/,
  );
});

test("object scattering is deterministic and commits as one undo step", () => {
  const { s, floor } = fixture(),
    beforeHistory = s.historySize,
    settings = {
      object: {
        rotation: 0,
        width: 1,
        height: 0.7,
        color: 0x765231,
        label: "",
      },
      spacing: 2,
      spread: 0.6,
      rotationJitter: Math.PI,
      scaleJitter: 0.2,
      seed: 42,
    },
    first = scatterObjects(
      s,
      floor,
      [
        { x: 2, y: 20 },
        { x: 12, y: 20 },
      ],
      settings,
    );
  assert.ok(first.length >= 5);
  assert.equal(s.historySize, beforeHistory + 1);
  const positions = first.map(({ x, y, rotation, width }) => ({
    x,
    y,
    rotation,
    width,
  }));
  s.undo();
  assert.ok(first.every((object) => !s.entities.has(object.id)));
  const fresh = fixture();
  const second = scatterObjects(
    fresh.s,
    fresh.floor,
    [
      { x: 2, y: 20 },
      { x: 12, y: 20 },
    ],
    settings,
  );
  assert.deepEqual(
    second.map(({ x, y, rotation, width }) => ({ x, y, rotation, width })),
    positions,
  );
});

test("Dungeondraft packages keep image payloads lazy and expose stable assets", async () => {
  const bytes = await readFile(
      "../dungeon-auswertung/tests/fixtures/own-asset-pack/own.dungeondraft_pack",
    ),
    blob = new Blob([bytes]),
    reads: [number | undefined, number | undefined][] = [],
    source = {
      size: blob.size,
      slice(start?: number, end?: number) {
        reads.push([start, end]);
        return blob.slice(start, end);
      },
    },
    pack = await readDungeondraftPack(source),
    assets = await discoverPackAssets(pack),
    object = assets.find((asset) => asset.kind === "object");
  assert.equal(pack.allowed, true);
  assert.ok(object);
  assert.equal(object.packId, pack.metadata.id);
  assert.match(object.id, /^pack:/);
  assert.ok(
    reads.every(([start, end]) => (end ?? 0) - (start ?? 0) < bytes.length),
  );
  const image = new Uint8Array(
    await pack.asset(object.files.image!).arrayBuffer(),
  );
  assert.deepEqual([...image.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("asset library discovers composite package classes and releases ownership", async () => {
  const files = [
      "../dungeon-auswertung/tests/fixtures/wall-texture-probe/own-walls.dungeondraft_pack",
      "../dungeon-auswertung/tests/fixtures/surface-parts/own-surfaces.dungeondraft_pack",
      "../dungeon-auswertung/tests/fixtures/roof-resize-probe/own-roofs.dungeondraft_pack",
    ],
    library = new PackAssetLibrary();
  for (const file of files) {
    const bytes = await readFile(file);
    await library.add(new Blob([bytes]));
  }
  assert.ok(library.list("wall").length > 0);
  assert.ok(library.list("roof").length > 0);
  assert.ok(library.list("material").length > 0);
  assert.ok(library.list("cave").length > 0);
  const wall = library.list("wall")[0]!;
  assert.ok(library.blob(wall.id, "image").size > 0);
  assert.ok(library.list(undefined, wall.name.slice(0, 2)).includes(wall));
  library.close();
  assert.deepEqual(library.list(), []);
});

test("asset package parser rejects malformed containers", async () => {
  await assert.rejects(
    () => readDungeondraftPack(new Blob([new Uint8Array(128)])),
    /Paketcontainer/,
  );
});

test("asset catalog persists package selection and reloads enabled packages", async () => {
  class CatalogMemoryStore implements AssetCatalogStore {
    catalog: string | null = null;
    packages = new Map<string, Blob>();
    async readCatalog() {
      return this.catalog;
    }
    async writeCatalog(text: string) {
      this.catalog = text;
    }
    async writePackage(hash: string, source: BinarySource) {
      if (!this.packages.has(hash))
        this.packages.set(hash, source.slice(0, source.size));
    }
    async readPackage(hash: string) {
      const source = this.packages.get(hash);
      if (!source) throw new Error("missing package");
      return source;
    }
    async removePackage(hash: string) {
      this.packages.delete(hash);
    }
  }
  const bytes = await readFile(
      "../dungeon-auswertung/tests/fixtures/own-asset-pack/own.dungeondraft_pack",
    ),
    store = new CatalogMemoryStore(),
    catalog = new AssetCatalog(store),
    [added] = await catalog.add([new Blob([bytes])]);
  assert.ok(added);
  assert.equal((await catalog.read()).packs[0]!.assetCount > 0, true);
  let library = await catalog.loadEnabled();
  assert.ok(library.list("object").length > 0);
  library.close();
  await catalog.setEnabled(added.metadata.id, false);
  await catalog.setBuiltIns(false);
  library = await catalog.loadEnabled();
  assert.equal(library.list().length, 0);
  library.close();
  assert.equal((await catalog.read()).builtIns, false);
  await catalog.remove(added.metadata.id);
  assert.equal((await catalog.read()).packs.length, 0);
  assert.equal(store.packages.size, 0);
});

test("map-specific asset selection is validated and follows ordinary undo", () => {
  const document = newDocument("Assetkarte", 20, 20, {
      assetPacks: ["pack-a"],
      builtInAssets: true,
    }),
    session = new Session(document),
    before = session.settings,
    after = {
      ...before,
      assetPacks: ["pack-a", "pack-b"],
      builtInAssets: false,
    };
  session.execute({
    label: "Kartenassets ändern",
    settings: { before, after },
  });
  assert.deepEqual(session.settings.assetPacks, ["pack-a", "pack-b"]);
  assert.equal(session.settings.builtInAssets, false);
  session.undo();
  assert.deepEqual(session.settings, before);
  session.redo();
  assert.deepEqual(session.settings, after);
  assert.throws(
    () =>
      session.execute({
        label: "Ungültige Kartenassets",
        settings: {
          before: after,
          after: { ...after, assetPacks: ["pack-a", "pack-a"] },
        },
      }),
    /Karteneinstellungen/,
  );
});

test("floor duplication remaps topology and copies protected room text in one undo", () => {
  const { s, floor, room } = fixture(),
    beforeText = s.note(room.note.path)! + "**Unveränderter  Wortlaut.**\n";
  editNote(s, room.note.path, s.note(room.note.path)!, beforeText);
  const door = createDoor(s, room, 0, 0.5),
    object = createObject(s, floor, { x: 5, y: 5 });
  const history = s.historySize,
    copiedFloor = duplicateFloor(s, floor),
    copies = [...s.entities.values()].filter(
      (entity) => entity.floorId === copiedFloor.id,
    ),
    copiedRoom = copies.find(isRoom)!,
    copiedDoor = copies.find((entity) => entity.kind === "door")!,
    copiedObject = copies.find((entity) => entity.kind === "object")!;
  assert.equal(s.historySize, history + 1);
  assert.equal(copies.length, 3);
  assert.notEqual(copiedRoom.id, room.id);
  assert.equal(copiedDoor.kind, "door");
  assert.equal(copiedDoor.anchor?.boundaryId, copiedRoom.id);
  assert.equal(copiedDoor.note?.path, copiedRoom.note.path);
  assert.equal(copiedObject.kind, "object");
  assert.equal(copiedObject.roomId, copiedRoom.id);
  const copiedText = s.note(copiedRoom.note.path)!;
  assert.match(copiedText, /\*\*Unveränderter  Wortlaut\.\*\*/);
  assert.match(copiedText, new RegExp('room_id: "' + copiedRoom.id + '"'));
  assert.match(copiedText, new RegExp("\\^durchgang-" + copiedDoor.id));
  assert.ok(!copiedText.includes("^durchgang-" + door.id));
  s.undo();
  assert.ok(!s.floors.has(copiedFloor.id));
  assert.ok(copies.every((entity) => !s.entities.has(entity.id)));
  assert.equal(s.note(copiedRoom.note.path), null);
  assert.ok(s.entities.has(object.id));
});

test("map margins translate all geometry together and restore exactly with undo", () => {
  const { s, floor, room } = fixture(),
    door = createDoor(s, room, 0, 0.5),
    object = createObject(s, floor, { x: 5, y: 5 }),
    wall = createWall(
      s,
      floor,
      [
        { x: 20, y: 20 },
        { x: 24, y: 20 },
      ],
      false,
    ),
    storedDoor = s.entities.get(door.id),
    before = s.document(),
    history = s.historySize;
  resizeMap(
    s,
    { left: 3, right: -5, top: 2, bottom: 4 },
    { wallShadows: false, objectShadows: false, buildingWear: 0.55 },
  );
  assert.equal(s.historySize, history + 1);
  assert.equal(s.settings.width, 78);
  assert.equal(s.settings.height, 66);
  assert.equal(s.settings.wallShadows, false);
  assert.equal(s.settings.objectShadows, false);
  assert.equal(s.settings.buildingWear, 0.55);
  assert.deepEqual(
    (s.entities.get(room.id) as typeof room).polygons[0]!.outer[0],
    {
    x: 5,
    y: 4,
    },
  );
  assert.deepEqual(
    {
      x: (s.entities.get(object.id) as typeof object).x,
      y: (s.entities.get(object.id) as typeof object).y,
    },
    { x: 8, y: 7 },
  );
  assert.deepEqual((s.entities.get(wall.id) as typeof wall).points[0], {
    x: 23,
    y: 22,
  });
  assert.equal(s.entities.get(door.id), storedDoor);
  s.undo();
  assert.deepEqual(s.document(), before);
  s.redo();
  assert.equal(s.settings.width, 78);
  assert.equal(s.settings.buildingWear, 0.55);
  assert.throws(
    () => resizeMap(s, { left: 0.5, right: 0, top: 0, bottom: 0 }),
    /ganzen Feldern/,
  );
  assert.throws(
    () => resizeMap(s, { left: -100, right: 0, top: 0, bottom: 0 }),
    /Kartengröße/,
  );
});

test("reference images align per floor and participate in ordinary history", () => {
  const { s, floor } = fixture(),
    image = createReferenceImage(
      s,
      floor,
      ".obsidian/dungeon-editor-assets/references/test.png",
      "Skizze.png",
      1600,
      900,
    );
  assert.equal(image.kind, "reference");
  assert.equal(image.x, 40);
  assert.equal(image.y, 30);
  assert.equal(image.width, 64);
  assert.equal(image.height, 36);
  assert.equal(image.opacity, 0.45);
  resizeMap(s, { left: 2, right: 0, top: 3, bottom: 0 });
  const moved = s.entities.get(image.id);
  assert.equal(moved?.kind, "reference");
  if (moved?.kind === "reference") {
    assert.equal(moved.x, 42);
    assert.equal(moved.y, 33);
  }
  s.undo();
  assert.deepEqual(s.entities.get(image.id), image);
  s.undo();
  assert.equal(s.entities.has(image.id), false);
});

test("dungeon and cave generation are deterministic replaceable proposals", () => {
  const a = fixture(),
    first = generateLayout(a.s, a.floor, {
      kind: "dungeon",
      seed: 42,
      amount: 9,
    }),
    firstShape = first.map((entity) => {
      const { id: _id, floorId: _floorId, ...stable } = entity;
      return stable;
    }),
    b = fixture(),
    second = generateLayout(b.s, b.floor, {
      kind: "dungeon",
      seed: 42,
      amount: 9,
    });
  assert.deepEqual(
    second.map((entity) => {
      const { id: _id, floorId: _floorId, ...stable } = entity;
      return stable;
    }),
    firstShape,
  );
  const history = a.s.historySize,
    cave = generateLayout(
      a.s,
      a.floor,
      { kind: "cave", seed: 7, amount: 18 },
      first.map((entity) => entity.id),
    );
  assert.equal(a.s.historySize, history + 1);
  assert.equal(cave.length, 1);
  assert.equal(cave[0]?.kind, "surface");
  assert.ok(first.every((entity) => !a.s.entities.has(entity.id)));
  a.s.undo();
  assert.ok(first.every((entity) => a.s.entities.has(entity.id)));
  assert.ok(cave.every((entity) => !a.s.entities.has(entity.id)));
  assert.throws(
    () => generateLayout(a.s, a.floor, { kind: "cave", seed: 1.5, amount: 8 }),
    /Generatorwerte/,
  );
});

test("package walls, portals and lights keep stable model references", () => {
  const { s, floor, room } = fixture(),
    texturedRoom = {
      ...room,
      wallAssetId: "pack:test:wall:room",
    },
    wall = createWall(
      s,
      floor,
      [
        { x: 20, y: 2 },
        { x: 30, y: 2 },
      ],
      false,
      false,
      0.3,
      "pack:test:wall:free",
    );
  s.execute({
    label: "Paketwand anwenden",
    entities: [{ id: room.id, before: room, after: texturedRoom }],
  });
  const portal = createPortal(
      s,
      floor,
      { boundary: wall, anchor: { contour: 0, at: 0.5 } },
      {
        variant: "window",
        width: 2,
        blocksLight: true,
        assetId: "pack:test:portal:window",
      },
    ),
    light = createLight(
      s,
      floor,
      { x: 12, y: 20 },
      {
        radius: 8,
        intensity: 1,
        color: 0xffffff,
        shadows: true,
        assetId: "pack:test:light:glow",
      },
    );
  assert.equal(
    (s.entities.get(room.id) as typeof texturedRoom).wallAssetId,
    texturedRoom.wallAssetId,
  );
  assert.equal(wall.assetId, "pack:test:wall:free");
  assert.equal(portal.assetId, "pack:test:portal:window");
  assert.equal(light.assetId, "pack:test:light:glow");
  assert.throws(
    () =>
      s.execute({
        label: "Ungültiges Paketlicht",
        entities: [
          {
            id: light.id,
            before: light,
            after: { ...light, assetId: "vault.png" },
          },
        ],
      }),
    /Paketasset/,
  );
});

test("shared dungeon content, analysis and archive share ordinary exact history", async () => {
  const { s, floor, room } = fixture(),
    second = createRoom(
      s,
      floor,
      [
        { x: 20, y: 2 },
        { x: 30, y: 2 },
        { x: 30, y: 12 },
        { x: 20, y: 12 },
      ],
      "QA/Räume",
    ),
    definition = createFeatureDefinition(s, {
      name: "Schattenwache",
      kind: "creature",
      xp: 450,
      lootValue: 75,
      encounter: "Torwachen",
    }),
    first = createFeatureOccurrence(s, definition.id, room.id, 2),
    secondOccurrence = createFeatureOccurrence(s, definition.id, second.id, 1),
    route = createRoute(s, {
      name: "Haupteingang",
      entrance: true,
      toRoomId: room.id,
      prerequisites: ["Siegelstein"],
      bossGoalOrder: 1,
    });
  assert.match(s.note(room.note.path)!, new RegExp(`\\^feature-${first.id}`));
  assert.match(
    s.note(second.note.path)!,
    new RegExp(`\\^feature-${secondOccurrence.id}`),
  );
  updateFeatureQuantity(s, first.id, 3);
  assert.deepEqual(analyzeDungeon(s.content), {
    definitions: 1,
    occurrences: 2,
    totalQuantity: 4,
    xp: 1800,
    lootValue: 300,
    encounters: [{ name: "Torwachen", quantity: 4, xp: 1800 }],
    bossGoals: [route],
  });
  const preservedText = s.note(room.note.path)!,
    markerId = first.entityId!,
    archivedOccurrence = archiveOccurrence(s, first.id);
  assert.equal(s.entities.has(markerId), false);
  assert.equal(s.content.definitions.length, 1);
  assert.equal(s.note(room.note.path), preservedText);
  s.undo();
  assert.ok(s.entities.has(markerId));
  assert.equal(s.content.archive.length, 0);
  s.redo();
  restoreArchive(s, archivedOccurrence.id);
  assert.ok(s.entities.has(markerId));
  assert.equal(s.content.occurrences.length, 2);
  const archivedDefinition = archiveDefinition(s, definition.id);
  assert.equal(s.content.definitions.length, 0);
  assert.equal(s.content.occurrences.length, 0);
  restoreArchive(s, archivedDefinition.id);
  assert.equal(analyzeDungeon(s.content).xp, 1800);
  const archivedRoute = archiveRoute(s, route.id);
  assert.equal(s.content.routes.length, 0);
  restoreArchive(s, archivedRoute.id);
  assert.equal(s.content.routes[0]?.bossGoalOrder, 1);
  const store = new MemoryStore(),
    repository = new MapRepository(store, mapPath);
  await repository.save(s);
  const reopened = await new MapRepository(store, mapPath).open();
  assert.deepEqual(reopened.content, s.content);
  assert.equal(analyzeDungeon(reopened.content).lootValue, 300);
});

test("new room keys can embed the native map without duplicating map state", () => {
  const session = new Session(newDocument("Eingebettet", 20, 20)),
    floor = session.floors.keys().next().value!,
    room = createRoom(
      session,
      floor,
      [
        { x: 1, y: 1 },
        { x: 8, y: 1 },
        { x: 8, y: 8 },
        { x: 1, y: 8 },
      ],
      "Dungeons/Eingebettet/Räume",
      {},
      "Dungeons/Eingebettet/Karte.dungeon",
    );
  assert.equal(
    session.note(room.note.path),
    `---\nroom_id: "${room.id}"\n---\n# 1 Raum 1\n\n![[Dungeons/Eingebettet/Karte.dungeon]]\n\n`,
  );
  assert.equal(session.document().content.definitions.length, 0);
  session.undo();
  assert.equal(session.note(room.note.path), null);
});

test("archiving a selected room keeps its text and restores dependent map content", () => {
  const { s, floor, room } = fixture(),
    door = createDoor(s, room, 0, 0.5),
    object = createObject(s, floor, { x: 6, y: 6 }),
    definition = createFeatureDefinition(s, {
      name: "Schlüssel",
      kind: "loot",
      lootValue: 20,
    }),
    occurrence = createFeatureOccurrence(
      s,
      definition.id,
      room.id,
      1,
      object.id,
    ),
    route = createRoute(s, {
      name: "Eingang",
      entrance: true,
      toRoomId: room.id,
      prerequisites: [],
    }),
    protectedText = s.note(room.note.path),
    beforeArchive = s.document(),
    bundle = archiveEntities(s, [room.id]);
  assert.deepEqual(
    new Set(bundle.entities.map((entity) => entity.id)),
    new Set([room.id, door.id, object.id]),
  );
  assert.equal(s.entities.has(room.id), false);
  assert.equal(
    s.content.occurrences.some((value) => value.id === occurrence.id),
    false,
  );
  assert.equal(
    s.content.routes.some((value) => value.id === route.id),
    false,
  );
  assert.equal(s.note(room.note.path), protectedText);
  restoreArchive(s, bundle.id);
  assert.ok(s.entities.has(room.id));
  assert.ok(s.entities.has(door.id));
  assert.ok(s.entities.has(object.id));
  assert.equal(s.content.occurrences[0]?.id, occurrence.id);
  assert.equal(s.content.routes[0]?.id, route.id);
  assert.equal(s.note(room.note.path), protectedText);
  assert.deepEqual(s.document(), beforeArchive);
});

test("archiving a floor preserves its keys and restores exact layer order", () => {
  const { s } = fixture(),
    upper = addFloor(s),
    room = createRoom(
      s,
      upper.id,
      [
        { x: 20, y: 20 },
        { x: 28, y: 20 },
        { x: 28, y: 27 },
        { x: 20, y: 27 },
      ],
      "Dungeons/Test/Räume",
    ),
    object = createObject(s, upper.id, { x: 23, y: 23 });
  s.execute({
    label: "Sperren",
    entities: [
      { id: object.id, before: object, after: { ...object, locked: true } },
    ],
  });
  const text = s.note(room.note.path),
    before = s.document(),
    bundle = archiveFloor(s, upper.id);
  assert.equal(s.floors.has(upper.id), false);
  assert.equal(s.entities.has(room.id), false);
  assert.equal(s.entities.has(object.id), false);
  assert.equal(s.note(room.note.path), text);
  assert.deepEqual(bundle.floors, [upper]);
  restoreArchive(s, bundle.id);
  assert.deepEqual(s.document(), before);
  assert.equal(s.note(room.note.path), text);
  assert.throws(
    () => archiveFloor(new Session(newDocument("Nur eins", 10, 10)), "missing"),
    /nicht gefunden/,
  );
});
