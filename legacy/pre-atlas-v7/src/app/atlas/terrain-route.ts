import {
  type RouteStructure,
  type RouteLimits,
  type RouteNode,
  type TerrainRoute,
} from './terrain-route-contracts';
import type { Point } from '../shared/contracts';
import type { LandscapeRecord } from './landscape-contracts';
import type { LandscapeBox } from './landscape-bounds';
export const routeDefaults = (kind: 'road' | 'river'): RouteLimits =>
  kind === 'river'
    ? { corridor: 200, cut: 8, fill: 0, shoulder: 20, grade: 1, depth: 1.5, clearance: 3 }
    : { corridor: 100, cut: 3, fill: 3, shoulder: 6, grade: 0.12, depth: 0, clearance: 4 };
export const routeSpec = (kind: 'road' | 'river', anchors: Point[]): TerrainRoute => ({
  version: 1,
  anchors: anchors.map((p) => ({ x: p.x, y: p.y })),
  limits: routeDefaults(kind),
  protected: true,
  sections: anchors.slice(1).map(() => 'auto'),
  nodes: [],
});
/** Water width and bed depth taper over the same physical source distance. */
export const routeRiverFade = (r: LandscapeRecord, station: number) =>
  r.kind === 'river' && r.line?.fadeIn ? Math.min(1, station / (r.width * 8)) : 1;
const finite = (x: number, min: number, max: number) => Number.isFinite(x) && x >= min && x <= max;
export function validateRoute(r: LandscapeRecord, planned = true) {
  const s = r.route;
  if (!s) return;
  const point = (p: Point) => p && finite(p.x, -1e12, 1e12) && finite(p.y, -1e12, 1e12);
  if (
    !['road', 'river'].includes(r.kind) ||
    s.version !== 1 ||
    typeof s.protected !== 'boolean' ||
    !Array.isArray(s.anchors) ||
    s.anchors.length < 2 ||
    s.anchors.length > 128 ||
    s.anchors.some((p) => !point(p)) ||
    !s.limits ||
    !finite(s.limits.corridor, 1, 100000) ||
    !finite(s.limits.cut, 0, 10000) ||
    !finite(s.limits.fill, 0, 10000) ||
    !finite(s.limits.shoulder, 0.1, 10000) ||
    !finite(s.limits.grade, 0.001, 2) ||
    !finite(s.limits.depth, 0, 1000) ||
    !finite(s.limits.clearance, 0.1, 1000) ||
    !Array.isArray(s.sections) ||
    s.sections.length !== s.anchors.length - 1 ||
    s.sections.some((k) => !['auto', 'ground', 'bridge', 'ford', 'tunnel'].includes(k)) ||
    (r.kind === 'river' &&
      (s.limits.fill !== 0 || s.sections.some((k) => k !== 'auto' && k !== 'ground'))) ||
    !Array.isArray(s.nodes) ||
    s.nodes.length > 4096 ||
    (planned && s.nodes.length < 2) ||
    s.nodes.some(
      (p) =>
        !point(p) ||
        !finite(p.z, -1e6, 1e6) ||
        !['ground', 'bridge', 'ford', 'tunnel'].includes(p.structure),
    ) ||
    (s.mouth && (!s.mouth.id || s.mouth.id === r.id || !point(s.mouth.point))) ||
    (s.conflict !== undefined && (typeof s.conflict !== 'string' || s.conflict.length > 500))
  )
    throw Error('Verlauf, Planungskorridor und Eingriffsgrenzen prüfen.');
}
export function routeBounds(r: LandscapeRecord): LandscapeBox {
  const s = r.route!,
    points = [...s.anchors, ...s.nodes],
    pad = s.limits.corridor + r.width / 2 + s.limits.shoulder;
  const x = Math.min(...points.map((p) => p.x)) - pad,
    y = Math.min(...points.map((p) => p.y)) - pad;
  return {
    x,
    y,
    width: Math.max(...points.map((p) => p.x)) + pad - x,
    height: Math.max(...points.map((p) => p.y)) + pad - y,
  };
}
export function nearestRoute(nodes: RouteNode[], p: Point) {
  let result:
    | {
        distance: number;
        z: number;
        structure: RouteStructure;
        point: Point;
        index: number;
        station: number;
      }
    | undefined;
  let travel = 0;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1]!,
      b = nodes[i]!,
      dx = b.x - a.x,
      dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
    );
    const point = { x: a.x + dx * t, y: a.y + dy * t },
      distance = Math.hypot(p.x - point.x, p.y - point.y);
    if (!result || distance < result.distance)
      result = {
        distance,
        z: a.z + (b.z - a.z) * t,
        structure: t < 0.5 ? a.structure : b.structure,
        point,
        index: i,
        station: travel + Math.hypot(dx, dy) * t,
      };
    travel += Math.hypot(dx, dy);
  }
  return result;
}
/** Indexed segments keep per-pixel height sampling local, even for long roads.
 * Contributions are blended, never added or applied in database iteration order. */
