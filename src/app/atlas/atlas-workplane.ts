import type { Point } from '../shared/contracts';

/** One metre-based floor reference for drawing, author handles and pointer rays. */
export interface AtlasWorkplane {
  scopeId: string;
  elevationM: number;
  anchor: Point;
}

export function atlasWorkplaneHeight(
  plane: AtlasWorkplane,
  surface: { scopeBases?: ReadonlyMap<string, number>; height: (p: Point) => number },
) {
  return (
    (surface.scopeBases?.get(plane.scopeId) ?? surface.height(plane.anchor)) + plane.elevationM
  );
}

export function atlasWorkplaneData(plane: AtlasWorkplane | null): Record<string, string> {
  return plane
    ? {
        spatialScope: plane.scopeId,
        spatialFloor: String(plane.elevationM),
        spatialAnchorX: String(plane.anchor.x),
        spatialAnchorY: String(plane.anchor.y),
      }
    : {};
}
