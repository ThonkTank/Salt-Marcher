import { prepareHeightGrid } from "../model/height-grid";
import {
  minimumCoarseHeightLevel,
  heightOverviewKey,
  type HeightOverviewTile,
} from "../model/overview";
import type { Bounds, HeightTile } from "../model/types";
import {
  MAX_RASTER_BATCH_PIXELS,
  MAX_RASTER_BATCH_TILES,
  rasterize,
} from "./raster";

export interface RasterTask {
  kind: "raster";
  id: number;
  sessionId: string;
  key: string;
  token: number;
  revision: number;
  power: number;
  bounds: Bounds;
  size: number;
  rect: [number, number, number, number];
}
export interface RasterResult extends Omit<RasterTask, "kind"> {
  kind: "raster-result";
  pixels: Uint8Array;
  cpuMs: number;
  samples: number;
  stages?: { sourceMs: number; sampleMs: number; colourMs: number };
}
export interface RasterBatch {
  kind: "raster-batch";
  id: number;
  sessionId: string;
  tasks: RasterTask[];
  /** Diagnostic clock only; never a native presentation timestamp. */
  sentAt?: number;
}
export interface RasterBatchResult {
  kind: "raster-batch-result";
  id: number;
  sessionId: string;
  results: RasterResult[];
  cpuMs: number;
  timing?: { sentAt: number; startedAt: number; finishedAt: number };
}
export type RasterMessage =
  | RasterBatch
  | {
      kind: "sources";
      sessionId: string;
      reset: boolean;
      tiles: HeightTile[];
      removed?: string[];
      overviews?: HeightOverviewTile[];
      overviewKeys?: string[];
    };

// This is a read-only snapshot mirror, not a second mutable document.
const sources = new Map<string, HeightTile>();
const overviews = new Map<string, HeightOverviewTile>();
const knownOverviews = new Set<string>();
const grids = new Map<number, ReturnType<typeof prepareHeightGrid>>();
let sessionId = "";

function renderTask(message: RasterTask, diagnostic: boolean): RasterResult {
  const begin = performance.now();
  const [x0, y0, x1, y1] = message.rect;
  const width = x1 - x0,
    height = y1 - y0;
  const span = message.size * 2 ** message.power;
  const overviewKey = heightOverviewKey(
    message.power,
    Math.round(message.bounds[0] / span),
    Math.round(message.bounds[1] / span),
  );
  if (!knownOverviews.has(overviewKey))
    throw new Error("Nicht bestätigte Höhenübersicht im Darstellungsauftrag.");
  const minimum = minimumCoarseHeightLevel(message.power);
  let grid = grids.get(minimum);
  if (!grid) {
    grid = prepareHeightGrid(
      [...sources.values()].filter((tile) => tile.level >= minimum),
    );
    grids.set(minimum, grid);
  }
  const sourceAt = diagnostic ? performance.now() : 0;
  const heights = grid(message.bounds, message.size, message.rect);
  const sampledAt = diagnostic ? performance.now() : 0;
  const pixels = rasterize(
    heights,
    message.bounds,
    message.size,
    message.rect,
    overviews.get(overviewKey)?.values,
  );
  const finishedAt = performance.now();
  return {
    ...message,
    kind: "raster-result",
    pixels,
    cpuMs: finishedAt - begin,
    samples: width * height,
    ...(diagnostic
      ? {
          stages: {
            sourceMs: sourceAt - begin,
            sampleMs: sampledAt - sourceAt,
            colourMs: finishedAt - sampledAt,
          },
        }
      : {}),
  };
}

self.onmessage = (event: MessageEvent<RasterMessage>) => {
  const message = event.data;
  if (message.kind === "sources") {
    if (message.reset || sessionId !== message.sessionId) {
      sources.clear();
      overviews.clear();
      knownOverviews.clear();
    }
    sessionId = message.sessionId;
    for (const key of message.removed ?? []) sources.delete(key);
    for (const tile of message.tiles) sources.set(tile.key, tile);
    for (const key of message.overviewKeys ?? []) {
      knownOverviews.add(key);
      overviews.delete(key);
    }
    for (const tile of message.overviews ?? []) overviews.set(tile.key, tile);
    grids.clear();
    return;
  }
  if (message.sessionId !== sessionId) return;
  const startedAt =
    message.sentAt === undefined
      ? undefined
      : performance.timeOrigin + performance.now();
  const pixels = message.tasks.reduce(
    (sum, task) =>
      sum + (task.rect[2] - task.rect[0]) * (task.rect[3] - task.rect[1]),
    0,
  );
  if (
    !message.tasks.length ||
    message.tasks.length > MAX_RASTER_BATCH_TILES ||
    pixels > MAX_RASTER_BATCH_PIXELS ||
    message.tasks.some((task) => task.sessionId !== sessionId)
  )
    throw new Error("Ungültiger oder zu großer Rasterauftrag.");
  const begin = performance.now();
  // One synchronous, bounded message uses one source version. Later source
  // messages cannot split its tiles, and no main-thread redispatch is needed.
  const results = message.tasks.map((task) =>
    renderTask(task, message.sentAt !== undefined),
  );
  const result: RasterBatchResult = {
    kind: "raster-batch-result",
    id: message.id,
    sessionId,
    results,
    cpuMs: performance.now() - begin,
    ...(startedAt === undefined
      ? {}
      : {
          timing: {
            sentAt: message.sentAt!,
            startedAt,
            finishedAt: performance.timeOrigin + performance.now(),
          },
        }),
  };
  self.postMessage(result, {
    transfer: results.map((tile) => tile.pixels.buffer),
  });
};
