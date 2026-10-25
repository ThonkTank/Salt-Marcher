import {
  atlasMetricMeshRayIndexBuildCount,
  intersectAtlasMetricMeshSegment,
} from './atlas-mesh-ray';
import type { AtlasDeckSceneObject } from './atlas-deck-scene-model';

export interface AtlasDeckRayHit {
  /** Canonical Atlas metres; Y increases down and height is physical. */
  readonly point: { x: number; y: number; heightM: number };
  readonly segmentFraction: number;
}
export type AtlasDeckRaySegment = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
];

/** Refines the already-selected Deck mesh against the camera's near/far ray,
 * which is expressed in canonical physical world metres. */
export function refineAtlasDeckRayHit(query: {
  object: AtlasDeckSceneObject;
  segment: AtlasDeckRaySegment;
}): AtlasDeckRayHit | null {
  const { object, segment } = query;
  if (!object) throw new Error('Invalid Atlas Deck ray query');
  const origin = object.origin;
  if (![origin.x, origin.y, origin.heightM].every(Number.isFinite))
    throw new Error('Atlas Deck mesh has an invalid local origin');
  const local = segment.map(
    (point) => [point[0] - origin.x, point[1] - origin.y, point[2] - origin.heightM] as const,
  ) as unknown as AtlasDeckRaySegment;
  const hit = intersectAtlasMetricMeshSegment({ object, segment: local, toleranceMeters: 1e-8 });
  if (!hit) return null;
  const point = {
    x: origin.x + hit.point[0],
    y: origin.y + hit.point[1],
    heightM: origin.heightM + hit.point[2],
  };
  return Object.values(point).every(Number.isFinite)
    ? { point, segmentFraction: hit.segmentFraction }
    : null;
}

/** Camera changes reuse the same local mesh index; only buffer identity rebuilds it. */
export function atlasDeckRayIndexBuildCount(object: AtlasDeckSceneObject): number {
  return atlasMetricMeshRayIndexBuildCount(object);
}
