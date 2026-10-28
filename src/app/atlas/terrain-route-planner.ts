import type { Point } from '../shared/contracts';
import { type LandscapeRecord } from './landscape-contracts';
import { contains } from './landscape-geometry';
import { TerrainSampler, decodeHeights, heightRecord } from './terrain-height';
import { nearestRoute, routeRiverFade, validateRoute } from './terrain-route';
import { type RouteNode, type RouteStructure } from './terrain-route-contracts';
import { routeSegmentRange } from './route-segment-range';
import { heightInfluenceBounds } from './terrain-interpolation';

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (a: Point, b: Point, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
class Heap {
  a: { id: number; f: number }[] = [];
  push(v: { id: number; f: number }) {
    let i = this.a.length;
    this.a.push(v);
    while (i) {
      const p = (i - 1) >> 1;
      if (this.a[p]!.f <= v.f) break;
      this.a[i] = this.a[p]!;
      i = p;
    }
    this.a[i] = v;
  }
  pop() {
    const first = this.a[0]!,
      last = this.a.pop()!;
    if (this.a.length) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.a.length && this.a[c + 1]!.f < this.a[c]!.f) c++;
        if (this.a[c]!.f >= last.f) break;
        this.a[i] = this.a[c]!;
        i = c;
      }
      this.a[i] = last;
    }
    return first;
  }
}
/** Deterministic A* in an oriented bounded corridor. The old route is a strong
 * soft constraint during terrain edits; all exact constraints are checked later. */
