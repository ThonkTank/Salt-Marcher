import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { heightTilesFromControls } from "../model/fixtures";
import { heightOverviewKey } from "../model/overview";
import { colour } from "./raster";
import type {
  RasterBatch,
  RasterBatchResult,
  RasterMessage,
  RasterTask,
} from "./raster.worker";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

async function worker() {
  const replies: RasterBatchResult[] = [];
  const host = {
    onmessage: null as ((event: MessageEvent<RasterMessage>) => void) | null,
    postMessage(
      result: RasterBatchResult,
      options: { transfer: ArrayBuffer[] },
    ) {
      replies.push(structuredClone(result, options));
    },
  };
  vi.stubGlobal("self", host);
  await import("./raster.worker");
  return {
    replies,
    send: (message: RasterMessage) =>
      host.onmessage!({
        data: structuredClone(message),
      } as MessageEvent<RasterMessage>),
  };
}

function task(id: number, x: number): RasterTask {
  return {
    kind: "raster",
    id,
    sessionId: "batch-session",
    key: `2:${x}:0`,
    token: id,
    revision: id,
    power: 2,
    size: 128,
    bounds: [x * 512, 0, (x + 1) * 512, 512],
    rect: [0, 0, 128, 128],
  };
}

function batch(tasks: RasterTask[]): RasterBatch {
  return {
    kind: "raster-batch",
    id: tasks[0].id,
    sessionId: "batch-session",
    tasks,
  };
}

it("returns all batch tiles from one source version before applying the next source message", async () => {
  const { send, replies } = await worker();
  const controls: [number, number, number][] = [];
  for (let y = -4; y <= 16; y++)
    for (let x = -4; x <= 16; x++) controls.push([x, y, 200]);
  const sources = heightTilesFromControls(4, controls);
  send({
    kind: "sources",
    sessionId: "batch-session",
    reset: true,
    tiles: sources,
    overviewKeys: [heightOverviewKey(2, 0, 0), heightOverviewKey(2, 1, 0)],
  });
  send(batch([task(1, 0), task(2, 1)]));
  // The next accepted input replaces source buffers; previously computed batch
  // results must retain their own pixels and must not acquire a mixed version.
  send({
    kind: "sources",
    sessionId: "batch-session",
    reset: false,
    tiles: heightTilesFromControls(
      4,
      controls.map(([x, y]) => [x, y, 400]),
    ),
  });
  send(batch([task(3, 0), task(4, 1)]));
  expect(replies).toHaveLength(2);
  for (const [index, height] of [100, 300].entries()) {
    expect(replies[index].results).toHaveLength(2);
    for (const result of replies[index].results) {
      expect(result.sessionId).toBe("batch-session");
      expect(result.samples).toBe(128 * 128);
      for (let offset = 0; offset < result.pixels.length; offset += 4)
        expect([...result.pixels.slice(offset, offset + 4)]).toEqual([
          ...colour(height),
          255,
        ]);
    }
  }
});

it("rejects both tile-count and pixel-work overflow before raster work begins", async () => {
  const { send, replies } = await worker();
  send({ kind: "sources", sessionId: "batch-session", reset: true, tiles: [] });
  expect(() =>
    send(
      batch(Array.from({ length: 9 }, (_, index) => task(index + 1, index))),
    ),
  ).toThrow("zu großer Rasterauftrag");
  expect(() =>
    send(
      batch(
        Array.from({ length: 17 }, (_, index) => ({
          ...task(index + 1, index),
          rect: [0, 0, 1, 1],
        })),
      ),
    ),
  ).toThrow("zu großer Rasterauftrag");
  expect(replies).toHaveLength(0);
});

it("rejects mixed sessions and ignores a batch from the previous document", async () => {
  const { send, replies } = await worker();
  send({ kind: "sources", sessionId: "batch-session", reset: true, tiles: [] });
  expect(() => send(batch([{ ...task(1, 0), sessionId: "previous" }]))).toThrow(
    "Ungültiger",
  );
  send({ ...batch([task(2, 0)]), sessionId: "previous" });
  expect(replies).toHaveLength(0);
});
