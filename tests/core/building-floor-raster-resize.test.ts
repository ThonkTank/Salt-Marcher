import { test } from "node:test";
import assert from "node:assert/strict";
import { newDocument, parseDocument, serializeDocument, type Building, type SmartTileCell } from "../../src/model";
import { duplicateFloor, planBuildingContourMutation, planBuildingMutation, resizeMap } from "../../src/commands";
import { composeBuilding } from "../../src/compute";
import { Session } from "../../src/session";
import { buildingFloorCells, buildingFloorCellsAfterDraw, buildingFloorCellsAfterErase, buildingFloorCellsAfterPointEdit } from "../../src/features/material/building-floor-cells";
import { buildingVertexGrip, planBuildingBackspacePoint } from "../../src/features/bau/building-point-gestures";

const STYLE = "pack:dungeondraft-builtin-1.2.0.1:tileset:res%3A%2F%2Ftextures%2Ftilesets%2Fsmart%2Ftileset_wood_vertical.png";
const STONE = "pack:dungeondraft-builtin-1.2.0.1:tileset:res%3A%2F%2Ftextures%2Ftilesets%2Fsmart_double%2Ftileset_stone.png";
function building(id: string, floorId: string, y: number): Building {
  return { id, floorId, kind: "building", polygons: [{ outer: [
    { x: 0, y }, { x: 2, y }, { x: 2, y: y + 2 }, { x: 0, y: y + 2 },
  ], holes: [] }], layer: 200, fill: 0xb28f6f, wall: 0x444444,
    wallWidth: 0, floorTileRaster: true,
    material: { assetId: STYLE, tileSize: 4, tint: 0xb28f6f, rotation: 0 } };
}
const coords = (session: Session) => session.document().smartTiles?.map((cell) =>
  [cell.x, cell.y]);

test("DD-038 UI floor cells are stored with the Building and remain cropped after reexpand", () => {
  const document = newDocument("Building crop", 18, 12);
  const session = new Session(document), floorId = document.floors[0]!.id;
  const first = building("wood", floorId, 0), second = building("diamond", floorId, 3);
  for (const item of [first, second]) {
    const before = session.smartTiles;
    session.execute({ label: "Grundriss zeichnen",
      entities: [{ id: item.id, before: null, after: item }],
      smartTiles: { before, after: [...(before ?? []),
        ...buildingFloorCells(item, 18, 12)] } });
    if (item.id === "wood") {
      session.undo();
      assert.equal(session.entities.size, 0);
      assert.equal(session.smartTiles?.length ?? 0, 0);
      session.redo();
      assert.equal(session.entities.size, 1);
      assert.equal(session.smartTiles?.length, 4);
    }
  }
  assert.equal(session.smartTiles?.length, 8);
  assert.deepEqual(coords(session), [[0, 0], [1, 0], [0, 1], [1, 1],
    [0, 3], [1, 3], [0, 4], [1, 4]]);
  const polygons = session.document().entities.map((item) => item.kind === "building"
    ? item.polygons : undefined);
  resizeMap(session, { left: -1, right: 0, top: 0, bottom: 0 });
  assert.equal(session.document().smartTiles?.length, 4);
  const cropped = parseDocument(serializeDocument(session.document()));
  resizeMap(session, { left: 1, right: 0, top: 0, bottom: 0 });
  assert.deepEqual(coords(session), [[1, 0], [1, 1], [1, 3], [1, 4]]);
  assert.deepEqual(session.document().entities.map((item) => item.kind === "building"
    ? item.polygons : undefined), polygons);
  const fresh = new Session(cropped);
  resizeMap(fresh, { left: 1, right: 0, top: 0, bottom: 0 });
  assert.deepEqual(coords(fresh), coords(session));
  assert.equal(fresh.historySize, 0);
});

