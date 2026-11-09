import {
  heightFromScaledSum,
  prepareScaledHeightSumSteps,
  type Bounds,
  type HeightTile,
} from "../model";

const running = new Map<number, { cancelled: boolean }>();
self.onmessage = async (
  event: MessageEvent<{
    id: number;
    sessionId: string;
    tiles: HeightTile[];
    bounds: Bounds;
    milliseconds: number;
    cancel?: boolean;
  }>,
) => {
  const { id, sessionId, tiles, bounds, milliseconds } = event.data;
  if (event.data.cancel) {
    const run = running.get(id);
    if (run) run.cancelled = true;
    return;
  }
  const run = { cancelled: false };
  running.set(id, run);
  const yieldWork = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));
  let checksum = 0,
    samples = 0,
    maxChunkMs = 0;
  try {
    const setup = prepareScaledHeightSumSteps(tiles, bounds);
    let chunk = performance.now();
    let next = setup.next();
    while (!next.done && !run.cancelled) {
      if (performance.now() - chunk >= 2) {
        maxChunkMs = Math.max(maxChunkMs, performance.now() - chunk);
        await yieldWork();
        chunk = performance.now();
      }
      next = setup.next();
    }
    if (!next.done) {
      running.delete(id);
      self.postMessage({ kind: "finished", id, sessionId, cancelled: true });
      return;
    }
    const sum = next.value;
    const begin = performance.now();
    self.postMessage({ kind: "started", id, sessionId });
    // Diagnostic surface work shares admission with the productive projection.
    while (!run.cancelled && performance.now() - begin < milliseconds) {
      chunk = performance.now();
      do {
        for (let n = 0; n < 128; n++) {
          const x =
            bounds[0] +
            (((samples * 17) % 65536) / 65536) * (bounds[2] - bounds[0]);
          const y =
            bounds[1] +
            (((samples * 31) % 65536) / 65536) * (bounds[3] - bounds[1]);
          checksum += heightFromScaledSum(sum(x, y));
          samples++;
        }
      } while (performance.now() - chunk < 2);
      maxChunkMs = Math.max(maxChunkMs, performance.now() - chunk);
      self.postMessage({
        kind: "progress",
        id,
        sessionId,
        samples,
        checksum,
        maxChunkMs,
      });
      await yieldWork();
    }
    running.delete(id);
    self.postMessage({
      kind: "finished",
      id,
      sessionId,
      samples,
      checksum,
      maxChunkMs,
      cancelled: run.cancelled,
    });
  } catch (error) {
    running.delete(id);
    self.postMessage({
      kind: "failed",
      id,
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
