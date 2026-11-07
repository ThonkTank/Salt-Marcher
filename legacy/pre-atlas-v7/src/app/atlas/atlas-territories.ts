import type { Point, Polygon } from '../shared/contracts';
import { type LandscapeBox } from './landscape-bounds';
import {
  brushFootprint,
  intersectPolygons,
  subtractPolygons,
  unionPolygons,
} from './landscape-brush';
import { contains } from './landscape-geometry';
export interface TerritoryType {
  id: string;
  name: string;
  rank: number;
}
export interface AtlasTerritoryLayer {
  id: string;
  revision: number;
  name: string;
  visible: boolean;
  order: number;
  types: TerritoryType[];
}
export interface AtlasTerritory {
  id: string;
  revision: number;
  name: string;
  layerId: string;
  parentId: string | null;
  typeId: string;
  rank: number;
  polygons: Polygon[];
  color: string;
  opacity: number;
  border: 'solid' | 'dashed';
  locationId?: string;
  labelPoint?: Point;
}
export interface TerritoryState {
  layers: AtlasTerritoryLayer[];
  territories: AtlasTerritory[];
}
export type TerritoryAction =
  | {
      kind: 'territory-layer';
      layer: AtlasTerritoryLayer;
      expectedRevision: number | null;
    }
  | {
      kind: 'territory-put';
      territory: AtlasTerritory;
      expectedRevision: number | null;
    }
  | { kind: 'territory-remove'; id: string; expectedRevision: number }
  | {
      kind: 'territory-stroke';
      id: string;
      expectedRevision: number;
      points: Point[];
      radius: number;
      operation: 'add' | 'erase';
    }
  | {
      kind: 'territory-vertex';
      id: string;
      expectedRevision: number;
      polygon: number;
      ring: number;
      vertex: number;
      point: Point | null;
      insert?: boolean;
    };
export function defaultTerritoryLayers(): AtlasTerritoryLayer[] {
  return [
    {
      id: 'geography',
      revision: 0,
      name: 'Geografisch',
      visible: true,
      order: 0,
      types: [
        ['continent', 'Kontinent', 5],
        ['landscape', 'Landschaft', 4],
        ['mountains', 'Gebirge', 3],
        ['forest', 'Wald', 2],
        ['water', 'Gewässer', 3],
      ].map(([id, name, rank]) => ({
        id: String(id),
        name: String(name),
        rank: Number(rank),
      })),
    },
    {
      id: 'politics',
      revision: 0,
      name: 'Politisch',
      visible: true,
      order: 1,
      types: [
        ['kingdom', 'Königreich', 5],
        ['province', 'Provinz', 4],
        ['city', 'Stadt', 3],
        ['village', 'Dorf', 2],
        ['district', 'Stadtteil', 1],
      ].map(([id, name, rank]) => ({
        id: String(id),
        name: String(name),
        rank: Number(rank),
      })),
    },
  ];
}
export function territoryBounds(polygons: Polygon[]): LandscapeBox {
  let x = Infinity,
    y = Infinity,
    xx = -Infinity,
    yy = -Infinity;
  for (const p of polygons)
    for (const v of p.outer) {
      x = Math.min(x, v.x);
      y = Math.min(y, v.y);
      xx = Math.max(xx, v.x);
      yy = Math.max(yy, v.y);
    }
  return x === Infinity
    ? { x: 0, y: 0, width: 0, height: 0 }
    : { x, y, width: xx - x, height: yy - y };
}
export function polygonArea(polygons: Polygon[]): number {
  const area = (ring: Point[]) => {
    const o = ring[0];
    return !o
      ? 0
      : Math.abs(
          ring.reduce((s, p, i) => {
            const q = ring[(i + 1) % ring.length]!;
            return s + (p.x - o.x) * (q.y - o.y) - (q.x - o.x) * (p.y - o.y);
          }, 0) / 2,
        );
  };
  return polygons.reduce((s, p) => s + area(p.outer) - p.holes.reduce((s, h) => s + area(h), 0), 0);
}
/** Normalization may reorder a ring. A fixed square-metre epsilon is smaller
 * than one representable area step for continental polygons. Keep the existing
 * small-shape tolerance and allow only floating-point roundoff at larger scales.
 */
