import type { Point } from '../shared/contracts';
import type { LandscapeBox } from './atlas-landscape';
import { routeSegmentRange } from './route-segment-range';
export { routeSegmentRange };

/** Split at changes in terrain sampling density, preserving original segment
 * parameters. Directional spacing avoids oversampling a long horizontal route
 * merely because its y coordinate passes through the fine centre band. */
export function routeSampleSections(
  a: Point,
  b: Point,
  box: LandscapeBox | undefined,
  step: number,
  layout?: import('./terrain-grid-layout').TerrainRouteLayout,
) {
  const range = routeSegmentRange(a, b, box);
  if (!range) return [];
  if (!layout) return [{ range, step }];
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy),
    cuts = [...range];
  for (const [axis, start, delta] of [
    [layout.x, a.x, dx],
    [layout.y, a.y, dy],
  ] as const)
    if (delta)
      for (const band of axis.bands) {
        const t = (band.origin - start) / delta;
        if (t > range[0] && t < range[1]) cuts.push(t);
      }
  cuts.sort((a, b) => a - b);
  const result: { range: [number, number]; step: number }[] = [];
  for (let i = 1; i < cuts.length; i++) {
    const lo = cuts[i - 1]!,
      hi = cuts[i]!;
    if (hi - lo < 1e-14) continue;
    const t = (lo + hi) / 2;
    const spacing = (axis: typeof layout.x, value: number, delta: number) => {
      if (!delta) return Infinity;
      const band =
        axis.bands.find((b) => value < b.origin + b.cells * b.step) ?? axis.bands.at(-1)!;
      return (band.step * length) / Math.abs(delta) / 2;
    };
    result.push({
      range: [lo, hi],
      step: Math.max(
        step,
        Math.min(spacing(layout.x, a.x + dx * t, dx), spacing(layout.y, a.y + dy * t, dy)),
      ),
    });
  }
  return result;
}
