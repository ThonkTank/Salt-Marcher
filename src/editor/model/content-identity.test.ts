import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  applyTestBrush,
  beginTestBrush,
  finishTestBrush,
} from "../../../tests/support/prepaidBrush";
import {
  EditorDocument,
  HEIGHT_LEVELS,
  HEIGHT_TILE_BYTES,
  WORLD_LIMIT,
  encodeHeightDependency,
  heightDependency,
  heightTilesFromControls,
  type Bounds,
  type HeightSnapshot,
} from "./index";

const bounds: Bounds = [-10, -10, 10, 10];
const world: Bounds = [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT];
function snapshot(tiles: HeightSnapshot["tiles"] = []): HeightSnapshot {
  return {
    sessionId: "identity",
    generation: 0,
    revision: 0,
    sequence: 0,
    bounds,
    levels: HEIGHT_LEVELS,
    tiles,
  };
}

describe("local semantic height identities", () => {
  it("matches Node SHA-256 over the same versioned bytes and ignores runtime metadata", async () => {
    const a = snapshot(
      heightTilesFromControls(0, [
        [0, 0, 12],
        [1, 1, -4],
      ]),
    );
    const hash = createHash("sha256");
    for (const bytes of encodeHeightDependency(a)) hash.update(bytes);
    const first = await heightDependency(a);
    expect(first.identity).toBe(`height-controls-v1:${hash.digest("hex")}`);
    const b = {
      ...a,
      sessionId: "reopen",
      generation: 91,
      revision: 80,
      sequence: 7,
      levels: [...HEIGHT_LEVELS].reverse(),
      tiles: a.tiles
        .map((tile) => ({
          ...tile,
          revision: 900,
          values: tile.values.slice(),
        }))
        .reverse(),
    };
    expect(await heightDependency(b)).toEqual(first);
  });

  it("excludes unrelated controls in the same source tile but notices a new supported source", async () => {
    const a = snapshot(
      heightTilesFromControls(0, [
        [0, 0, 12],
        [50, 50, 6],
      ]),
    );
    const b = snapshot(
      heightTilesFromControls(0, [
        [0, 0, 12],
        [50, 50, 900],
      ]),
    );
    expect((await heightDependency(a)).identity).toBe(
      (await heightDependency(b)).identity,
    );
    const c = snapshot([
      ...a.tiles,
      ...heightTilesFromControls(5, [[-1, 0, 3]]),
    ]);
    expect((await heightDependency(c)).identity).not.toBe(
      (await heightDependency(a)).identity,
    );
  });

  it("canonicalizes known zero and excludes controls touching only the zero-support edge", async () => {
    const empty = await heightDependency(snapshot());
    const values = heightTilesFromControls(0, [
      [4, 0, 50],
      [0, 0, 1],
    ])[0];
    values.values[0] = -0;
    expect(await heightDependency(snapshot([values]))).toEqual(empty);
    const edge = snapshot(heightTilesFromControls(0, [[3, 0, 50]]));
    expect((await heightDependency(edge)).identity).not.toBe(empty.identity);
  });

  it("requires every level and rejects duplicate source records", () => {
    const one = snapshot(heightTilesFromControls(0, [[0, 0, 1]]));
    expect(() => [...encodeHeightDependency({ ...one, levels: [0] })]).toThrow(
      /vollständigen/,
    );
    expect(() => [
      ...encodeHeightDependency({
        ...one,
        tiles: [...one.tiles, ...one.tiles],
      }),
    ]).toThrow(/Doppelte/);
    const unknown = new EditorDocument("unknown");
    expect(() => unknown.snapshot(bounds)).toThrow(/geladen/);
  });

  it("restores A after a genuine height edit and Undo despite increasing revisions; survives cold reload", async () => {
    const doc = new EditorDocument("source-history", { empty: true });
    const before = await heightDependency(doc.snapshot(bounds));
    beginTestBrush(doc, { level: 0, amount: 20, radius: 15 });
    applyTestBrush(doc, [0, 0], [0, 0], 50);
    const edit = finishTestBrush(doc)!;
    const after = await heightDependency(doc.snapshot(bounds));
    expect(after.identity).not.toBe(before.identity);
    doc.undo();
    expect(doc.revision).toBeGreaterThan(edit.revision);
    expect(await heightDependency(doc.snapshot(bounds))).toEqual(before);
    doc.redo();
    expect(await heightDependency(doc.snapshot(bounds))).toEqual(after);
    const copy = doc.snapshot(bounds);
    const cold = new EditorDocument("cold", { sequence: doc.sequence });
    cold.acceptCoverage(bounds, copy.tiles, doc.sequence);
    expect(await heightDependency(cold.snapshot(bounds))).toEqual(after);
  });

  it("checks a bounded snapshot before copying any source buffers", () => {
    const doc = new EditorDocument("snapshot-budget");
    doc.acceptCoverage(
      world,
      heightTilesFromControls(0, [
        [0, 0, 1],
        [-1, 0, 1],
      ]),
    );
    const before = doc.metrics;
    expect(() =>
      doc.snapshot(bounds, HEIGHT_LEVELS, HEIGHT_TILE_BYTES),
    ).toThrow(/Speicherbudget/);
    expect(doc.metrics).toEqual(before);
    expect(
      doc.snapshot(bounds, HEIGHT_LEVELS, 2 * HEIGHT_TILE_BYTES).tiles,
    ).toHaveLength(2);
  });
});
