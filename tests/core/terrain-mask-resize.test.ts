import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeTerrainMask, encodeTerrainMask, newDocument, parseDocument,
  serializeDocument,
} from "../../src/model";
import { resizeMap } from "../../src/commands";
import { Session } from "../../src/session";

function patterned(width: number, height: number, seed: number): string {
  const bytes = new Uint8Array(width * height * 64);
  for (let y = 0; y < height * 4; y++)
    for (let x = 0; x < width * 4; x++) {
      const offset = (y * width * 4 + x) * 4;
      bytes.set([(x * 7 + seed) % 256, (y * 11 + seed) % 256,
        (x + y + seed) % 256, seed], offset);
    }
  return encodeTerrainMask(bytes);
}
function bytes(session: Session, key: "splat" | "splat2") {
  const mask = session.document().terrainMasks![0]!;
  return decodeTerrainMask(mask[key]!, session.settings.width, session.settings.height);
}
function expected(source: Uint8Array, oldWidth: number, oldHeight: number,
  width: number, height: number, left: number, top: number) {
  const out = new Uint8Array(width * height * 64);
  for (let y = 0; y < height * 4; y++)
    for (let x = 0; x < width * 4; x++) {
      const to = (y * width * 4 + x) * 4;
      const fromX = x - left * 4, fromY = y - top * 4;
      if (fromX >= 0 && fromX < oldWidth * 4 &&
          fromY >= 0 && fromY < oldHeight * 4)
        out.set(source.subarray((fromY * oldWidth * 4 + fromX) * 4,
          (fromY * oldWidth * 4 + fromX) * 4 + 4), to);
      else out[to] = 255;
    }
  return out;
}

test("DD-038 both terrain splats shift, crop, save and reopen without hidden samples", () => {
  const base = newDocument("Terrain", 8, 8);
  const document = { ...base, terrainMasks: [{ floorId: base.floors[0]!.id,
    splat: patterned(8, 8, 17), splat2: patterned(8, 8, 29) }] };
  const session = new Session(document);
  for (const [margin, size] of [
    [{ left: 1, right: 0, top: 0, bottom: 0 }, [9, 8]],
    [{ left: 0, right: 0, top: 1, bottom: 0 }, [9, 9]],
    [{ left: 0, right: -1, top: 0, bottom: 0 }, [8, 9]],
    [{ left: 0, right: 0, top: 0, bottom: -1 }, [8, 8]],
    [{ left: 0, right: 1, top: 0, bottom: 0 }, [9, 8]],
    [{ left: 0, right: 0, top: 0, bottom: 1 }, [9, 9]],
  ] as const) {
    const previous = [bytes(session, "splat"), bytes(session, "splat2")];
    const oldWidth = session.settings.width, oldHeight = session.settings.height;
    resizeMap(session, margin);
    assert.deepEqual([session.settings.width, session.settings.height], size);
    for (const [index, key] of (["splat", "splat2"] as const).entries())
      assert.deepEqual(bytes(session, key), expected(previous[index]!,
        oldWidth, oldHeight, size[0], size[1], margin.left, margin.top), key);
    const saved = parseDocument(serializeDocument(session.document()));
    assert.deepEqual(saved.terrainMasks, session.document().terrainMasks);
    session.markSaved(session.snapshot());
    assert.equal(session.dirty, false);
  }
  const reopened = new Session(parseDocument(serializeDocument(session.document())));
  assert.deepEqual(reopened.document().terrainMasks, session.document().terrainMasks);
  assert.equal(reopened.dirty, false);
});

test("optional V4 terrain masks validate and absent maps retain their shape", () => {
  const base = newDocument("Ohne Terrain", 8, 8);
  const session = new Session(base);
  resizeMap(session, { left: 1, right: 0, top: 0, bottom: 0 });
  assert.equal(session.document().terrainMasks, undefined);
  const mask = { floorId: base.floors[0]!.id, splat: patterned(8, 8, 3) };
  const parse = (masks: unknown, version = 4) => parseDocument(JSON.stringify({
    ...base, version, terrainMasks: masks,
  }));
  assert.throws(() => parse([mask], 3));
  assert.throws(() => parse([mask, mask]));
  assert.throws(() => parse([{ ...mask, splat: "AAAA" }]));
  assert.throws(() => parse([{ ...mask, floorId: "missing" }]));
});
