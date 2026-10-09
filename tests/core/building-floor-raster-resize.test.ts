import { test } from "node:test";
import assert from "node:assert/strict";
import { newDocument, parseDocument, serializeDocument, type Building } from "../../src/model";
import { duplicateFloor, planBuildingMutation, resizeMap } from "../../src/commands";
import { composeBuilding } from "../../src/compute";
import { Session } from "../../src/session";
import { buildingFloorCells, buildingFloorCellsAfterDraw, buildingFloorCellsAfterErase } from "../../src/features/material/building-floor-cells";

const STYLE = "pack:dungeondraft-builtin-1.2.0.1:tileset:res%3A%2F%2Ftextures%2Ftilesets%2Fsmart%2Ftileset_wood_vertical.png";
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
