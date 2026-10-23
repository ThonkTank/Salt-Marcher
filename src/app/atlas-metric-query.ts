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
}

/** Structural subset of a MapLibre map used by the guarded query adapter. */
export interface MetricQueryMap<Geometry, Options, Result> {
  queryRenderedFeatures(geometry: Geometry, options: Options): Result;
}

export interface MetricQueryResult<Result> {
  /** The exact result returned by MapLibre's original query implementation. */
  features: Result;
  rawScale: number;
  adaptedScale: number;
  farZ: number;
  cameraDistance: number;
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
 * Geometry and options pass through unchanged; the original scale method is
 * restored synchronously, including when the query throws or nests another
 * adapted query.
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
  if (!originalDescriptor && !Object.isExtensible(transform))
    throw new Error('MapLibre maxPitchScaleFactor cannot be safely overridden on a non-extensible transform');
  if (originalDescriptor && !originalDescriptor.configurable &&
    (!('value' in originalDescriptor) || !originalDescriptor.writable))
    throw new Error('MapLibre maxPitchScaleFactor is immutable and cannot be safely overridden');

  const rawScale = originalMethod.call(transform);
  const farZ = transform.farZ;
  const cameraDistance = transform.cameraToCenterDistance;
  const adaptedScale = safeMetricQueryScale(rawScale, farZ, cameraDistance);
  const temporaryMethod = function metricSafeMaxPitchScaleFactor(): number { return adaptedScale; };
  const temporaryDescriptor: PropertyDescriptor = originalDescriptor
    ? originalDescriptor.configurable
      ? {configurable: true, enumerable: originalDescriptor.enumerable, writable: true, value: temporaryMethod}
      : {...originalDescriptor, value: temporaryMethod}
    : {configurable: true, enumerable: false, writable: true, value: temporaryMethod};

  let features: Result;
  try {
    Object.defineProperty(transform, 'maxPitchScaleFactor', temporaryDescriptor);
    features = map.queryRenderedFeatures(geometry, options);
    if (isThenable(features)) throw new Error('MapLibre metric query adapter requires a synchronous query result');
  } finally {
    if (originalDescriptor) Object.defineProperty(transform, 'maxPitchScaleFactor', originalDescriptor);
    else delete (transform as unknown as Record<string, unknown>).maxPitchScaleFactor;
  }

  const restoredDescriptor = Object.getOwnPropertyDescriptor(transform, 'maxPitchScaleFactor');
  const restored = descriptorsEqual(restoredDescriptor, originalDescriptor);
  return {features: features!, rawScale, adaptedScale, farZ, cameraDistance, restored};
}
