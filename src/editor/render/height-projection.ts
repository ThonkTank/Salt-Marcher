import { prepareHeightGridSteps } from "../model/height-grid";
import type { Bounds, HeightTile } from "../model/types";
import { rasterize } from "./raster";

export interface HeightProjectionInput {
  readonly sources: readonly HeightTile[];
  readonly overview?: Float64Array;
  readonly bounds: Bounds;
  readonly size: number;
  /** Optional absolute high/low pairs for the shared derived-surface colour pass. */
  readonly includeHeights?: boolean;
}

export interface HeightProjectionResult {
  pixels: Uint8Array;
  land: Uint8Array;
  heights?: Float32Array;
  samples: number;
  maxChunkMs: number;
}

interface ProjectionIdentity {
  id: number;
  sessionId: string;
}

export type HeightProjectionRequest = ProjectionIdentity &
  (
    | {
        kind: "begin";
        bounds: Bounds;
        size: number;
        sourceCount: number;
        hasOverview: boolean;
        includeHeights?: boolean;
      }
    | { kind: "source"; source: HeightTile }
    | { kind: "overview"; offset: number; values: Float64Array }
    | { kind: "project" }
    | { kind: "cancel" }
  );

export type HeightProjectionResponse = ProjectionIdentity &
  (
    | { kind: "ready" }
    | ({ kind: "finished" } & HeightProjectionResult)
    | { kind: "cancelled" }
    | { kind: "failed"; error: string }
  );

export interface ProjectionExecution {
  cancelled(): boolean;
  /** Returning to the worker event loop admits cancellation between chunks. */
  yield(): Promise<void>;
  now(): number;
}

/**
 * Float64 exception projection. Source validation is one 64² tile at a time;
 * the raster is one 128-pixel row at a time. The UI never runs this function.
 * Sync model callers and this worker use exactly the same canonical arithmetic.
 */
export async function projectHeightPixels(
  input: HeightProjectionInput,
  execution: ProjectionExecution,
): Promise<HeightProjectionResult | null> {
  const { sources, overview, bounds, size } = input;
  if (
    !Number.isInteger(size) ||
    size < 1 ||
    size > 128 ||
    bounds.length !== 4 ||
    !bounds.every(Number.isFinite) ||
    bounds[0] >= bounds[2] ||
    bounds[1] >= bounds[3] ||
    (overview && overview.length !== size * size)
  )
    throw new RangeError("Ungültiger lokaler Höhenprojektionsauftrag.");
  let maxChunkMs = 0;
  let chunkStarted = execution.now();
  const yieldIfNeeded = async (force = false): Promise<boolean> => {
    const elapsed = execution.now() - chunkStarted;
    if (force || elapsed >= 2) {
      maxChunkMs = Math.max(maxChunkMs, elapsed);
      await execution.yield();
      chunkStarted = execution.now();
    }
    return execution.cancelled();
  };
  if (overview)
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++)
        if (!Number.isFinite(overview[row * size + column]))
          throw new RangeError("Ungültige numerische Höhenübersicht.");
      if (await yieldIfNeeded()) return null;
    }
  const setup = prepareHeightGridSteps(sources);
  let next = setup.next();
  while (!next.done) {
    if (await yieldIfNeeded()) return null;
    next = setup.next();
  }
  if (execution.cancelled()) return null;
  const grid = next.value;
  const pixels = new Uint8Array(size * size * 4);
  const land = new Uint8Array(size * size);
  const heightPairs = input.includeHeights
    ? new Float32Array(size * size * 2)
    : undefined;
  for (let row = 0; row < size; row++) {
    if (execution.cancelled()) return null;
    const rect: [number, number, number, number] = [0, row, size, row + 1];
    const heights = grid(bounds, size, rect);
    pixels.set(
      rasterize(
        heights,
        bounds,
        size,
        rect,
        overview,
        land.subarray(row * size, (row + 1) * size),
        heightPairs?.subarray(row * size * 2, (row + 1) * size * 2),
      ),
      row * size * 4,
    );
    if (await yieldIfNeeded()) return null;
  }
  maxChunkMs = Math.max(maxChunkMs, execution.now() - chunkStarted);
  return {
    pixels,
    land,
    ...(heightPairs ? { heights: heightPairs } : {}),
    samples: size * size,
    maxChunkMs,
  };
}