export class RouteSurface {
  private cells = new Map<
    string,
    {
      r: LandscapeRecord;
      nodes: RouteNode[];
      offset: number;
      left: number;
      right: number;
      top: number;
      bottom: number;
    }[]
  >();
  private step = 64;
  constructor(records: LandscapeRecord[]) {
    const routes = records.filter((r) => r.route?.nodes.length && !r.route.conflict);
    this.step = Math.max(64, ...routes.map((r) => r.width + 2 * r.route!.limits.shoulder));
    let count = 0;
    for (const r of routes) {
      let offset = 0;
      for (let i = 1; i < r.route!.nodes.length; i++) {
        const a = r.route!.nodes[i - 1]!,
          b = r.route!.nodes[i]!,
          pad = r.width / 2 + r.route!.limits.shoulder;
        const x0 = Math.floor((Math.min(a.x, b.x) - pad) / this.step),
          x1 = Math.floor((Math.max(a.x, b.x) + pad) / this.step);
        const y0 = Math.floor((Math.min(a.y, b.y) - pad) / this.step),
          y1 = Math.floor((Math.max(a.y, b.y) + pad) / this.step);
        // Cells are deliberately coarse; reject segments outside their actual
        // influence before projecting every material texel onto their line.
        // A conservative rounding guard retains endpoint arithmetic at large
        // canonical coordinates. The planning corridor is not terrain influence.
        const guard =
          Number.EPSILON *
          Math.max(1, Math.abs(a.x), Math.abs(a.y), Math.abs(b.x), Math.abs(b.y)) *
          8;
        const segment = {
          r,
          nodes: [a, b],
          offset,
          left: Math.min(a.x, b.x) - pad - guard,
          right: Math.max(a.x, b.x) + pad + guard,
          top: Math.min(a.y, b.y) - pad - guard,
          bottom: Math.max(a.y, b.y) + pad + guard,
        };
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            if (++count > 300000) throw Error('Zu viele Verlaufdetails im Ausschnitt.');
            const key = x + ':' + y,
              list = this.cells.get(key) ?? [];
            list.push(segment);
            this.cells.set(key, list);
          }
        offset += Math.hypot(b.x - a.x, b.y - a.y);
      }
    }
  }
  at(p: Point, base: number) {
    if (!this.cells.size)
      return { height: base, water: undefined, weighted: 0, total: 0, strength: 0 };
    const candidates = this.cells.get(
      Math.floor(p.x / this.step) + ':' + Math.floor(p.y / this.step),
    );
    if (!candidates) return { height: base, water: undefined, weighted: 0, total: 0, strength: 0 };
    const nearest = new Map<
      string,
      { r: LandscapeRecord; hit: NonNullable<ReturnType<typeof nearestRoute>> }
    >();
    for (const { r, nodes, offset, left, right, top, bottom } of candidates) {
      if (p.x < left || p.x > right || p.y < top || p.y > bottom) continue;
      const hit = nearestRoute(nodes, p)!;
      hit.station += offset;
      if (!nearest.has(r.id) || nearest.get(r.id)!.hit.distance > hit.distance)
        nearest.set(r.id, { r, hit });
    }
    let weighted = 0,
      total = 0,
      strength = 0,
      water: number | undefined;
    for (const { r, hit } of nearest.values()) {
      const s = r.route!,
        fade = routeRiverFade(r, hit.station),
        radius = (r.width / 2) * fade;
      if (hit.distance > radius + s.limits.shoulder) continue;
      if (r.kind === 'river' && hit.distance <= radius)
        water = water === undefined ? hit.z : Math.min(water, hit.z);
      if (hit.structure === 'bridge' || hit.structure === 'tunnel') continue;
      const t = Math.max(
          0,
          Math.min(1, (radius + s.limits.shoulder - hit.distance) / s.limits.shoulder),
        ),
        weight = t * t * (3 - 2 * t);
      const target = r.kind === 'river' ? hit.z - s.limits.depth * fade : hit.z;
      // Limits apply to actual ground movement, including banks.
      const bounded = Math.max(base - s.limits.cut, Math.min(base + s.limits.fill, target));
      weighted += bounded * weight;
      total += weight;
      strength = Math.max(strength, weight);
    }
    return {
      height: total ? base + (weighted / total - base) * strength : base,
      water,
      weighted,
      total,
      strength,
    };
  }
}