function leg(
  a: Point,
  b: Point,
  r: LandscapeRecord,
  sampler: TerrainSampler,
  retain: boolean,
): Point[] {
  const s = r.route!,
    length = distance(a, b);
  if (length < 0.01) throw Error('Verlaufpunkte liegen übereinander.');
  const nx = Math.min(128, Math.max(8, Math.ceil(length / Math.max(2, r.width)))),
    ny = 32;
  const dx = (b.x - a.x) / length,
    dy = (b.y - a.y) / length;
  const point = (x: number, y: number) => ({
    x: a.x + (dx * length * x) / nx - (dy * (y - ny / 2) * s.limits.corridor) / (ny / 2),
    y: a.y + (dy * length * x) / nx + (dx * (y - ny / 2) * s.limits.corridor) / (ny / 2),
  });
  const n = (nx + 1) * (ny + 1),
    heights = new Float64Array(n),
    water = new Uint8Array(n),
    points: Point[] = [];
  for (let y = 0; y <= ny; y++)
    for (let x = 0; x <= nx; x++) {
      const p = point(x, y),
        i = y * (nx + 1) + x;
      points[i] = p;
      heights[i] = sampler.sample(p).heightM;
      water[i] = sampler.water(p, heights[i]) ? 1 : 0;
    }
  const start = (ny / 2) * (nx + 1),
    end = start + nx,
    g = new Float64Array(n).fill(Infinity),
    prev = new Int32Array(n).fill(-1),
    closed = new Uint8Array(n),
    heap = new Heap();
  g[start] = 0;
  heap.push({ id: start, f: length });
  while (heap.a.length) {
    const { id } = heap.pop();
    if (closed[id]) continue;
    if (id === end) break;
    closed[id] = 1;
    const x = id % (nx + 1),
      y = Math.floor(id / (nx + 1));
    for (const [ox, oy] of [
      [1, 0],
      [1, -1],
      [1, 1],
      [0, -1],
      [0, 1],
      [-1, 0],
    ]) {
      const xx = x + ox!,
        yy = y + oy!;
      if (xx < 0 || xx > nx || yy < 0 || yy > ny) continue;
      const j = yy * (nx + 1) + xx;
      if (closed[j]) continue;
      const ds = distance(points[id]!, points[j]!),
        dz = heights[j]! - heights[id]!;
      const slope = r.kind === 'river' ? Math.max(0, dz) / ds : Math.abs(dz) / ds;
      const deviation =
        retain && s.nodes.length
          ? nearestRoute(s.nodes, points[j]!)!.distance / s.limits.corridor
          : 0;
      const turn =
        prev[id]! >= 0
          ? 1 -
            ((points[id]!.x - points[prev[id]!]!.x) * (points[j]!.x - points[id]!.x) +
              (points[id]!.y - points[prev[id]!]!.y) * (points[j]!.y - points[id]!.y)) /
              (distance(points[id]!, points[prev[id]!]!) * ds)
          : 0;
      const cost =
        ds *
        (1 +
          8 * (slope / s.limits.grade) ** 2 +
          2 * turn +
          20 * deviation * deviation +
          (r.kind === 'road' && water[j] ? 8 : 0));
      if (g[id]! + cost < g[j]!) {
        g[j] = g[id]! + cost;
        prev[j] = id;
        heap.push({ id: j, f: g[j]! + distance(points[j]!, b) });
      }
    }
  }
  if (prev[end]! < 0) throw Error('Kein Verlauf im Planungskorridor.');
  const path: Point[] = [];
  for (let i = end; i >= 0; i = prev[i]!) path.push(points[i]!);
  path.reverse();
  // Corner cutting stays inside the corridor. Profiles are solved on this final geometry.
  let smooth = path;
  for (let pass = 0; pass < 2; pass++)
    smooth = smooth.map((p, i) =>
      !i || i === smooth.length - 1 ? p : mix(p, mix(smooth[i - 1]!, smooth[i + 1]!, 0.5), 0.5),
    );
  return smooth;
}
function resample(points: Point[], step: number): Point[] {
  const out = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!,
      n = Math.max(1, Math.ceil(distance(a, b) / step));
    for (let j = 1; j <= n; j++) out.push(mix(a, b, j / n));
  }
  if (out.length > 4096) throw Error('Verlauf zu lang. Weitere Abschnitte getrennt anlegen.');
  return out;
}
function solveProfile(
  points: Point[],
  r: LandscapeRecord,
  sampler: TerrainSampler,
  modes: RouteStructure[],
  mouth?: number,
) {
  const s = r.route!,
    l = s.limits,
    n = points.length,
    ground = points.map((p) => sampler.sample(p).heightM),
    lo: number[] = [],
    hi: number[] = [],
    want: number[] = [];
  const station = [0],
    runStart: number[] = [],
    runEnd: number[] = [];
  for (let i = 1; i < n; i++) station[i] = station[i - 1]! + distance(points[i - 1]!, points[i]!);
  for (let i = 0; i < n; i++)
    runStart[i] = i === 0 || modes[i] !== modes[i - 1] ? i : runStart[i - 1]!;
  for (let i = n - 1; i >= 0; i--)
    runEnd[i] = i === n - 1 || modes[i] !== modes[i + 1] ? i : runEnd[i + 1]!;
  for (let i = 0; i < n; i++) {
    const h = ground[i]!,
      mode = modes[i]!,
      p = points[i]!;
    const depth = r.kind === 'river' ? l.depth * routeRiverFade(r, station[i]!) : 0;
    lo[i] = h - l.cut + depth;
    hi[i] = h + l.fill + depth;
    want[i] = h;
    const portalDistance = Math.min(
        station[i]! - station[runStart[i]!]!,
        station[runEnd[i]!]! - station[i]!,
      ),
      cover = Math.min(l.clearance, portalDistance * l.grade * 0.8);
    if (mode === 'bridge') {
      lo[i] = Math.max(h, sampler.waterLevel(p) ?? h) + cover;
      hi[i] = lo[i]! + Math.max(100, l.fill);
      want[i] = lo[i]!;
    }
    if (mode === 'tunnel') {
      lo[i] = h - 10000;
      hi[i] = h - cover;
      want[i] = hi[i]!;
    }
    if (mode === 'ford') {
      const water = sampler.waterLevel(p);
      if (water !== undefined && water - h > 1)
        throw Error('Furt ist tiefer als 1 m. Brücke wählen.');
      lo[i] = hi[i] = h;
      want[i] = h;
    }
  }
  // Portals and bridge abutments meet the ground at the interval endpoints.
  for (const i of [0, n - 1])
    if (modes[i] === 'tunnel' || modes[i] === 'bridge') {
      lo[i] = ground[i]! - l.cut;
      hi[i] = ground[i]! + l.fill;
      want[i] = ground[i]!;
    }
  if (mouth !== undefined) {
    // A water-level connection is an additional constraint, never permission
    // to exceed the author's earthwork budget at the mouth.
    lo[n - 1] = Math.max(lo[n - 1]!, mouth);
    hi[n - 1] = Math.min(hi[n - 1]!, mouth);
    want[n - 1] = mouth;
  }
  const minSlope = r.kind === 'river' ? 0.00001 : -l.grade,
    maxSlope = r.kind === 'river' ? l.grade : l.grade;
  // z[i] - z[i+1] is bounded; interval propagation is exact on a chain.
  for (let i = 1; i < n; i++) {
    const d = distance(points[i - 1]!, points[i]!);
    lo[i] = Math.max(lo[i]!, lo[i - 1]! - maxSlope * d);
    hi[i] = Math.min(hi[i]!, hi[i - 1]! - minSlope * d);
  }
  for (let i = n - 2; i >= 0; i--) {
    const d = distance(points[i]!, points[i + 1]!);
    lo[i] = Math.max(lo[i]!, lo[i + 1]! + minSlope * d);
    hi[i] = Math.min(hi[i]!, hi[i + 1]! + maxSlope * d);
  }
  if (lo.some((v, i) => v > hi[i]! + 1e-7))
    throw Error(
      r.kind === 'river'
        ? 'Kein durchgängiger Abfluss innerhalb der Eingriffsgrenzen.'
        : 'Steigung oder Erdarbeiten überschreiten die Grenzen.',
    );
  const z: number[] = [];
  z[0] = Math.max(lo[0]!, Math.min(hi[0]!, want[0]!));
  for (let i = 1; i < n; i++) {
    const d = distance(points[i - 1]!, points[i]!);
    z[i] = Math.max(
      lo[i]!,
      z[i - 1]! - maxSlope * d,
      Math.min(hi[i]!, z[i - 1]! - minSlope * d, want[i]!),
    );
  }
  return points.map((p, i) => ({
    ...p,
    z: z[i]!,
    structure: modes[i] === 'tunnel' && (i === 0 || i === n - 1) ? 'ground' : modes[i]!,
  }));
}

