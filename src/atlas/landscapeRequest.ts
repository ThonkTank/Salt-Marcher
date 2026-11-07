import { landscapeDetails, landscapeSymbolMargin } from "./landscapeLod";
import { tileRequest } from "./lod";
import type { Bounds } from "./model";

/** Covers crowns intersecting the viewport whose centers are just outside it. */
export function landscapeMargin(scale?: number, bounds?: Bounds): number {
  return scale === undefined
    ? 0
    : landscapeDetails(scale, bounds).reduce(
        (margin, detail) =>
          Math.max(margin, landscapeSymbolMargin(detail.near)),
        0,
      );
}
export function landscapeRequest(
  bounds: Bounds,
  level: number,
  scale?: number,
) {
  const margin = landscapeMargin(scale, bounds);
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
