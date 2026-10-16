import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newDocument, parseDocument, serializeDocument, type SmartTileCell,
} from "../../src/model";
import { resizeMap, type MapMargins } from "../../src/commands";
import { Session } from "../../src/session";

function source(width: number, height: number, cells: readonly [number, number][]) {
  const document = newDocument("Smart Tile Rand", width, height);
  const floorId = document.floors[0]!.id;
  return { ...document,
    smartTiles: cells.map(([x, y]): SmartTileCell => ({
      floorId, x, y, assetId: "pack:QASmart1/smart", color: 0x665544,
    })) };
}

function occupied(session: Session): readonly [number, number][] {
  return (session.document().smartTiles ?? []).map((cell): [number, number] =>
    [cell.x, cell.y]);
}

const margins = (left = 0, right = 0, top = 0, bottom = 0): MapMargins =>
  ({ left, right, top, bottom });

test("DD-038 Smart Tile raster follows four measured crop and reopen sequences", () => {
  const rows = (xs: readonly number[], ys: readonly number[]) =>
    ys.flatMap((y) => xs.map((x): [number, number] => [x, y]));
  const cases = [
    { name: "left", source: source(12, 8, rows([1, 2, 3, 4, 5], [1, 7])),
      crop: margins(-3), expand: margins(3), remaining: 6, live: 6,
      cropCells: rows([0, 1, 2], [1, 7]),
      liveCells: rows([3, 4, 5], [1, 7]) },
    { name: "right", source: source(12, 8, rows([7, 8, 9, 10, 11], [1, 7])),
      crop: margins(0, -3), expand: margins(0, 3), remaining: 4, live: 10,
      cropCells: rows([7, 8], [1, 7]),
      liveCells: rows([7, 8, 9, 10, 11], [1, 7]) },
    { name: "top", source: source(12, 10, rows([7, 8, 9, 10, 11], [0, 6])),
      crop: margins(0, 0, -2), expand: margins(0, 0, 2), remaining: 5, live: 5,
      cropCells: rows([7, 8, 9, 10, 11], [4]),
      liveCells: rows([7, 8, 9, 10, 11], [6]) },
    { name: "bottom", source: source(12, 10, rows([7, 8, 9, 10, 11], [3, 9])),
      crop: margins(0, 0, 0, -2), expand: margins(0, 0, 0, 2), remaining: 5, live: 10,
      cropCells: rows([7, 8, 9, 10, 11], [3]),
      liveCells: rows([7, 8, 9, 10, 11], [3, 9]) },
  ];
  for (const item of cases) {
    const session = new Session(item.source);
    resizeMap(session, item.crop);
    assert.deepEqual(occupied(session), item.cropCells, item.name + " crop");
    const cropSnapshot = session.snapshot();
    session.markSaved(cropSnapshot);
    assert.equal(session.dirty, false, item.name + " saved crop");
    assert.equal(parseDocument(serializeDocument(cropSnapshot.document)).smartTiles?.length,
      item.remaining);
    resizeMap(session, item.expand);
    assert.deepEqual(occupied(session), item.liveCells, item.name + " live expansion");
    assert.equal(session.historySize, 0);
    const reopened = new Session(parseDocument(serializeDocument(cropSnapshot.document)));
    resizeMap(reopened, item.expand);
    const freshCells = item.cropCells.map(([x, y]): [number, number] =>
      [x + item.expand.left, y + item.expand.top]);
    assert.deepEqual(occupied(reopened), freshCells,
      item.name + " fresh expansion");
  }
});

test("optional V4 Smart Tile cells validate and older cards stay unchanged", () => {
  const document = newDocument("Leer", 12, 8);
  assert.equal(document.smartTiles, undefined);
  const session = new Session(document);
  resizeMap(session, margins(0, 1));
  assert.equal(session.document().smartTiles, undefined);
  assert.doesNotMatch(serializeDocument(session.document()), /smartTiles/);
  const withCells = source(12, 8, [[1, 1]]);
  assert.throws(() => parseDocument(JSON.stringify({ ...withCells, version: 3 })));
  assert.throws(() => parseDocument(JSON.stringify({ ...withCells,
    smartTiles: [{ ...withCells.smartTiles[0], x: 12 }] })));
  assert.throws(() => parseDocument(JSON.stringify({ ...withCells,
    smartTiles: [withCells.smartTiles[0], withCells.smartTiles[0]] })));
});