/** Retain the existing interval solver, but constrain the actual interpolated
 * terrain between its nodes too. Fine source tiles may lie entirely between
 * the width-based path samples, so probe their complete interpolation support.
 * Only offending samples become profile nodes; the canonical terrain stays intact. */
function solveRiverProfile(
  points: Point[],
  r: LandscapeRecord,
  sampler: TerrainSampler,
  modes: RouteStructure[],
  records: LandscapeRecord[],
  mouth?: number,
) {
  const sources = records.flatMap((record) =>
    record.height
      ? [
          {
            box: heightInfluenceBounds(record.height),
            height: record.height,
            step: record.height.pixel / 4,
          },
        ]
      : [],
  );
  for (let pass = 0; pass < 12; pass++) {
    const nodes = solveProfile(points, r, sampler, modes, mouth),
      refined = [points[0]!],
      structures = [modes[0]!];
    let station = 0,
      changed = false;
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1]!,
        b = nodes[i]!,
        length = distance(a, b),
        probes = new Set([0.25, 0.5, 0.75]);
      const sourceEnd = r.width * 8;
      if (r.line?.fadeIn && sourceEnd > station && sourceEnd < station + length)
        probes.add((sourceEnd - station) / length);
      for (const source of sources) {
        const range = routeSegmentRange(a, b, source.box);
        if (!range) continue;
        // Include source-node crossings exactly: a narrow crest at a canonical
        // node must not hide between the otherwise regular quarter-pixel probes.
        for (const axis of ['x', 'y'] as const) {
          const delta = b[axis] - a[axis];
          if (!delta) continue;
          for (let grid = -2; grid <= 65; grid++) {
            const t = (source.height[axis] + grid * source.height.pixel - a[axis]) / delta;
            if (t > 0 && t < 1 && t >= range[0] && t <= range[1]) probes.add(t);
          }
        }
        const count = Math.max(1, Math.ceil((length * (range[1] - range[0])) / source.step));
        for (let j = 0; j <= count; j++) {
          const t = range[0] + ((range[1] - range[0]) * j) / count;
          if (t > 0 && t < 1) probes.add(t);
        }
      }
      for (const t of [...probes].sort((a, b) => a - b)) {
        const p = mix(a, b, t),
          ground = sampler.sample(p).heightM,
          water = a.z + (b.z - a.z) * t,
          bed = water - r.route!.limits.depth * routeRiverFade(r, station + length * t),
          limits = r.route!.limits;
        if (bed < ground - limits.cut - 1e-6 || bed > ground + limits.fill + 1e-6) {
          const near =
            distance(refined.at(-1)!, p) < 1e-8
              ? refined.at(-1)!
              : distance(p, b) < 1e-8
                ? b
                : undefined;
          if (near) {
            if (Math.abs(sampler.sample(near).heightM - ground) > 1e-6)
              throw Error(
                'Geländewechsel unterhalb der Profilgenauigkeit. Kürzeren Abschnitt planen.',
              );
            continue;
          }
          refined.push(p);
          if (refined.length > 4096)
            throw Error('Verlauf zu detailreich. Kürzere Abschnitte anlegen.');
          structures.push(t < 0.5 ? modes[i - 1]! : modes[i]!);
          changed = true;
        }
      }
      refined.push(points[i]!);
      structures.push(modes[i]!);
      station += length;
      if (refined.length > 4096) throw Error('Verlauf zu detailreich. Kürzere Abschnitte anlegen.');
    }
    if (!changed) return nodes;
    points = refined;
    modes = structures;
  }
  throw Error(
    'Kein durchgängiger Abfluss zwischen den Profilpunkten innerhalb der Eingriffsgrenzen.',
  );
}
export function planRoute(
  records: LandscapeRecord[],
  input: LandscapeRecord,
  retain = false,
): LandscapeRecord {
  const r = structuredClone(input);
  validateRoute(r, false);
  const s = r.route!;
  const sampler = new TerrainSampler(records.filter((x) => x.id !== r.id)),
    anchors = s.anchors.map((p) => ({ ...p }));
  let mouth: number | undefined;
  if (s.mouth) {
    const target = records.find((x) => x.id === s.mouth!.id);
    if (!target) throw Error('Mündungsanschluss fehlt.');
    if (target.route && target.kind === 'river') {
      if (target.route.conflict) throw Error('Zielfluss hat einen ungelösten Konflikt.');
      const hit = nearestRoute(target.route.nodes, s.mouth.point);
      if (!hit) throw Error('Zielfluss ist leer.');
      anchors[anchors.length - 1] = hit.point;
      mouth = hit.z;
    } else if (target.surface === 'freshwater') {
      if (!contains(anchors.at(-1)!, target.polygons))
        throw Error('Mündungspunkt innerhalb des gewählten Sees setzen.');
      mouth = target.waterLevelM ?? sampler.seaLevelM + 1;
    } else throw Error('Mündung braucht einen geplanten Fluss oder einen See.');
  } else if (r.kind === 'river' && sampler.water(anchors.at(-1)!))
    mouth = sampler.waterLevel(anchors.at(-1)!);
  s.anchors = anchors;
  let final: RouteNode[] | undefined, lastError: unknown;
  for (const attempt of retain ? ['retain', 'search'] : ['search', 'structures']) {
    const points: Point[] = [],
      modes: RouteStructure[] = [];
    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i - 1]!,
        b = anchors[i]!,
        choice = s.sections[i - 1]!,
        step = Math.max(0.5, r.width / 3, distance(a, b) / 512);
      const old = attempt === 'retain' ? oldLeg(s.nodes, a, b) : undefined;
      const direct = choice === 'tunnel' || choice === 'bridge' || attempt === 'structures';
      const path = old ?? resample(direct ? [a, b] : leg(a, b, r, sampler, retain), step);
      const h0 = sampler.sample(a).heightM,
        h1 = sampler.sample(b).heightM;
      path.forEach((p, j) => {
        if (points.length && j === 0) return;
        const mode: RouteStructure =
          retain && s.nodes.length
            ? nearestRoute(s.nodes, p)!.structure
            : choice !== 'auto'
              ? choice
              : r.kind === 'river'
                ? 'ground'
                : sampler.water(p)
                  ? 'bridge'
                  : attempt === 'structures' &&
                      sampler.sample(p).heightM >
                        h0 + ((h1 - h0) * j) / (path.length - 1) + s.limits.clearance
                    ? 'tunnel'
                    : 'ground';
        points.push(p);
        modes.push(mode);
      });
    }
    if (points.length > 4096) throw Error('Verlauf zu lang. Kürzere Abschnitte anlegen.');
    try {
      final =
        r.kind === 'river'
          ? solveRiverProfile(points, r, sampler, modes, records, mouth)
          : solveProfile(points, r, sampler, modes, mouth);
      break;
    } catch (e) {
      lastError = e;
    }
    if (attempt === 'structures' || (r.kind === 'river' && attempt === 'search')) break;
  }
  if (!final) throw lastError ?? Error('Keine passende Trasse.');
  s.nodes = final;
  delete s.conflict;
  r.points = anchors.map((p) => ({ ...p }));
  validateRoute(r);
  return r;
}

