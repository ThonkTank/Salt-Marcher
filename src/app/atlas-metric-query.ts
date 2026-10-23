/** MapLibre 6.15's planar transform measures query padding at the viewport's
 * top-left corner. Above the horizon that ray intersects the ground behind the
 * camera, returning a negative scale and shrinking the candidate tile bounds.
 *
 * Keep ordinary views unchanged. When the corner is behind the camera, the far
 * clipping plane bounds the positive perspective distance of rendered geometry.
 * This repairs candidate padding only; the original point and exact feature
 * intersection still decide the hit. It must not turn into a wider point query.
 */
export function safeMetricQueryScale(rawScale: number, farZ: number, cameraDistance: number): number {
  if (!Number.isFinite(farZ) || farZ <= 0 || !Number.isFinite(cameraDistance) || cameraDistance <= 0)
    throw new Error('Invalid metric query clipping range');
  const farScale = farZ / cameraDistance;
  if (!Number.isFinite(farScale)) throw new Error('Metric query clipping range overflow');
  return Number.isFinite(rawScale) && rawScale > 0
    ? Math.max(1, rawScale)
    : Math.max(1, farScale);
}

export const MAPLIBRE_METRIC_QUERY_VERSION = '6.15.0';

export interface MetricQueryTransform {
  maxPitchScaleFactor(): number;
  readonly farZ: number;
  readonly cameraToCenterDistance: number;
  readonly elevation: number;
  screenPointToMercatorCoordinate(point: unknown, terrain?: unknown): unknown;
  screenPointToMercatorCoordinateAtZ(point: unknown, z?: number): unknown;
}

/** Structural subset of a MapLibre map used by the guarded query adapter. */
export interface MetricQueryMap<Geometry, Options, Result> {
  /** MapLibre's active terrain object, or null/undefined when no terrain is set. */
  readonly terrain?: unknown | null;
  queryRenderedFeatures(geometry: Geometry, options: Options): Result;
}

export interface MetricQueryResult<Result> {
  /** The exact result returned by MapLibre's original query implementation. */
  features: Result;
  rawScale: number;
  adaptedScale: number;
  farZ: number;
  cameraDistance: number;
  /** Offset from center elevation to the ground plane used by the no-terrain broadphase. */
  groundPlaneOffset: number | null;
  projectionRestored: boolean;
  /** True when the transform's original own-property state was restored. */
  restored: boolean;
}

function descriptorsEqual(left: PropertyDescriptor | undefined, right: PropertyDescriptor | undefined): boolean {
  if (!left || !right) return left === right;
  return left.configurable === right.configurable && left.enumerable === right.enumerable &&
    left.writable === right.writable && left.value === right.value && left.get === right.get && left.set === right.set;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as {then?: unknown}).then === 'function';
}

/**
 * Runs an exact MapLibre point/geometry query while repairing the negative
 * candidate-padding scale returned by MapLibre 6.15 at steep planar pitches.
 * For flat sources without MapLibre terrain, also intersect the screen ray at
 * absolute ground height: MapLibre otherwise uses the camera's focus elevation
 * even though these sources render at z=0. This does not provide 3D occlusion
 * selection for Deck objects. Geometry and options pass through unchanged;
 * both methods restore synchronously on success, errors and nested queries.
 */
