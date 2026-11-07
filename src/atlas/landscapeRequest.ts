import { tileRequest } from "./lod";
import type { Bounds } from "./model";

/** Covers crowns intersecting the viewport whose centers are just outside it. */
export function landscapeMargin(scale?: number): number {
  return scale === undefined || scale < 0.03 ? 0 : scale < 0.35 ? 188 : 18;
}
export function landscapeRequest(
  bounds: Bounds,
  level: number,
  scale?: number,
) {
  const margin = landscapeMargin(scale);
  return tileRequest(
    [
      bounds[0] - margin,
      bounds[1] - margin,
      bounds[2] + margin,
      bounds[3] + margin,
    ],
    level,
    64,
    24,
  );
}
