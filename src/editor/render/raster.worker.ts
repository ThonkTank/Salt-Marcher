import { prepareHeightSampler, type Bounds, type HeightTile } from "../model";
import { rasterize } from "./raster";

export interface RasterTask {
  kind: "raster";
  id: number;
  sessionId: string;
  key: string;
  token: number;
  revision: number;
  bounds: Bounds;
  size: number;
  rect: [number, number, number, number];
}
export interface RasterResult extends Omit<RasterTask, "kind"> {
  kind: "raster-result";
  pixels: Uint8Array;
  cpuMs: number;
  samples: number;
}
export type RasterMessage =
  | RasterTask
  | {
      kind: "sources";
      sessionId: string;
      reset: boolean;
      tiles: HeightTile[];
      removed?: string[];
    };

// This is a read-only snapshot mirror, not a second mutable document.
const sources = new Map<string, HeightTile>();
let sessionId = "";
let sample = prepareHeightSampler([]);

self.onmessage = (event: MessageEvent<RasterMessage>) => {
  const message = event.data;
  if (message.kind === "sources") {
    if (message.reset || sessionId !== message.sessionId) sources.clear();
    sessionId = message.sessionId;
    for (const key of message.removed ?? []) sources.delete(key);
    for (const tile of message.tiles) sources.set(tile.key, tile);
    sample = prepareHeightSampler([...sources.values()]);
    return;
  }
  if (message.sessionId !== sessionId) return;
  const begin = performance.now();
  const [x0, y0, x1, y1] = message.rect;
  const width = x1 - x0,
    height = y1 - y0;
  const pixels = rasterize(sample, message.bounds, message.size, message.rect);
  const result: RasterResult = {
    ...message,
    kind: "raster-result",
    pixels,
    cpuMs: performance.now() - begin,
    samples: width * height,
  };
  self.postMessage(result, { transfer: [pixels.buffer] });
};
