import { gridHeight, type TerrainGrid } from './terrain-spatial-model';
import { terrainGridLayout, terrainGridCoordinate } from './terrain-grid-layout';
import type { AtlasDeckRaySegment, AtlasDeckRayHit } from './atlas-deck-ray';

/** Exact intersection with the displayed triangle lattice. A height edit needs
 * no rebuilt triangle BVH: cross grid lines and each cell's one diagonal. */
export function atlasTerrainRay(
  grid: TerrainGrid,
  segment: AtlasDeckRaySegment,
): AtlasDeckRayHit | null {
  const a = segment[0],
    d = segment[1].map((v, i) => v - a[i]!),
    layout = terrainGridLayout(grid.view),
    b = grid.view.box;
  let enter = 0,
    exit = 1;
  for (const [axis, min, max] of [
    [0, b.x, b.x + b.width],
    [1, b.y, b.y + b.height],
  ]) {
    if (d[axis!] === 0) {
      if (a[axis!]! < min! || a[axis!]! > max!) return null;
      continue;
    }
    const t = (min! - a[axis!]!) / d[axis!]!,
      u = (max! - a[axis!]!) / d[axis!]!;
    enter = Math.max(enter, Math.min(t, u));
    exit = Math.min(exit, Math.max(t, u));
    if (exit < enter) return null;
  }
  const at = (t: number) => ({ x: a[0] + d[0]! * t, y: a[1] + d[1]! * t });
  const distance = (t: number) => a[2] + d[2]! * t - gridHeight(grid, at(t));
  const crossings = [enter, exit];
  for (const [axis, values] of [
    [0, layout.x.values],
    [1, layout.y.values],
  ] as const)
    if (d[axis])
      for (const value of values) {
        const t = (value - a[axis]) / d[axis]!;
        if (t > enter && t < exit) crossings.push(t);
      }
  crossings.sort((x, y) => x - y);
  const intersect = (start: number, end: number): AtlasDeckRayHit | null => {
    const f = distance(start),
      g = distance(end);
    if (Math.abs(f) < 1e-8)
      return {
        point: { ...at(start), heightM: gridHeight(grid, at(start)) },
        segmentFraction: start,
      };
    if (f * g > 0 || f === g) return null;
    const t = start + ((end - start) * f) / (f - g);
    if (t < start || t > end) return null;
    return { point: { ...at(t), heightM: gridHeight(grid, at(t)) }, segmentFraction: t };
  };
  for (let i = 1; i < crossings.length; i++) {
    const start = crossings[i - 1]!,
      end = crossings[i]!;
    if (end <= start) continue;
    const middle = at((start + end) / 2),
      x = Math.min(grid.view.columns - 2, Math.floor(terrainGridCoordinate(layout.x, middle.x))),
      y = Math.min(grid.view.rows - 2, Math.floor(terrainGridCoordinate(layout.y, middle.y)));
    const sx = layout.x.values[x + 1]! - layout.x.values[x]!,
      sy = layout.y.values[y + 1]! - layout.y.values[y]!;
    const slope = d[0]! / sx + d[1]! / sy;
    const diagonal = slope
      ? (1 - (a[0] - layout.x.values[x]!) / sx - (a[1] - layout.y.values[y]!) / sy) / slope
      : Infinity;
    const hit =
      diagonal > start && diagonal < end
        ? (intersect(start, diagonal) ?? intersect(diagonal, end))
        : intersect(start, end);
    if (hit) return hit;
  }
  return null;
}
