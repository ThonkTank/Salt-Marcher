import { afterEach, expect, it, vi } from "vitest";
import {
  EditorDocument,
  HEIGHT_TILE_BYTES,
  SourcesNotReadyError,
  createCoastFixture,
  heightTilesFromControls,
  prepareHeightSampler,
  type Bounds,
  type HeightTile,
} from "../model";
import { Observation } from "../observation";
import { WorldRenderer } from "./WorldRenderer";
import type { RasterMessage } from "./raster.worker";

// This regression exercises source ownership and transfer, without a GL context.
vi.mock("pixi.js", () => ({
  BufferImageSource: class {},
  Container: class {
    addChild() {}
  },
  Graphics: class {},
  Sprite: class {},
  Texture: class {},
  WebGLRenderer: class {},
}));
vi.mock("pixi.js/unsafe-eval", () => ({}));

afterEach(() => vi.unstubAllGlobals());

it("mirrors coarse Undo/Redo after unrelated fine sources were evicted", () => {
  const mirror = new Map<string, HeightTile>();
  vi.stubGlobal(
    "Worker",
    class {
      postMessage(message: RasterMessage, transfer: ArrayBuffer[] = []) {
        // Real transfer semantics catch accidental detachment of history/store data.
        const received = structuredClone(message, { transfer });
        if (received.kind !== "sources") return;
        if (received.reset) mirror.clear();
        for (const key of received.removed ?? []) mirror.delete(key);
        for (const tile of received.tiles) mirror.set(tile.key, tile);
      }
    },
  );
  const broad: Bounds = [-20_000, -20_000, 20_000, 20_000];
  const detail: Bounds = [-3000, -2000, 3000, 2000];
  const distant = heightTilesFromControls(0, [[2000, 0, 25]])[0];
  const document = new EditorDocument("history-source-transfer");
  document.acceptCoverage(broad, [...createCoastFixture(), distant]);
  const original = document.sampleHeight(320, 0);
  document.beginGesture({ level: 8, radius: 12_000, amount: 100 });
  document.applyPoint([0, 0]);
  const edit = document.finishGesture()!;
  document.acceptPersistence(edit.sequence);
  const lifted = document.sampleHeight(320, 0);
  expect(lifted).toBeGreaterThan(original);

  expect(document.evictConfirmedOutside(detail)).toBeGreaterThan(0);
  expect(document.sourceState(distant.key)).toBe("unknown");
  const world = new WorldRenderer(new Observation());
  world.reset(document);
  world.updateSources(detail, [], true);
  const rendered = () => prepareHeightSampler([...mirror.values()])(320, 0);
  expect(rendered()).toBeCloseTo(lifted, 10);

  const undone = document.undo()!;
  // This is the old failure: history's full dirty region still has unknown data.
  expect(() => document.snapshot(undone.dirtyBounds[0])).toThrow(
    SourcesNotReadyError,
  );
  world.updateSourcePatches(undone.patches);
  expect(rendered()).toBeCloseTo(original, 10);
  expect(undone.patches.every((patch) => !mirror.has(patch.key))).toBe(true);

  const redone = document.redo()!;
  world.updateSourcePatches(redone.patches);
  expect(rendered()).toBeCloseTo(lifted, 10);
  expect(document.sampleHeight(320, 0)).toBeCloseTo(lifted, 10);
  expect(
    redone.patches.every(
      (patch) => patch.after?.values.byteLength === HEIGHT_TILE_BYTES,
    ),
  ).toBe(true);
  expect(document.sourceState(distant.key)).toBe("unknown");
  expect(document.isReady(redone.dirtyBounds[0])).toBe(false);
});