test("tracked Building cells follow floor duplication and disappear with deletion", () => {
  const document = newDocument("Building copy", 18, 12);
  const session = new Session(document), floorId = document.floors[0]!.id;
  const item = building("wood", floorId, 0);
  session.execute({ label: "Grundriss zeichnen",
    entities: [{ id: item.id, before: null, after: item }],
    smartTiles: { before: undefined, after: buildingFloorCells(item, 18, 12) } });
  const copied = duplicateFloor(session, floorId);
  assert.equal(session.smartTiles?.length, 8);
  assert.equal(session.smartTiles?.filter((cell) => cell.floorId === copied.id).length, 4);
  assert.ok(session.smartTiles?.filter((cell) => cell.floorId === copied.id)
    .every((cell) => cell.buildingId !== item.id));
  session.execute({ label: "Grundriss löschen",
    entities: [{ id: item.id, before: item, after: null }] });
  assert.equal(session.smartTiles?.length, 4);
  session.undo();
  assert.equal(session.smartTiles?.length, 8);
});

test("Alt erase removes only the Wood cells covered by the changed contour in one undo step", () => {
  const document = newDocument("Building erase", 18, 12);
  const session = new Session(document), floorId = document.floors[0]!.id;
  const wood = building("wood", floorId, 0);
  const diamond = building("diamond", floorId, 3);
  for (const item of [wood, diamond]) {
    const before = session.smartTiles;
    session.execute({ label: "Grundriss zeichnen",
      entities: [{ id: item.id, before: null, after: item }],
      smartTiles: { before, after: [...(before ?? []),
        ...buildingFloorCells(item, 18, 12)] } });
  }
  const result = composeBuilding({ kind: "compose-building", nativeBuilding: true,
    sources: [wood, diamond], shape: [{ outer: [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 2 }, { x: 0, y: 2 },
    ], holes: [] }], erase: true });
  const plan = planBuildingMutation({ entities: [...session.entities.values()],
    floorId, result, expectedRevision: session.revision,
    currentRevision: session.revision });
  assert.ok(plan.command);
  const previous = session.smartTiles;
  session.execute({ ...plan.command, smartTiles: { before: previous,
    after: buildingFloorCellsAfterErase(previous, plan.command.entities, 18, 12) } });
  assert.deepEqual(coords(session), [[1, 0], [1, 1],
    [0, 3], [1, 3], [0, 4], [1, 4]]);
  const afterWood = session.entities.get("wood");
  assert.equal(afterWood?.kind, "building");
  if (afterWood?.kind !== "building") return;
  assert.equal(afterWood.polygons.length, 1);
  assert.deepEqual(new Set(afterWood.polygons[0]!.outer.map((point) =>
    `${point.x}:${point.y}`)), new Set(["1:0", "2:0", "2:2", "1:2"]));
  session.undo();
  assert.equal(session.smartTiles?.length, 8);
  session.redo();
  assert.equal(session.smartTiles?.length, 6);
  assert.deepEqual(parseDocument(serializeDocument(session.document())).smartTiles,
    session.document().smartTiles);
  const half = [{ outer: [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 2 }, { x: 0, y: 2 },
  ], holes: [] }];
  const drawn = composeBuilding({ kind: "compose-building", nativeBuilding: true,
    mergeTouching: true, sources: [{ id: "wood", polygons: afterWood.polygons }],
    shape: half, erase: false });
  assert.equal(drawn.mode, "draw");
  if (drawn.mode !== "draw") return;
  assert.deepEqual(drawn.mergedIds, ["wood"]);
  const redraw = planBuildingMutation({ entities: [...session.entities.values()],
    floorId, result: drawn, expectedRevision: session.revision,
    currentRevision: session.revision });
  assert.ok(redraw.command);
  const reunited = redraw.command.entities?.find((change) => change.id === "wood")?.after;
  assert.equal(reunited?.kind, "building");
  if (reunited?.kind !== "building") return;
  const beforeRedraw = session.smartTiles;
  session.execute({ ...redraw.command, smartTiles: { before: beforeRedraw,
    after: buildingFloorCellsAfterDraw(beforeRedraw, reunited,
      drawn.mergedIds, half, 18, 12) } });
  assert.deepEqual(new Set(session.smartTiles?.map((cell) => `${cell.x}:${cell.y}`)),
    new Set(["0:0", "1:0", "0:1", "1:1", "0:3", "1:3", "0:4", "1:4"]));
  assert.equal((session.entities.get("wood") as Building).polygons.length, 1);
  session.undo();
  assert.equal(session.smartTiles?.length, 6);
  session.redo();
  assert.equal(session.smartTiles?.length, 8);
});