export function queryRenderedFeaturesMetricSafe<Geometry, Options, Result>(
  map: MetricQueryMap<Geometry, Options, Result>,
  geometry: Geometry,
  options: Options,
  actualMapLibreVersion: string
): MetricQueryResult<Result> {
  if (actualMapLibreVersion !== MAPLIBRE_METRIC_QUERY_VERSION)
    throw new Error(`Unsupported MapLibre metric query adapter version: ${actualMapLibreVersion}`);

  const transform = (map as MetricQueryMap<Geometry, Options, Result> & {
    readonly _camera?: {readonly transform?: MetricQueryTransform};
  })?._camera?.transform;
  const originalMethod = transform?.maxPitchScaleFactor;
  if (!transform || typeof originalMethod !== 'function' || typeof map.queryRenderedFeatures !== 'function')
    throw new Error('MapLibre metric query adapter private transform contract is unavailable');

  const originalDescriptor = Object.getOwnPropertyDescriptor(transform, 'maxPitchScaleFactor');
  assertCanOverride(transform, 'maxPitchScaleFactor', originalDescriptor);

  const rawScale = originalMethod.call(transform);
  const farZ = transform.farZ;
  const cameraDistance = transform.cameraToCenterDistance;
  const adaptedScale = safeMetricQueryScale(rawScale, farZ, cameraDistance);
  const temporaryMethod = function metricSafeMaxPitchScaleFactor(): number { return adaptedScale; };
  const temporaryDescriptor = makeTemporaryDescriptor(originalDescriptor, temporaryMethod);

  const noTerrain = map.terrain == null;
  const originalScreenMethod = transform.screenPointToMercatorCoordinate;
  const originalAtZMethod = transform.screenPointToMercatorCoordinateAtZ;
  const originalScreenDescriptor = Object.getOwnPropertyDescriptor(transform, 'screenPointToMercatorCoordinate');
  let groundPlaneOffset: number | null = null;
  let temporaryScreenDescriptor: PropertyDescriptor | null = null;
  if (noTerrain) {
    if (typeof originalScreenMethod !== 'function' || typeof originalAtZMethod !== 'function')
      throw new Error('MapLibre metric query adapter screen-projection contract is unavailable');
    if (!Number.isFinite(transform.elevation)) throw new Error('Invalid MapLibre transform elevation for ground-plane query');
    assertCanOverride(transform, 'screenPointToMercatorCoordinate', originalScreenDescriptor);
    const offset = -transform.elevation;
    groundPlaneOffset = offset;
    if (!Number.isFinite(offset)) throw new Error('Invalid MapLibre ground-plane query offset');
    const screenMethod = function metricGroundScreenPointToMercatorCoordinate(point: unknown, terrain?: unknown): unknown {
      // Preserve terrain intersections exactly if a caller explicitly supplies one.
      return terrain == null
        ? originalAtZMethod.call(transform, point, offset)
        : originalScreenMethod.call(transform, point, terrain);
    };
    temporaryScreenDescriptor = makeTemporaryDescriptor(originalScreenDescriptor, screenMethod);
  }

  let features: Result;
  let scaleInstalled = false;
  let screenInstalled = false;
  try {
    Object.defineProperty(transform, 'maxPitchScaleFactor', temporaryDescriptor);
    scaleInstalled = true;
    if (temporaryScreenDescriptor) {
      Object.defineProperty(transform, 'screenPointToMercatorCoordinate', temporaryScreenDescriptor);
      screenInstalled = true;
    }
    features = map.queryRenderedFeatures(geometry, options);
    if (isThenable(features)) throw new Error('MapLibre metric query adapter requires a synchronous query result');
  } finally {
    try {
      if (screenInstalled) restoreDescriptor(transform, 'screenPointToMercatorCoordinate', originalScreenDescriptor);
    } finally {
      if (scaleInstalled) restoreDescriptor(transform, 'maxPitchScaleFactor', originalDescriptor);
    }
  }

  const restored = descriptorsEqual(Object.getOwnPropertyDescriptor(transform, 'maxPitchScaleFactor'), originalDescriptor);
  const projectionRestored = !noTerrain || descriptorsEqual(Object.getOwnPropertyDescriptor(transform, 'screenPointToMercatorCoordinate'), originalScreenDescriptor);
  return {features: features!, rawScale, adaptedScale, farZ, cameraDistance, groundPlaneOffset, projectionRestored, restored: restored && projectionRestored};
}

function assertCanOverride<Target extends object, Key extends keyof Target>(
  target: Target, key: Key, descriptor: PropertyDescriptor | undefined
): void {
  if (!descriptor && !Object.isExtensible(target))
    throw new Error(`MapLibre ${String(key)} cannot be safely overridden on a non-extensible transform`);
  if (descriptor && !descriptor.configurable && (!('value' in descriptor) || !descriptor.writable))
    throw new Error(`MapLibre ${String(key)} is immutable and cannot be safely overridden`);
}

function makeTemporaryDescriptor(descriptor: PropertyDescriptor | undefined, value: unknown): PropertyDescriptor {
  return descriptor
    ? descriptor.configurable
      ? {configurable: true, enumerable: descriptor.enumerable, writable: true, value}
      : {...descriptor, value}
    : {configurable: true, enumerable: false, writable: true, value};
}

function restoreDescriptor<Target extends object, Key extends keyof Target>(
  target: Target, key: Key, descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else delete (target as Record<PropertyKey, unknown>)[key];
}
