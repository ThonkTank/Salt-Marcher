import type { Point } from '../contracts';
import type { LandscapeRecord } from './atlas-landscape';
import { TerrainSampler } from './terrain-height';
export function profileBounds(points: Point[], pad = 1) {
  if (
    !Array.isArray(points) ||
    points.length < 2 ||
    points.length > 8192 ||
    points.some(
      (p) =>
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        Math.max(Math.abs(p.x), Math.abs(p.y)) > 1e12,
    )
  )
    throw Error('Höhenprofil benötigt 2–8192 gültige Punkte.');
  const x = Math.min(...points.map((p) => p.x)) - pad,
    y = Math.min(...points.map((p) => p.y)) - pad;
  return {
    x,
    y,
    width: Math.max(...points.map((p) => p.x)) - x + pad,
    height: Math.max(...points.map((p) => p.y)) - y + pad,
  };
}
export function terrainProfile(records: LandscapeRecord[], points: Point[]) {
  profileBounds(points);
  const terrain = new TerrainSampler(records),
    lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y));
  const distanceM = lengths.reduce((a, b) => a + b, 0);
  if (distanceM <= 0) throw Error('Für das Profil zwei verschiedene Punkte wählen.');
  // Exact polyline distance; bounded uniform probes, plus authored bends on short paths.
  const spacing = distanceM / 256,
    samples: ({ distanceM: number; point: Point } & ReturnType<TerrainSampler['query']>)[] = [];
  const distances = new Set(Array.from({ length: 257 }, (_, i) => (distanceM * i) / 256));
  if (points.length <= 128) {
    let d = 0;
    for (const length of lengths) {
      d += length;
      distances.add(d);
    }
  }
  let segment = 0,
    start = 0;
  for (const d of [...distances].sort((a, b) => a - b)) {
    while (segment < lengths.length - 1 && start + lengths[segment]! < d) {
      start += lengths[segment]!;
      segment++;
    }
    const a = points[segment]!,
      b = points[segment + 1]!,
      t = lengths[segment] ? Math.min(1, (d - start) / lengths[segment]!) : 0;
    const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    samples.push({ point, distanceM: d, ...terrain.query(point) });
  }
  let ascentM = 0,
    descentM = 0;
  for (let i = 1; i < samples.length; i++) {
    const d = samples[i]!.heightM - samples[i - 1]!.heightM;
    ascentM += Math.max(0, d);
    descentM += Math.max(0, -d);
  }
  return { distanceM, ascentM, descentM, sampleSpacingM: spacing, samples };
}
export type TerrainProfile = ReturnType<typeof terrainProfile>;
