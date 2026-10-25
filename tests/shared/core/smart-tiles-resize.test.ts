import assert from "node:assert/strict";
import { test } from "node:test";
import {
  newDocument,
  parseDocument,
  serializeDocument,
  type SmartTileCell,
} from "../../../src/model";

function source(
  width: number,
  height: number,
  cells: readonly [number, number][],
) {
  const document = newDocument("Smart Tile Rand", width, height);
  const floorId = document.floors[0]!.id;
  return {
    ...document,
    smartTiles: cells.map(
      ([x, y]): SmartTileCell => ({
        floorId,
        x,
        y,
        assetId: "pack:QASmart1/smart",
        color: 0x665544,
      }),
    ),
  };
}

test("optional V4 Smart Tile cells validate and older cards stay unchanged", () => {
  const document = newDocument("Leer", 12, 8);
  assert.equal(document.smartTiles, undefined);
  assert.equal(
    parseDocument(serializeDocument(document)).smartTiles,
    undefined,
  );
  assert.doesNotMatch(serializeDocument(document), /smartTiles/);
  const withCells = source(12, 8, [[1, 1]]);
  assert.throws(() =>
    parseDocument(JSON.stringify({ ...withCells, version: 3 })),
  );
  assert.throws(() =>
    parseDocument(
      JSON.stringify({
        ...withCells,
        smartTiles: [{ ...withCells.smartTiles[0], x: 12 }],
      }),
    ),
  );
  assert.throws(() =>
    parseDocument(
      JSON.stringify({
        ...withCells,
        smartTiles: [withCells.smartTiles[0], withCells.smartTiles[0]],
      }),
    ),
  );
});
