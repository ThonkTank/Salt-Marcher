import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeTerrainMask, newDocument, parseDocument } from "../../../src/model";

function patterned(width: number, height: number, seed: number): string {
  const bytes = new Uint8Array(width * height * 64);
  for (let y = 0; y < height * 4; y++)
    for (let x = 0; x < width * 4; x++) {
      const offset = (y * width * 4 + x) * 4;
      bytes.set(
        [
          (x * 7 + seed) % 256,
          (y * 11 + seed) % 256,
          (x + y + seed) % 256,
          seed,
        ],
        offset,
      );
    }
  return encodeTerrainMask(bytes);
}

test("optional V4 terrain masks validate and absent maps retain their shape", () => {
  const base = newDocument("Ohne Terrain", 8, 8);
  assert.equal(parseDocument(JSON.stringify(base)).terrainMasks, undefined);
  const mask = { floorId: base.floors[0]!.id, splat: patterned(8, 8, 3) };
  const parse = (masks: unknown, version = 4) =>
    parseDocument(
      JSON.stringify({
        ...base,
        version,
        terrainMasks: masks,
      }),
    );
  assert.throws(() => parse([mask], 3));
  assert.throws(() => parse([mask, mask]));
  assert.throws(() => parse([{ ...mask, splat: "AAAA" }]));
  assert.throws(() => parse([{ ...mask, floorId: "missing" }]));
});