function oldLeg(nodes: RouteNode[], a: Point, b: Point) {
  let first = 0,
    last = nodes.length - 1,
    da = Infinity,
    db = Infinity;
  nodes.forEach((p, i) => {
    if (distance(p, a) < da) {
      da = distance(p, a);
      first = i;
    }
    if (distance(p, b) < db) {
      db = distance(p, b);
      last = i;
    }
  });
  return first < last && da < 0.01 && db < 0.01
    ? nodes.slice(first, last + 1).map((p) => ({ x: p.x, y: p.y }))
    : undefined;
}
/** Resolve downstream first. A cycle is never a valid river network. */
export function replanRoutes(records: LandscapeRecord[], strict = true) {
  const result = [...records],
    done = new Set<string>(),
    active = new Set<string>();
  function visit(r: LandscapeRecord) {
    if (done.has(r.id)) return;
    if (active.has(r.id)) throw Error('Flussanschlüsse bilden einen Kreis.');
    active.add(r.id);
    const target = result.find((x) => x.id === r.route?.mouth?.id);
    if (target?.route) visit(target);
    try {
      const next = planRoute(result, r, true);
      result[result.findIndex((x) => x.id === r.id)] = next;
    } catch (e) {
      if (strict && r.route!.protected) throw e;
      result[result.findIndex((x) => x.id === r.id)] = {
        ...r,
        route: { ...r.route!, conflict: (e as Error).message },
      };
    }
    active.delete(r.id);
    done.add(r.id);
  }
  for (const r of records
    .filter((r) => r.route)
    .sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === 'river' ? -1 : 1)))
    visit(r);
  return result;
}
/** Atomic terrain edit: untouched base remains canonical. Only protected
 * corridors attenuate the brush, with smooth transitions outside the centre. */
