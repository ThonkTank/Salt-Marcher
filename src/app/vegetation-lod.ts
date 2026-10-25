import type { VegetationInstance, VegetationSpec } from './vegetation';
import { forestSurfaceWeight } from './atlas-cartographic-style';

export function vegetationRandom(seed: number, x: number, y: number, salt = 0) {
  let h =
    (seed ^
      Math.imul(x | 0, 374761393) ^
      Math.imul(y | 0, 668265263) ^
      Math.imul(salt, 2246822519)) >>>
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** A parent always chooses one of its four children's representatives. The
 * canonical fine-cell candidate is independent of camera, density and tiling. */
export function vegetationRepresentative(seed: number, x: number, y: number, stride: number) {
  while (stride > 1) {
    const half = stride / 2,
      quadrant = Math.floor(vegetationRandom(seed, x, y, 91 + Math.log2(stride)) * 4);
    x += (quadrant % 2) * half;
    y += Math.floor(quadrant / 2) * half;
    stride = half;
  }
  return { x, y };
}
export function vegetationStride(spacing: number, mpp: number) {
  return mpp <= 2 ? 1 : 2 ** Math.max(0, Math.ceil(Math.log2(Math.max(1, (mpp * 7) / spacing))));
}
/** Bound work before sampling terrain. A buffered viewport can cross the local
 * detail threshold with far more cells than fit in one read. Choose a parent
 * level of the same world-addressed hierarchy instead of rejecting the layer. */
export function vegetationGrid(
  spacing: number,
  mpp: number,
  box: { x: number; y: number; right: number; bottom: number },
) {
  let stride = vegetationStride(spacing, mpp);
  const x1 = Math.ceil(box.right / spacing),
    y1 = Math.ceil(box.bottom / spacing);
  const grid = () => ({
    stride,
    x0: Math.floor(box.x / spacing / stride) * stride,
    y0: Math.floor(box.y / spacing / stride) * stride,
    x1,
    y1,
  });
  if (box.right < box.x || box.bottom < box.y) return { stride, x0: 1, y0: 1, x1: 0, y1: 0 };
  for (;;) {
    const g = grid(),
      columns = Math.floor((x1 - g.x0) / stride) + 1,
      rows = Math.floor((y1 - g.y0) / stride) + 1;
    if (columns * rows <= 24000) return g;
    stride *= 2;
  }
}
/** Last scale at which this automatic candidate belongs to the hierarchy.
 * No per-instance display fields are stored or sent through the bridge. */
export function vegetationScaleLimit(i: VegetationInstance, spec?: VegetationSpec) {
  if (i.protected || !spec) return 0; // zero means an explicitly retained object
  if (
    i.asset === 'grass' ||
    i.asset === 'shrub' ||
    (i.asset === 'rock' && (spec.preset.density > 0 || spec.preset.rocks <= 0.2))
  )
    return 2;
  const parts = i.id.split(':'),
    x = Number(parts[1]),
    y = Number(parts[2]);
  if (!Number.isFinite(x) || (parts[0] !== 'row' && !Number.isFinite(y))) return 0;
  const maximum = vegetationStride(spec.spacing, 8);
  let stride = 1;
  for (let next = 2; next <= maximum; next *= 2) {
    if (parts[0] === 'row') {
      if (x % next) break;
    } else {
      const p = vegetationRepresentative(
        spec.seed,
        Math.floor(x / next) * next,
        Math.floor(y / next) * next,
        next,
      );
      if (p.x !== x || p.y !== y) break;
    }
    stride = next;
  }
  return Math.min(8, Math.max(2, (spec.spacing * stride) / 7));
}
export function vegetationOpacity(mpp: number, limit: number) {
  if (!limit) return 1;
  const t = Math.max(0, Math.min(1, (mpp - limit * 0.75) / (limit * 0.25)));
  return (1 - t * t * (3 - 2 * t)) * (1 - forestSurfaceWeight(mpp));
}
/** Horizontal crown scale only; height and protected dimensions stay physical. */
export function vegetationCrownScale(size: number, mpp: number, overviewWidth: number) {
  return (
    1 + (Math.min(2, Math.max(1, (mpp * overviewWidth) / size)) - 1) * forestSurfaceWeight(mpp)
  );
}