test("DD-038 interior erase retains the native floor tile beneath the hole", () => {
  const document = newDocument("Building hole", 8, 8);
  const session = new Session(document), floorId = document.floors[0]!.id;
  const source = { ...building("wood", floorId, 1), polygons: [{ outer: [
    { x: 1, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 4 }, { x: 1, y: 4 },
  ], holes: [] }] };
  const previous = buildingFloorCells(source, 8, 8);
  assert.equal(previous.length, 18);
  session.execute({ label: "Grundriss zeichnen", entities: [{ id: source.id,
    before: null, after: source }], smartTiles: { before: undefined, after: previous } });
  const result = composeBuilding({ kind: "compose-building", nativeBuilding: true,
    sources: [source], shape: [{ outer: [
      { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 3, y: 3 },
    ], holes: [] }], erase: true });
  const plan = planBuildingMutation({ entities: [...session.entities.values()],
    floorId, result, expectedRevision: session.revision,
    currentRevision: session.revision });
  assert.ok(plan.command);
  session.execute({ ...plan.command, smartTiles: { before: previous,
    after: buildingFloorCellsAfterErase(previous, plan.command.entities, 8, 8) } });
  const after = session.entities.get(source.id);
  assert.equal(after?.kind, "building");
  if (after?.kind !== "building") return;
  assert.equal(after.polygons.length, 1);
  assert.equal(after.polygons[0]!.holes.length, 1);
  assert.deepEqual(new Set(after.polygons[0]!.holes[0]!.map((point) =>
    `${point.x}:${point.y}`)), new Set(["3:2", "4:2", "4:3", "3:3"]));
  assert.equal(session.smartTiles?.length, 18);
  assert.ok(session.smartTiles?.some((cell) => cell.x === 3 && cell.y === 2));
  session.undo();
  assert.equal((session.entities.get(source.id) as Building).polygons[0]!.holes.length, 0);
  session.redo();
  assert.equal(session.smartTiles?.length, 18);
  assert.deepEqual(parseDocument(serializeDocument(session.document())).smartTiles,
    session.document().smartTiles);
});

test("DD-038 interior Alt hole repaints its retained cells in the selected native style", () => {
  const document = newDocument("Mixed Building hole", 8, 8);
  const floorId = document.floors[0]!.id;
  const source: Building = { ...building("mixed", floorId, 1), polygons: [{ outer: [
    { x: 1, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 7 }, { x: 1, y: 7 },
  ], holes: [] }] };
  const original = buildingFloorCells(source, 8, 8).map((cell) =>
    cell.x >= 4 && cell.y <= 3
      ? { ...cell, assetId: STONE, color: 0x7f7e71 } : cell);
  assert.equal(original.length, 36);
  const shape = [{ outer: [
    { x: 3, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 5 }, { x: 3, y: 5 },
  ], holes: [] }];
  for (const selected of [
    { assetId: STYLE, color: 0xb28f6f, changed: ["4:3"] },
    { assetId: STONE, color: 0x7f7e71, changed: ["3:3", "3:4", "4:4"] },
  ]) {
    const session = new Session({ ...document, entities: [source], smartTiles: original });
    const result = composeBuilding({ kind: "compose-building", nativeBuilding: true,
      sources: [source], shape, erase: true });
    const plan = planBuildingMutation({ entities: [...session.entities.values()],
      floorId, result, expectedRevision: session.revision,
      currentRevision: session.revision });
    assert.ok(plan.command);
    session.execute({ ...plan.command, smartTiles: { before: original,
      after: buildingFloorCellsAfterErase(original, plan.command.entities,
        8, 8, shape, selected) } });
    const after = session.document();
    assert.equal(after.entities.length, 1);
    assert.equal((after.entities[0] as Building).polygons[0]!.holes.length, 1);
    assert.equal(after.smartTiles?.length, 36);
    const changed = after.smartTiles?.filter((cell, index) =>
      cell.assetId !== original[index]?.assetId ||
      cell.color !== original[index]?.color).map((cell) => `${cell.x}:${cell.y}`);
    assert.deepEqual(changed?.sort(), selected.changed.sort());
    for (const [x, y] of [[3, 3], [4, 3], [3, 4], [4, 4]]) {
      const paintedCell: SmartTileCell | undefined = after.smartTiles?.find(
        (item) => item.x === x && item.y === y);
      assert.equal(paintedCell?.assetId, selected.assetId);
      assert.equal(paintedCell?.color, selected.color);
    }
    assert.equal(session.historySize, 1);
    session.undo();
    assert.deepEqual(session.document().smartTiles, original);
    assert.equal((session.document().entities[0] as Building).polygons[0]!.holes.length, 0);
    session.redo();
    assert.deepEqual(session.document(), after);
    assert.deepEqual(parseDocument(serializeDocument(after)).smartTiles,
      after.smartTiles);
  }
});

