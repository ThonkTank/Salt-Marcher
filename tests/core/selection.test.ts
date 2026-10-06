import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDocument, type Entity, type MapObject, type MapPath, type Light, type Door, type Roof, type Wall, type Surface } from "../../src/model";
import { Session } from "../../src/session";
import { readObjectArgb, writeObjectArgb } from "../../src/features/objekte/color-alpha";
import { createPrefab, placePrefab } from "../../src/prefabs";
import { createRoom, createObject, objectAtPoint, createLight, createPortal, createWall } from "../../src/commands";
import { compactWheelNavigation, wheelNavigation } from "../../src/navigation";
import { selectableByClick, selectionAllowed, selectionLayer, selectionLayers, selectionType, selectionCenter, selectionMirrorChanges, selectionTransformAt, selectionFrame, selectionFrameTransformAt, selectionInsideBox, transformSelectionGroup, scaleBoxSelection, scaleSelectionFrame, rotateBoxSelection, selectionStackChange, captureSelectionClipboard, copyAtViewportCenter, type SelectionType } from "../../src/selection";
import { compactObjectVisible, gridStep, objectNearViewport, fieldMeasurementLabel, pathRenderGroup, roomMeasurement } from "../../src/rendering";
import { MapRepository } from "../../src/persistence";
import { portalPose, moveEntity } from "../../src/geometry";
import { newDocument, MemoryStore } from "./fixtures";


test("repeated furniture placement and movement keep room ownership in one undo step", () => {
  const document = newDocument("Raumzuordnung", 16, 8),
    session = new Session(document),
    floor = document.floors[0]!.id,
    roomA = createRoom(session, floor,
      [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 5 }, { x: 1, y: 5 }],
      "Dungeons/Probe/Räume"),
    roomB = createRoom(session, floor,
      [{ x: 7, y: 1 }, { x: 11, y: 1 }, { x: 11, y: 5 }, { x: 7, y: 5 }],
      "Dungeons/Probe/Räume"),
    first = createObject(session, floor, { x: 2, y: 3 }),
    second = createObject(session, floor, { x: 4, y: 3 });
  assert.notEqual(first.id, second.id);
  assert.equal(first.roomId, roomA.id);
  assert.equal(second.roomId, roomA.id);
  const beforeMove = session.historySize,
    moved = objectAtPoint(session, first, { x: 9, y: 3 });
  session.execute({ label: "Möbel verschieben",
    entities: [{ id: first.id, before: first, after: moved }] });
  assert.equal(session.historySize, beforeMove + 1);
  assert.equal((session.entities.get(first.id) as MapObject).roomId, roomB.id);
  assert.deepEqual(session.entities.get(second.id), second);
  session.undo();
  assert.deepEqual(session.entities.get(first.id), first);
  session.redo();
  assert.deepEqual(session.entities.get(first.id), moved);
  assert.equal((parseDocument(JSON.stringify(session.document())).entities
    .find((entity) => entity.id === first.id) as MapObject).roomId, roomB.id);
  const outside = objectAtPoint(session, moved, { x: 6, y: 3 });
  assert.equal(Object.hasOwn(outside, "roomId"), false);
  session.execute({ label: "Möbel aus Raum verschieben",
    entities: [{ id: moved.id, before: moved, after: outside }] });
  const reopenedOutside = parseDocument(JSON.stringify(session.document()))
    .entities.find((entity) => entity.id === first.id);
  assert.deepEqual(reopenedOutside, outside);
  session.undo();
  assert.deepEqual(session.entities.get(first.id), moved);
});

test("DD-028 object alpha survives property history and a fresh document parse", () => {
  const document = newDocument("Objektfarbe", 8, 8);
  const session = new Session(document);
  const native = readObjectArgb("804080c0");
  const object = createObject(session, document.floors[0]!.id, { x: 3, y: 3 }, {
    rotation: 0,
    width: 1,
    height: 1,
    color: native.rgb,
    alpha: native.alphaByte,
    label: "",
    assetId: "pack:QAObjASl:object:textures%2Fobjects%2FQA%20Object%20Color.png",
  });
  session.execute({
    label: "Objektfarbe ändern",
    entities: [{ id: object.id, before: object, after: { ...object, alpha: 0 } }],
  });
  assert.equal((session.entities.get(object.id) as MapObject).alpha, 0);
  session.undo();
  assert.equal((session.entities.get(object.id) as MapObject).alpha, 128);
  session.redo();
  const saved = parseDocument(JSON.stringify(session.document()));
  const reopened = saved.entities.find((entity) => entity.id === object.id) as MapObject;
  assert.equal(writeObjectArgb({ rgb: reopened.color, alphaByte: reopened.alpha! }), "004080c0");
  assert.throws(() => new Session({ ...saved, entities: [{ ...reopened, alpha: 256 }] }), /Kartenobjekt/);
});

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
