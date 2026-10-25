import type { VolumeCell } from './volume-contracts';
export const MAX_STROKE_CELLS = 2000;
export interface VolumeBrush {
  tool: 'brush' | 'rectangle' | 'ellipse';
  shape: 'circle' | 'square';
  radius: number;
}
export const voxelKey = (p: VolumeCell) => `${p.x},${p.y},${p.z}`;
function valid(p: VolumeCell) {
  if (![p.x, p.y, p.z].every((n) => Number.isSafeInteger(n) && Math.abs(n) <= 1000000))
    throw new Error(
      'Rasterkoordinaten in ganzen Schritten zwischen −1000000 und 1000000 eingeben.',
    );
}
function limit(size: number) {
  if (size > MAX_STROKE_CELLS)
    throw new Error(
      'Ein Zug umfasst höchstens 2000 Zellen. Bereich oder Radius verkleinern. Der Zug wurde nicht gespeichert.',
    );
}
/** Bounded, gapless grid stamps; from/to may lie on different slices. */
export function brushStroke(from: VolumeCell, to: VolumeCell, brush: VolumeBrush): VolumeCell[] {
  valid(from);
  valid(to);
  if (
    !Number.isSafeInteger(brush.radius) ||
    brush.radius < 0 ||
    brush.radius > 10 ||
    !['circle', 'square'].includes(brush.shape)
  )
    throw new Error('Pinselradius von 0–10 Rasterzellen wählen.');
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), Math.abs(to.z - from.z));
  limit(steps + 1);
  const result = new Map<string, VolumeCell>();
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0,
      center = {
        x: Math.round(from.x + (to.x - from.x) * t),
        y: Math.round(from.y + (to.y - from.y) * t),
        z: Math.round(from.z + (to.z - from.z) * t),
      };
    for (let y = -brush.radius; y <= brush.radius; y++)
      for (let x = -brush.radius; x <= brush.radius; x++) {
        if (brush.shape === 'circle' && x * x + y * y > brush.radius * brush.radius) continue;
        const p = { x: center.x + x, y: center.y + y, z: center.z };
        valid(p);
        result.set(voxelKey(p), p);
        limit(result.size);
      }
  }
  return [...result.values()];
}
/** Inclusive 3D range. Filled XY ellipse or rectangle, repeated on each selected slice. */
export function volumeArea(
  from: VolumeCell,
  to: VolumeCell,
  shape: 'rectangle' | 'ellipse',
): VolumeCell[] {
  valid(from);
  valid(to);
  if (!['rectangle', 'ellipse'].includes(shape)) throw new Error('Rechteck oder Ellipse wählen.');
  const min = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), z: Math.min(from.z, to.z) },
    max = { x: Math.max(from.x, to.x), y: Math.max(from.y, to.y), z: Math.max(from.z, to.z) };
  const width = max.x - min.x + 1,
    depth = max.y - min.y + 1,
    height = max.z - min.z + 1;
  // A rejected huge range must never iterate over an unbounded bounding box.
  if (width * depth * height > MAX_STROKE_CELLS * (shape === 'ellipse' ? 2 : 1))
    limit(MAX_STROKE_CELLS + 1);
  const result: VolumeCell[] = [],
    cx = (min.x + max.x) / 2,
    cy = (min.y + max.y) / 2;
  for (let z = min.z; z <= max.z; z++)
    for (let y = min.y; y <= max.y; y++)
      for (let x = min.x; x <= max.x; x++) {
        if (
          shape === 'ellipse' &&
          ((x - cx) / (width / 2)) ** 2 + ((y - cy) / (depth / 2)) ** 2 > 1
        )
          continue;
        result.push({ x, y, z });
        limit(result.length);
      }
  return result;
}
export function extendStroke(before: Map<string, VolumeCell>, addition: VolumeCell[]) {
  const next = new Map(before);
  for (const cell of addition) next.set(voxelKey(cell), cell);
  limit(next.size);
  return next;
}