test("drawing beside a retained contour leaves a prior crop gap empty", () => {
  const full = building("wood", "floor-1", 0);
  const retained = buildingFloorCells(full, 18, 12).filter((cell) => cell.x === 1);
  const next = buildingFloorCellsAfterDraw(retained,
    { ...full, polygons: [{ outer: [
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 },
    ], holes: [] }] }, [full.id], [{ outer: [
      { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 2, y: 2 },
    ], holes: [] }], 18, 12);
  assert.deepEqual(new Set(next?.map((cell) => `${cell.x}:${cell.y}`)),
    new Set(["1:0", "1:1", "2:0", "2:1"]));
});

test("adjacent native floor styles share one contour while keeping per-cell style", () => {
  const document = newDocument("Mixed floor", 8, 8);
  const session = new Session(document), floorId = document.floors[0]!.id;
  const wood = { ...building("wood", floorId, 1), polygons: [{ outer: [
    { x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }, { x: 1, y: 4 },
  ], holes: [] }] };
  session.execute({ label: "Grundriss zeichnen", entities: [{ id: wood.id,
    before: null, after: wood }], smartTiles: { before: undefined,
    after: buildingFloorCells(wood, 8, 8) } });
  const stoneShape = [{ outer: [
    { x: 4, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 4 }, { x: 4, y: 4 },
  ], holes: [] }];
  const result = composeBuilding({ kind: "compose-building", nativeBuilding: true,
    mergeTouching: true, sources: [wood], shape: stoneShape, erase: false });
  assert.equal(result.mode, "draw");
  if (result.mode !== "draw") return;
  assert.deepEqual(result.mergedIds, ["wood"]);
  const plan = planBuildingMutation({ entities: [...session.entities.values()],
    floorId, result, expectedRevision: session.revision,
    currentRevision: session.revision });
  assert.ok(plan.command);
  const after = plan.command.entities?.find((change) => change.id === wood.id)?.after;
  assert.equal(after?.kind, "building");
  if (after?.kind !== "building") return;
  const previous = session.smartTiles;
  session.execute({ ...plan.command, smartTiles: { before: previous,
    after: buildingFloorCellsAfterDraw(previous, after, result.mergedIds,
      stoneShape, 8, 8, { assetId: STONE, color: 0x7f7e71 }) } });
  assert.equal(session.entities.size, 1);
  assert.equal(after.polygons.length, 1);
  assert.equal(session.smartTiles?.length, 18);
  assert.equal(session.smartTiles?.filter((cell) => cell.assetId === STYLE).length, 9);
  assert.equal(session.smartTiles?.filter((cell) => cell.assetId === STONE).length, 9);
  assert.ok(session.smartTiles?.filter((cell) => cell.assetId === STONE)
    .every((cell) => cell.color === 0x7f7e71 && cell.buildingId === wood.id));
  assert.deepEqual(parseDocument(serializeDocument(session.document())).smartTiles,
    session.document().smartTiles);
  session.undo();
  assert.equal(session.smartTiles?.length, 9);
  session.redo();
  assert.equal(session.smartTiles?.length, 18);
});