export function coupleRouteEdits(
  before: LandscapeRecord[],
  tiles: LandscapeRecord[],
  limited?: (factor: number) => void,
): LandscapeRecord[] {
  const routes = before.filter((r) => r.route);
  if (!routes.length) return tiles;
  const ids = new Set(tiles.map((r) => r.id)),
    replace = (ts: LandscapeRecord[]) => [...before.filter((r) => !ids.has(r.id)), ...ts];
  const base = new TerrainSampler(before, false);
  let result: LandscapeRecord[] | undefined,
    adjusted = tiles;
  for (const factor of [1, 0.5, 0.25, 0.125, 0.0625, 0]) {
    adjusted =
      factor === 1
        ? tiles
        : tiles.map((tile) => {
            if (!tile.height) return tile;
            const t = tile.height,
              values = decodeHeights(t).slice(),
              prior = before.find((r) => r.id === tile.id)?.height,
              priorValues = prior ? decodeHeights(prior) : undefined;
            for (let i = 0; i < values.length; i++) {
              if (Number.isNaN(values[i]) || (priorValues && values[i] === priorValues[i]))
                continue;
              const p = { x: t.x + (i % 64) * t.pixel, y: t.y + Math.floor(i / 64) * t.pixel };
              let weight = 0;
              for (const r of routes.filter((r) => r.route!.protected)) {
                const hit = nearestRoute(r.route!.nodes, p);
                if (!hit) continue;
                const core =
                    r.width / 2 +
                    r.route!.limits.shoulder +
                    (t.version === 2 ? t.pixel * Math.SQRT2 : 0),
                  edge = Math.max(core, r.route!.limits.corridor);
                weight = Math.max(
                  weight,
                  hit.distance <= core ? 1 : Math.max(0, 1 - (hit.distance - core) / edge),
                );
              }
              const old = t.version === 2 ? (priorValues?.[i] ?? 0) : base.sample(p).heightM;
              values[i] =
                (Number.isNaN(old) ? 0 : old) +
                (values[i]! - (Number.isNaN(old) ? 0 : old)) * (1 - weight * (1 - factor));
            }
            return {
              ...heightRecord(t.x, t.y, t.pixel, values, t.version),
              id: tile.id,
              revision: tile.revision,
            };
          });
    try {
      result = replanRoutes(replace(adjusted));
      if (factor < 1) limited?.(factor);
      break;
    } catch (e) {
      if (factor === 0) throw e;
    }
  }
  if (!result) throw Error('Geschützten Verlauf prüfen.');
  return [
    ...adjusted,
    ...result.filter(
      (r) => r.route && JSON.stringify(r) !== JSON.stringify(before.find((x) => x.id === r.id)),
    ),
  ];
}