function samePolygonArea(a: Polygon[], b: Polygon[]): boolean {
  const first = polygonArea(a),
    second = polygonArea(b);
  return Math.abs(first - second) <= Math.max(1e-5, 16 * Number.EPSILON * Math.max(first, second));
}
const text = (s: unknown) => typeof s === 'string' && s.trim().length > 0 && s.length <= 1000;
const point = (p: Point) =>
  p &&
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  Math.abs(p.x) <= 1e12 &&
  Math.abs(p.y) <= 1e12;
export function validateTerritoryLayer(l: AtlasTerritoryLayer) {
  if (
    !l ||
    !text(l.id) ||
    !Number.isInteger(l.revision) ||
    l.revision < 0 ||
    !text(l.name) ||
    typeof l.visible !== 'boolean' ||
    !Number.isFinite(l.order) ||
    !Array.isArray(l.types) ||
    !l.types.length ||
    l.types.length > 100 ||
    new Set(l.types.map((t) => t.id)).size !== l.types.length ||
    l.types.some(
      (t) =>
        !t || !text(t.id) || !text(t.name) || !Number.isInteger(t.rank) || t.rank < 0 || t.rank > 5,
    )
  )
    throw Error('Regionsebene und Bedeutungsstufen prüfen.');
}
export function validateTerritory(t: AtlasTerritory, state: TerritoryState) {
  const layer = state.layers.find((l) => l.id === t?.layerId);
  if (
    !t ||
    !text(t.id) ||
    !Number.isInteger(t.revision) ||
    t.revision < 0 ||
    !(t.parentId === null || text(t.parentId)) ||
    (t.locationId !== undefined && !text(t.locationId)) ||
    !text(t.name) ||
    !layer ||
    !layer.types.some((k) => k.id === t.typeId) ||
    !Number.isInteger(t.rank) ||
    t.rank < 0 ||
    t.rank > 5 ||
    !/^#[0-9a-f]{6}$/i.test(t.color) ||
    !Number.isFinite(t.opacity) ||
    t.opacity < 0 ||
    t.opacity > 1 ||
    !['solid', 'dashed'].includes(t.border) ||
    !Array.isArray(t.polygons) ||
    (t.labelPoint && !point(t.labelPoint))
  )
    throw Error('Regionsdaten prüfen.');
  let count = 0;
  for (const p of t.polygons) {
    if (!Array.isArray(p.outer) || !Array.isArray(p.holes)) throw Error('Regionsfläche prüfen.');
    for (const r of [p.outer, ...p.holes]) {
      count += r.length;
      if (r.length < 3 || r.some((v) => !point(v))) throw Error('Regionsgrenze prüfen.');
    }
  }
  if (count > 100000)
    throw Error('Regionsgrenze zu umfangreich. In kleineren Abschnitten bearbeiten.');
  const normalized = unionPolygons(t.polygons, t.polygons);
  if (!samePolygonArea(normalized, t.polygons) || t.polygons.some((p) => polygonArea([p]) <= 1e-8))
    throw Error('Regionsgrenze kreuzt sich oder umschließt keine Fläche.');
  let parent = t.parentId;
  const seen = new Set([t.id]);
  while (parent !== null) {
    const p = state.territories.find((r) => r.id === parent);
    if (!p || p.layerId !== t.layerId || seen.has(p.id))
      throw Error('Oberregion fehlt, gehört zu anderer Ebene oder bildet einen Kreis.');
    seen.add(p.id);
    parent = p.parentId;
  }
  const p = state.territories.find((p) => p.id === t.parentId);
  if (p && polygonArea(subtractPolygons(t.polygons, p.polygons)) > 1e-5)
    throw Error('Unterregion muss innerhalb ihrer Oberregion bleiben.');
}
function checkedChanges(state: TerritoryState, changes: AtlasTerritory[]) {
  const changed = new Map(changes.map((t) => [t.id, t])),
    final = {
      ...state,
      territories: state.territories.map((t) => changed.get(t.id) ?? t),
    };
  for (const t of final.territories) validateTerritory(t, final);
  for (const t of changes)
    for (const other of final.territories)
      if (
        t.id !== other.id &&
        t.layerId === other.layerId &&
        t.parentId === other.parentId &&
        polygonArea(intersectPolygons(t.polygons, other.polygons)) > 1e-5
      )
        throw Error('Die Grenze würde andere Regionen überschneiden.');
  return changes;
}
/** A brush transfers painted land from siblings in the same atomic command.
 * Erasure leaves the parent remainder unassigned, deliberately not a neighbour. */