test("native point move repaints the bounding raster in the selected style with one Undo", () => {
  const document = newDocument("Mixed point", 8, 8);
  const floorId = document.floors[0]!.id;
  const before: Building = { ...building("mixed", floorId, 1), polygons: [{ outer: [
    { x: 1, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 4 }, { x: 1, y: 4 },
  ], holes: [] }] };
  const original = buildingFloorCells(before, 8, 8).map((cell) => cell.x < 4
    ? cell : { ...cell, assetId: STONE, color: 0x7f7e71 });
  const session = new Session({ ...document, entities: [before], smartTiles: original });
  const after: Building = { ...before, polygons: [{ outer: [
    { x: 1, y: 0 }, { x: 7, y: 1 }, { x: 7, y: 4 }, { x: 1, y: 4 },
  ], holes: [] }] };
  const command = planBuildingContourMutation({ entities: [...session.entities.values()],
    before, after, edit: { kind: "move", contour: 0, index: 0 },
    wallStyle: { wall: before.wall, wallAlpha: 255, wallBevel: false,
      wallWidth: 0, wallAssetId: undefined } });
  assert.ok(command);
  const withWall = planBuildingContourMutation({ entities: [...session.entities.values()],
    before, after, edit: { kind: "move", contour: 0, index: 0 },
    wallStyle: { wall: 0x333333, wallAlpha: 255, wallBevel: true,
      wallWidth: 0.2, wallAssetId: "pack:battlements" } });
  const walled = withWall?.entities?.find((change) => change.id === before.id)?.after;
  assert.equal(walled?.kind === "building" && walled.wallAssetId,
    "pack:battlements");
  const moved = command.entities?.find((change) => change.id === before.id)?.after;
  assert.equal(moved?.kind, "building");
  if (moved?.kind !== "building") return;
  session.execute({ ...command, smartTiles: { before: session.smartTiles,
    after: buildingFloorCellsAfterPointEdit(session.smartTiles, moved, 8, 8,
      { assetId: STONE, color: 0x7f7e71 }) } });
  assert.equal(session.historySize, 1);
  assert.equal(session.smartTiles?.length, 24);
  assert.ok(session.smartTiles?.every((cell) => cell.assetId === STONE &&
    cell.color === 0x7f7e71 && cell.buildingId === before.id));
  assert.deepEqual(new Set(session.smartTiles?.map((cell) => `${cell.x}:${cell.y}`)),
    new Set(Array.from({ length: 24 }, (_, i) =>
      `${1 + i % 6}:${Math.floor(i / 6)}`)));
  const saved = parseDocument(serializeDocument(session.document()));
  assert.deepEqual(saved.smartTiles, session.document().smartTiles);
  session.undo();
  assert.deepEqual(session.smartTiles, original);
  assert.deepEqual(session.entities.get(before.id), before);
  session.redo();
  assert.deepEqual(parseDocument(serializeDocument(session.document())), saved);
});

