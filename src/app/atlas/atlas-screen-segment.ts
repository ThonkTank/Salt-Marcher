import { atlasScreenOverlap, type ScreenPoint, type ScreenTriangle } from './atlas-screen-triangle';
export interface ScreenSection {
  start: number;
  end: number;
  owner: ScreenTriangle | null;
}
/** All projected coverage boundaries and all active depth-order crossings own
 * the partition. Interior rays are an independent oracle, never the owner. */
export function atlasScreenSegment(
  triangles: Iterable<ScreenTriangle>,
  p: ScreenPoint,
  q: ScreenPoint,
) {
  const at = (t: number) => ({ u: p.u + (q.u - p.u) * t, v: p.v + (q.v - p.v) * t }),
    candidates: { triangle: ScreenTriangle; interval: readonly [number, number] }[] = [];
  for (const triangle of triangles) {
    const interval = atlasScreenOverlap(triangle.polygon, p, q);
    if (interval && interval[1] > interval[0]) candidates.push({ triangle, interval });
  }
  const boundaries = [...new Set([0, 1, ...candidates.flatMap((c) => c.interval)])].sort(
      (a, b) => a - b,
    ),
    sections: ScreenSection[] = [];
  const entering = [...candidates].sort((a, b) => a.interval[0] - b.interval[0]),
    leaving = [...candidates].sort((a, b) => a.interval[1] - b.interval[1]),
    activeSet = new Set<ScreenTriangle>();
  let work = 0,
    entered = 0,
    left = 0;
  for (let i = 1; i < boundaries.length; i++) {
    const lo = boundaries[i - 1]!,
      hi = boundaries[i]!,
      cuts = [lo, hi];
    while (entered < entering.length && entering[entered]!.interval[0] <= lo)
      activeSet.add(entering[entered++]!.triangle);
    while (left < leaving.length && leaving[left]!.interval[1] <= lo)
      activeSet.delete(leaving[left++]!.triangle);
    const active = [...activeSet];
    if (active.length > 4096)
      throw Error('Zu viele überlagerte Geländeabschnitte. Kleineren Zug wählen.');
    for (let j = 0; j < active.length; j++)
      for (let k = j + 1; k < active.length; k++) {
        if (++work > 1000000) throw Error('Geländeabschnitt zu komplex. Kleineren Zug wählen.');
        const a = active[j]!,
          b = active[k]!,
          f = a.order(at(lo)) - b.order(at(lo)),
          g = a.order(at(hi)) - b.order(at(hi));
        if ((f < 0 && g > 0) || (f > 0 && g < 0)) {
          const t = lo + ((hi - lo) * f) / (f - g);
          if (t > lo && t < hi) cuts.push(t);
        }
      }
    cuts.sort((a, b) => a - b);
    for (let j = 1; j < cuts.length; j++) {
      const start = cuts[j - 1]!,
        end = cuts[j]!;
      if (end <= start) continue;
      const middle = start + (end - start) / 2,
        screen = at(middle === start ? end : middle);
      let owner: ScreenTriangle | null = null,
        value = -Infinity;
      for (const triangle of active) {
        const depth = triangle.order(screen);
        if (depth > value || (depth === value && (!owner || triangle.id < owner.id))) {
          value = depth;
          owner = triangle;
        }
      }
      sections.push({ start, end, owner });
    }
  }
  return sections;
}
