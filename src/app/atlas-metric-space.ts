import type { Point } from './contracts';
import type { LandscapeBox } from './atlas-landscape';

/** A disposable rendering domain, never a boundary of the authored world.
 * Atlas x/y are metres, with y increasing down the map. */
export interface AtlasMetricRoot { x: number; y: number; size: number }
export interface AtlasMetricPose {
  focus: Point;
  /** Physical altitude of the focus plane; defaults to sea level. */
  focusHeightM?: number;
  metersPerPixel: number;
  rotation: number;
  tilt: number;
}
export interface AtlasMetricTile { z: number; x: number; y: number }

// MapLibre's public LngLat still validates latitude even with a custom CRS.
// These are transport coordinates, not geographical degrees or Mercator.
export const ATLAS_METRIC_COORDINATE_SPAN = 128;
const TILE_PIXELS = 512;
const finite = (...values: number[]) => values.every(Number.isFinite);

function assertBox(box: LandscapeBox): void {
  if (!finite(box.x, box.y, box.width, box.height, box.x + box.width, box.y + box.height)
    || box.width < 0 || box.height < 0) throw new Error('Invalid metric bounds');
}
function assertRoot(root: AtlasMetricRoot): void {
  if (!finite(root.x, root.y, root.size, root.x + root.size, root.y + root.size)
    || root.size / ATLAS_METRIC_COORDINATE_SPAN <= 0 || !Number.isInteger(Math.log2(root.size))
    || root.x + root.size <= root.x || root.y + root.size <= root.y)
    throw new Error('Invalid metric rendering root');
}

/** Start with a world-sized root. Subsequent growth preserves old tile edges. */
export function createMetricRoot(bounds: LandscapeBox, minimumSize = 2 ** 26): AtlasMetricRoot {
  assertBox(bounds);
  if (!Number.isFinite(minimumSize) || minimumSize <= 0) throw new Error('Invalid minimum root size');
  const size = 2 ** Math.ceil(Math.log2(Math.max(minimumSize, bounds.width, bounds.height)));
  const x = Math.floor((bounds.x + bounds.width / 2) / size) * size - size / 2;
  const y = Math.floor((bounds.y + bounds.height / 2) / size) * size - size / 2;
  return expandMetricRoot({x, y, size}, bounds);
}

export function metricRootContains(root: AtlasMetricRoot, bounds: LandscapeBox): boolean {
  assertRoot(root); assertBox(bounds);
  return bounds.x >= root.x && bounds.y >= root.y
    && bounds.x + bounds.width <= root.x + root.size
    && bounds.y + bounds.height <= root.y + root.size;
}

/** Pure expansion: callers can prepare replacement sources before swapping maps.
 * A numerical overflow fails explicitly; canonical data is neither clipped nor moved. */
export function expandMetricRoot(root: AtlasMetricRoot, bounds: LandscapeBox): AtlasMetricRoot {
  assertRoot(root); assertBox(bounds);
  let next = root;
  while (!metricRootContains(next, bounds)) {
    const size = next.size * 2;
    const x = bounds.x < next.x ? next.x - next.size : next.x;
    const y = bounds.y < next.y ? next.y - next.size : next.y;
    next = {x, y, size};
    assertRoot(next);
  }
  return next;
}

/** Encode world metres for the registered planar CRS; does not clamp at an edge.
 * The ±64 transport guarantee applies inside the root. Expand before using an
 * outside point with MapLibre, which still validates its LngLat latitude. */
export function metricLngLat(root: AtlasMetricRoot, point: Point): [number, number] {
  assertRoot(root);
  if (!finite(point.x, point.y)) throw new Error('Invalid metric point');
  const s = ATLAS_METRIC_COORDINATE_SPAN;
  const result: [number, number] = [(point.x - root.x) / root.size * s - s / 2, s / 2 - (point.y - root.y) / root.size * s];
  if (!finite(...result)) throw new Error('Metric point cannot be represented by this root');
  return result;
}

export function metricPoint(root: AtlasMetricRoot, coordinates: readonly [number, number]): Point {
  assertRoot(root);
  if (!finite(...coordinates)) throw new Error('Invalid planar coordinates');
  const s = ATLAS_METRIC_COORDINATE_SPAN;
  const point = {x: root.x + (coordinates[0] + s / 2) / s * root.size,
    y: root.y + (s / 2 - coordinates[1]) / s * root.size};
  if (!finite(point.x, point.y)) throw new Error('Planar coordinates cannot be represented in metres');
  return point;
}

/** Serializable parameters also used to register the same CRS inside workers. */
export function metricProjectionParameters(root: AtlasMetricRoot) {
  assertRoot(root);
  return {unitsPerCoordinate: root.size / ATLAS_METRIC_COORDINATE_SPAN,
    tileMatrixSet: {origin: [-root.size / 2, root.size / 2] as [number, number], extentAtZoom0: root.size}};
}

export function metricMapCamera(root: AtlasMetricRoot, pose: AtlasMetricPose, exaggeration = 1) {
  const elevation = (pose.focusHeightM ?? 0) * exaggeration;
  if (!finite(pose.metersPerPixel, pose.rotation, pose.tilt, elevation, exaggeration) || exaggeration <= 0 || pose.metersPerPixel <= 0
    || pose.tilt < 0 || pose.tilt > 75) throw new Error('Invalid metric camera pose');
  return {center: metricLngLat(root, pose.focus), zoom: Math.log2(root.size) - Math.log2(TILE_PIXELS) - Math.log2(pose.metersPerPixel),
    bearing: pose.rotation, pitch: pose.tilt, elevation};
}

export function metricCameraPose(root: AtlasMetricRoot, camera: {
  center: readonly [number, number]; zoom: number; bearing: number; pitch: number; elevation?: number;
}, exaggeration = 1): AtlasMetricPose {
  const focusHeightM = (camera.elevation ?? 0) / exaggeration;
  if (!finite(camera.zoom, camera.bearing, camera.pitch, focusHeightM, exaggeration) || exaggeration <= 0 || camera.pitch < 0 || camera.pitch > 75)
    throw new Error('Invalid planar camera');
  const metersPerPixel = 2 ** (Math.log2(root.size) - Math.log2(TILE_PIXELS) - camera.zoom);
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) throw new Error('Invalid planar camera scale');
  return {focus: metricPoint(root, camera.center), focusHeightM, metersPerPixel, rotation: camera.bearing, tilt: camera.pitch};
}

/** Translate an old tile to the expanded root without changing its metre extent.
 * Layer/source zoom limits are a separate adapter responsibility, never a clamp here. */
export function translateMetricTile(tile: AtlasMetricTile, from: AtlasMetricRoot, to: AtlasMetricRoot): AtlasMetricTile {
  assertRoot(from); assertRoot(to);
  if (!Number.isInteger(tile.z) || tile.z < 0 || tile.z > 52
    || !Number.isSafeInteger(tile.x) || !Number.isSafeInteger(tile.y)
    || tile.x < 0 || tile.y < 0 || tile.x >= 2 ** tile.z || tile.y >= 2 ** tile.z)
    throw new Error('Invalid metric tile address');
  const levels = Math.log2(to.size / from.size), z = tile.z + levels;
  const tileSize = from.size / 2 ** tile.z;
  const x = tile.x + (from.x - to.x) / tileSize;
  const y = tile.y + (from.y - to.y) / tileSize;
  if (!metricRootContains(to, {x: from.x, y: from.y, width: from.size, height: from.size})
    || !Number.isInteger(levels) || levels < 0 || z > 52
    || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)) throw new Error('Roots do not preserve metric tile edges');
  return {z, x, y};
}