test("native edge-point insertion replaces mixed floor cells and restores them on Undo", () => {
  const document = newDocument("Mixed edge point", 8, 8);
  const floorId = document.floors[0]!.id;
  const before: Building = { ...building("mixed-edge", floorId, 1), polygons: [{ outer: [
    { x: 1, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 4 }, { x: 1, y: 4 },
  ], holes: [] }] };
  const original = buildingFloorCells(before, 8, 8).map((cell) => cell.x < 4
    ? cell : { ...cell, assetId: STONE, color: 0x7f7e71 });
  const session = new Session({ ...document, entities: [before], smartTiles: original });
  const after: Building = { ...before, polygons: [{ outer: [
    { x: 1, y: 1 }, { x: 4, y: 0.125 }, { x: 7, y: 1 },
    { x: 7, y: 4 }, { x: 1, y: 4 },
  ], holes: [] }] };
  const command = planBuildingContourMutation({ entities: [...session.entities.values()],
    before, after, edit: { kind: "insert", contour: 0, index: 1 },
    wallStyle: { wall: before.wall, wallAlpha: 255, wallBevel: true,
      wallWidth: 0, wallAssetId: undefined } });
  assert.ok(command);
  const inserted = command.entities?.find((change) => change.id === before.id)?.after;
  assert.equal(inserted?.kind, "building");
  if (inserted?.kind !== "building") return;
  session.execute({ ...command, smartTiles: { before: session.smartTiles,
    after: buildingFloorCellsAfterPointEdit(session.smartTiles, inserted, 8, 8,
      { assetId: STONE, color: 0x7f7e71 }) } });
  assert.equal(session.historySize, 1);
  assert.equal(session.smartTiles?.length, 24);
  assert.ok(session.smartTiles?.every((cell) => cell.assetId === STONE &&
    cell.color === 0x7f7e71));
  assert.deepEqual(new Set(session.smartTiles?.map((cell) => `${cell.x}:${cell.y}`)),
    new Set(Array.from({ length: 24 }, (_, i) =>
      `${1 + i % 6}:${Math.floor(i / 6)}`)));
  const stored = session.entities.get(before.id);
  assert.deepEqual(stored?.kind === "building" && stored.polygons[0]?.outer[1],
    { x: 4, y: 0.125 });
  const saved = parseDocument(serializeDocument(session.document()));
  session.undo();
  assert.deepEqual(session.smartTiles, original);
  assert.deepEqual(session.entities.get(before.id), before);
  session.redo();
  assert.deepEqual(parseDocument(serializeDocument(session.document())), saved);
});

test("native point Delete repaints triangular cell overlaps in the selected style", () => {
  const document = newDocument("Mixed delete point", 8, 8);
  const floorId = document.floors[0]!.id;
  const before: Building = { ...building("mixed-delete", floorId, 1), polygons: [{ outer: [
    { x: 1, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 4 }, { x: 1, y: 4 },
  ], holes: [] }] };
  const original = buildingFloorCells(before, 8, 8).map((cell) => cell.x < 4
    ? cell : { ...cell, assetId: STONE, color: 0x7f7e71 });
  const session = new Session({ ...document, entities: [before], smartTiles: original });
  const grip = buildingVertexGrip(before, { x: 1, y: 1 }, 0.2);
  assert.ok(grip);
  const result = planBuildingBackspacePoint([...session.entities.values()],
    before, grip!, { wall: before.wall, wallAlpha: 255, wallBevel: true,
      wallWidth: 0, wallAssetId: undefined });
  assert.equal(result.status, "command");
  if (result.status !== "command") return;
  const next = buildingFloorCellsAfterPointEdit(session.smartTiles, result.after,
    8, 8, { assetId: STONE, color: 0x7f7e71 }, "remove");
  session.execute({ ...result.command, smartTiles: {
    before: session.smartTiles, after: next } });
  assert.equal(session.historySize, 1);
  assert.deepEqual(session.entities.get(before.id)?.kind === "building" &&
    (session.entities.get(before.id) as Building).polygons[0]!.outer,
    [{ x: 7, y: 1 }, { x: 7, y: 4 }, { x: 1, y: 4 }]);
  assert.equal(session.smartTiles?.length, 12);
  assert.deepEqual(new Set(session.smartTiles?.map((cell) => `${cell.x}:${cell.y}`)),
    new Set(["5:1", "6:1", "3:2", "4:2", "5:2", "6:2",
      "1:3", "2:3", "3:3", "4:3", "5:3", "6:3"]));
  assert.ok(session.smartTiles?.every((cell) => cell.assetId === STONE &&
    cell.color === 0x7f7e71 && cell.buildingId === before.id));
  const saved = parseDocument(serializeDocument(session.document()));
  session.undo();
  assert.deepEqual(session.smartTiles, original);
  assert.deepEqual(session.entities.get(before.id), before);
  session.redo();
  assert.deepEqual(parseDocument(serializeDocument(session.document())), saved);
});