function reshapeTerritory(
  state: TerritoryState,
  id: string,
  polygons: Polygon[],
): AtlasTerritory[] {
  const old = state.territories.find((t) => t.id === id);
  if (!old) throw Error('Region fehlt.');
  const parent = state.territories.find((t) => t.id === old.parentId);
  if (parent) polygons = intersectPolygons(polygons, parent.polygons);
  const changed: AtlasTerritory[] = [{ ...old, polygons }],
    added = subtractPolygons(polygons, old.polygons);
  for (const neighbour of state.territories.filter(
    (t) => t.id !== id && t.layerId === old.layerId && t.parentId === old.parentId,
  )) {
    if (polygonArea(intersectPolygons(neighbour.polygons, added)) <= 1e-5) continue;
    changed.push({
      ...neighbour,
      polygons: subtractPolygons(neighbour.polygons, added),
    });
  }
  return checkedChanges(state, changed);
}
function onSegment(p: Point, a: Point, b: Point, epsilon: number) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy);
  return (
    length > 0 &&
    Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) <= epsilon * length &&
    (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= epsilon * epsilon
  );
}
/** Refine a topological vertex, including neighbours whose edge contains that
 * vertex without storing it. Triple junctions therefore move together. */
export function territoryVertex(
  state: TerritoryState,
  id: string,
  edit: {
    polygon: number;
    ring: number;
    vertex: number;
    point: Point | null;
    insert?: boolean;
  },
): AtlasTerritory[] {
  if (
    ![edit.polygon, edit.ring, edit.vertex].every((n) => Number.isInteger(n) && n >= 0) ||
    (edit.point !== null && !point(edit.point))
  )
    throw Error('Grenzpunkt prüfen.');
  const old = state.territories.find((t) => t.id === id),
    poly = old?.polygons[edit.polygon],
    ring = poly && [poly.outer, ...poly.holes][edit.ring],
    source = ring?.[edit.vertex];
  if (!old || !ring || !source) throw Error('Grenzpunkt fehlt.');
  const bounds = territoryBounds(old.polygons),
    epsilon = Math.max(1e-7, Math.max(bounds.width, bounds.height) * 1e-10),
    end = ring[(edit.vertex + 1) % ring.length]!;
  if (edit.insert && (!edit.point || !onSegment(edit.point, source, end, epsilon)))
    throw Error('Neuen Punkt auf eine vorhandene Grenze setzen.');
  const target = edit.insert ? edit.point! : source,
    changes: AtlasTerritory[] = [];
  const nodes = edit.insert
    ? []
    : state.territories
        .filter((t) => t.layerId === old.layerId && t.parentId === old.parentId)
        .flatMap((t) => t.polygons.flatMap((p) => [p.outer, ...p.holes].flat()));
  if (edit.point === null) {
    // Removing a branch would replace several incident boundaries with unrelated
    // chords and silently unassign land. Ordinary two-branch bends remain editable.
    const rays: Point[] = [];
    for (const t of state.territories) {
      if (t.layerId !== old.layerId || t.parentId !== old.parentId) continue;
      for (const p of t.polygons)
        for (const r of [p.outer, ...p.holes])
          for (let i = 0; i < r.length; i++) {
            const a = r[i]!,
              b = r[(i + 1) % r.length]!;
            if (!onSegment(source, a, b, epsilon)) continue;
            for (const v of [a, b]) {
              const distance = Math.hypot(v.x - source.x, v.y - source.y);
              if (distance <= epsilon) continue;
              if (
                rays.some((q) =>
                  distance < Math.hypot(q.x - source.x, q.y - source.y)
                    ? onSegment(v, source, q, epsilon)
                    : onSegment(q, source, v, epsilon),
                )
              )
                continue;
              rays.push(v);
              if (rays.length > 2)
                throw Error(
                  'Verzweigten Grenzpunkt erhalten. Grenze durch Verschieben verfeinern.',
                );
            }
          }
    }
  }
  for (const t of state.territories) {
    if (t.layerId !== old.layerId || t.parentId !== old.parentId) continue;
    const polygons = structuredClone(t.polygons);
    let changed = false;
    for (const p of polygons)
      for (const r of [p.outer, ...p.holes]) {
        if (r.length > 3 && r[0]!.x === r.at(-1)!.x && r[0]!.y === r.at(-1)!.y) r.pop();
        if (!edit.insert) {
          // A straight owner edge may omit the junction between two neighbours.
          // Node the incident edges before moving their common endpoint.
          const noded: Point[] = [];
          for (let i = 0; i < r.length; i++) {
            const a = r[i]!,
              b = r[(i + 1) % r.length]!;
            noded.push(a);
            if (!onSegment(source, a, b, epsilon)) continue;
            const inside = nodes
              .filter(
                (v) =>
                  Math.hypot(v.x - a.x, v.y - a.y) > epsilon &&
                  Math.hypot(v.x - b.x, v.y - b.y) > epsilon &&
                  onSegment(v, a, b, epsilon),
              )
              .sort((v, w) => Math.hypot(v.x - a.x, v.y - a.y) - Math.hypot(w.x - a.x, w.y - a.y));
            for (const v of inside)
              if (Math.hypot(noded.at(-1)!.x - v.x, noded.at(-1)!.y - v.y) > epsilon)
                noded.push({ ...v });
          }
          r.splice(0, r.length, ...noded);
        }
        let index = r.findIndex((q) => Math.hypot(q.x - target.x, q.y - target.y) <= epsilon);
        if (edit.insert && index >= 0) continue;
        if (index < 0) {
          const edge = r.findIndex((q, i) => onSegment(target, q, r[(i + 1) % r.length]!, epsilon));
          if (edge < 0) continue;
          index = edge + 1;
          r.splice(index, 0, { ...target });
        }
        if (edit.insert) {
          changed = true;
          continue;
        }
        if (edit.point === null) {
          if (r.length <= 3) throw Error('Mindestens drei Grenzpunkte behalten.');
          r.splice(index, 1);
        } else r[index] = { ...edit.point };
        changed = true;
      }
    if (changed) {
      // Clipping rejects self-crossing rings and collapsed parts instead of repairing
      // an ambiguous drag into a different region silently.
      const normalized = unionPolygons(polygons, polygons);
      if (!samePolygonArea(normalized, polygons) || polygons.some((p) => polygonArea([p]) <= 1e-8))
        throw Error('Grenze kreuzt sich oder fällt zusammen.');
      changes.push({ ...t, polygons });
    }
  }
  return checkedChanges(state, changes);
}
export function territoryStroke(
  state: TerritoryState,
  id: string,
  points: Point[],
  radius: number,
  operation: 'add' | 'erase',
) {
  if (
    !Array.isArray(points) ||
    !points.length ||
    points.length > 2000 ||
    points.some((p) => !point(p)) ||
    !Number.isFinite(radius) ||
    radius <= 0 ||
    radius > 1e8 ||
    !['add', 'erase'].includes(operation)
  )
    throw Error('Regionspinsel prüfen.');
  const t = state.territories.find((t) => t.id === id);
  if (!t) throw Error('Region wählen.');
  const footprint = brushFootprint(points, radius);
  return reshapeTerritory(
    state,
    id,
    operation === 'add'
      ? unionPolygons(t.polygons, footprint)
      : subtractPolygons(t.polygons, footprint),
  );
}
/** Interior anchor with maximum clearance on a bounded adaptive grid. */
export function territoryAnchor(polygons: Polygon[], preferred?: Point): Point | null {
  if (preferred && contains(preferred, polygons)) return preferred;
  let best: Point | null = null,
    bestDistance = -1;
  for (const polygon of [...polygons]
    .sort((a, b) => polygonArea([b]) - polygonArea([a]))
    .slice(0, 8)) {
    let box = territoryBounds([polygon]);
    for (let pass = 0; pass < 4; pass++) {
      const dx = box.width / 12,
        dy = box.height / 12;
      let local: Point | null = best;
      for (let x = 0; x < 12; x++)
        for (let y = 0; y < 12; y++) {
          const p = { x: box.x + (x + 0.5) * dx, y: box.y + (y + 0.5) * dy };
          if (!contains(p, [polygon])) continue;
          let distance = Infinity;
          for (const ring of [polygon.outer, ...polygon.holes])
            for (let i = 0; i < ring.length; i++) {
              const a = ring[i]!,
                b = ring[(i + 1) % ring.length]!,
                vx = b.x - a.x,
                vy = b.y - a.y,
                t = Math.max(
                  0,
                  Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)),
                );
              distance = Math.min(distance, Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy));
            }
          if (distance > bestDistance) {
            bestDistance = distance;
            best = local = p;
          }
        }
      if (!local) break;
      box = { x: local.x - dx, y: local.y - dy, width: dx * 2, height: dy * 2 };
    }
  }
  return best;
}
