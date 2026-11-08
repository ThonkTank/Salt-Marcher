import { prepareHeightSampler, type Bounds, type HeightTile } from "../model";

let token = 0;
self.onmessage = async (
  event: MessageEvent<{
    sessionId: string;
    tiles: HeightTile[];
    bounds: Bounds;
    milliseconds: number;
    cancel?: boolean;
  }>,
) => {
  const run = ++token;
  if (event.data.cancel) return;
  const { sessionId, tiles, bounds, milliseconds } = event.data;
  const sample = prepareHeightSampler(tiles, bounds);
  const begin = performance.now();
  let checksum = 0,
    samples = 0,
    maxChunkMs = 0;
  self.postMessage({ kind: "started", sessionId });
  // P0's bounded CPU load is real canonical surface work, not a sleeping worker.
  while (run === token && performance.now() - begin < milliseconds) {
    const chunk = performance.now();
    do {
      for (let n = 0; n < 128; n++) {
        const x =
          bounds[0] +
          (((samples * 17) % 65536) / 65536) * (bounds[2] - bounds[0]);
        const y =
          bounds[1] +
          (((samples * 31) % 65536) / 65536) * (bounds[3] - bounds[1]);
        checksum += sample(x, y);
        samples++;
      }
    } while (performance.now() - chunk < 4);
    maxChunkMs = Math.max(maxChunkMs, performance.now() - chunk);
    self.postMessage({
      kind: "progress",
      sessionId,
      samples,
      checksum,
      maxChunkMs,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  self.postMessage({
    kind: "finished",
    sessionId,
    samples,
    checksum,
    maxChunkMs,
    cancelled: run !== token,
  });
};
