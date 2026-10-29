import { terrainTraceMeasure } from './terrain-timing';
import { TerrainScreenGeometry, type ScreenTerrainGrid } from './terrain-screen-geometry';
import type { AtlasCameraPose } from './atlas-camera';
import type { ScreenPoint, ScreenTriangle, ScreenWorldPoint } from './atlas-screen-triangle';
import { atlasScreenSegment } from './atlas-screen-segment';

export interface TerrainScreenEvent extends ScreenPoint {
  t: number;
}
export interface TerrainScreenInput {
  version: 1;
  events: TerrainScreenEvent[];
}
export interface TerrainScreenSection {
  owner: string;
  startMs: number;
  endMs: number;
  seconds: number;
  point(fraction: number): ScreenWorldPoint;
}
export interface TerrainScreenPlan {
  sections: TerrainScreenSection[];
  dabs: { x: number; y: number; seconds: number }[];
  centrelines: { x: number; y: number }[][];
}
export function validateTerrainScreenInput(
  input: TerrainScreenInput,
  visibility?: AtlasCameraPose,
) {
  if (
    !input ||
    input.version !== 1 ||
    !visibility ||
    Object.keys(input).some((k) => !['version', 'events'].includes(k)) ||
    !Array.isArray(input.events) ||
    !input.events.length ||
    input.events.length > 20000 ||
    input.events[0]!.t !== 0
  )
    throw Error('Bildschirmzug prüfen.');
  let last = 0;
  for (const p of input.events) {
    if (
      !p ||
      Object.keys(p).some((k) => !['u', 'v', 't'].includes(k)) ||
      ![p.u, p.v, p.t].every(Number.isFinite) ||
      Math.max(Math.abs(p.u), Math.abs(p.v)) > 1e6 ||
      p.t < last ||
      p.t > 300000
    )
      throw Error('Bildschirmzug prüfen.');
    last = p.t;
  }
  if (JSON.stringify(input).length * 2 > 2 * 1024 * 1024)
    throw Error('Bildschirmzug überschreitet die Eingabegröße.');
}
/** Only numerically redundant observations of the same timed screen line are
 * removed (2^-42 of a viewport). This does not join geometrical sections. */
export function terrainScreenEvents(events: readonly TerrainScreenEvent[]) {
  const result: TerrainScreenEvent[] = [];
  for (const c of events) {
    while (result.length > 1) {
      const a = result.at(-2)!,
        b = result.at(-1)!,
        dt = c.t - a.t;
      if (!dt) break;
      const f = (b.t - a.t) / dt;
      if (
        Math.abs(b.u - (a.u + (c.u - a.u) * f)) > 2 ** -42 ||
        Math.abs(b.v - (a.v + (c.v - a.v) * f)) > 2 ** -42
      )
        break;
      result.pop();
    }
    result.push(c);
  }
  return result;
}
/** Each integration point is evaluated on its owning triangle. Radial midpoint
 * intervals span at most 1/60s and radius/32 in XY (using the exact maximum
 * projective speed). Exposure-only fields integrate each section exactly.
 * No time from sky or zero-duration boundaries is reused. */
export function planTerrainScreenInput(
  input: TerrainScreenInput,
  radius: number,
  grid: ScreenTerrainGrid,
  integration: 'radial' | 'exposure' = 'radial',
  geometry?: TerrainScreenGeometry,
): TerrainScreenPlan {
  validateTerrainScreenInput(input, grid.view);
  if (geometry && !geometry.matchesGrid(grid))
    throw Error('Bildschirmgeometrie inzwischen geändert. Erneut laden.');
  const events = terrainScreenEvents(input.events),
    triangles = (
      geometry ?? new TerrainScreenGeometry(grid, { token: '', revision: 0, fence: '' }, false)
    ).query(events),
    sections: TerrainScreenSection[] = [],
    dabs: TerrainScreenPlan['dabs'] = [],
    centrelines: TerrainScreenPlan['centrelines'] = [];
  let previousOwner: ScreenTriangle | undefined,
    previousScreen: ScreenPoint | undefined,
    previousTime = -1;
  for (let i = 1; i < events.length; i++) {
    const p = events[i - 1]!,
      q = events[i]!,
      duration = q.t - p.t;
    if (!duration) continue;
    const at = (t: number) => ({ u: p.u + (q.u - p.u) * t, v: p.v + (q.v - p.v) * t });
    for (const s of terrainTraceMeasure('screen.segment', () =>
      atlasScreenSegment(triangles, p, q),
    )) {
      if (!s.owner) {
        previousOwner = undefined;
        previousScreen = undefined;
        continue;
      }
      const owner = s.owner,
        startMs = p.t + duration * s.start,
        endMs = p.t + duration * s.end,
        point = (fraction: number) => owner.point(at(s.start + (s.end - s.start) * fraction)),
        a = point(0),
        b = point(1),
        seconds = (duration * (s.end - s.start)) / 1000,
        length = Math.hypot(b.x - a.x, b.y - a.y),
        ratio =
          grid.view.projection === 'perspective'
            ? Math.max(a.depth / b.depth, b.depth / a.depth)
            : 1,
        // Forms use only each section's exact exposure and its full spatial
        // centreline. Radial midpoint quadrature is needed for pointwise dose,
        // not for the sum of elapsed visible time.
        count =
          integration === 'exposure'
            ? 1
            : Math.max(1, Math.ceil(seconds * 60), Math.ceil((length * ratio) / (radius / 32)));
      if (
        ![a.x, a.y, a.z, b.x, b.y, b.z, a.depth, b.depth].every(Number.isFinite) ||
        a.depth <= 0 ||
        b.depth <= 0
      )
        throw Error('Geländeabschnitt nicht rekonstruierbar. Erneut laden.');
      if (count + dabs.length > 20000)
        throw Error('Höhenzug zu lang. In kürzeren Zügen bearbeiten.');
      sections.push({ owner: owner.id, startMs, endMs, seconds, point });
      const startScreen = at(s.start);
      // Separate owners retain separate centrelines, even in the same tile.
      // No world-distance tolerance can certify a connection across silhouettes.
      if (
        previousOwner !== owner ||
        previousTime !== startMs ||
        previousScreen?.u !== startScreen.u ||
        previousScreen?.v !== startScreen.v
      )
        centrelines.push([{ x: a.x, y: a.y }]);
      const line = centrelines.at(-1)!;
      for (let j = 0; j < count; j++) {
        const pt = point((j + 0.5) / count),
          last = dabs.at(-1);
        if (last && last.x === pt.x && last.y === pt.y) last.seconds += seconds / count;
        else dabs.push({ x: pt.x, y: pt.y, seconds: seconds / count });
      }
      // Projective time changes speed, not the straight world line inside
      // one triangle. Geometry keeps endpoints; hold quadrature never adds
      // thousands of redundant polygon vertices or consumes its point budget.
      if (line.at(-1)!.x !== b.x || line.at(-1)!.y !== b.y) line.push({ x: b.x, y: b.y });
      previousOwner = owner;
      previousScreen = at(s.end);
      previousTime = endMs;
    }
  }
  return { sections, dabs, centrelines };
}
