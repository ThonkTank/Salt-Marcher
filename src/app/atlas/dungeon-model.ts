import { planVoxelDungeon, spatialFan, floorElevation } from './spatial-3d';
import { volumeProjection } from './volume-model';
import type { DungeonMovement } from './volume-contracts';
import clipping, { type MultiPolygon } from 'polygon-clipping';
import { visibility } from '../../compute';
import type { Point, Polygon, RoomGeometry } from '../shared/contracts';
import type { SpatialGeometry } from './dungeon-geometry-contracts';
import type { DungeonPose } from './dungeon-position-contracts';
import type { DungeonWaypoint } from './dungeon-travel-contracts';
import { inside, anchored, drawingSegments, combineRooms } from './drawing-model';
import type { PlayerObserver, PlayerSettings } from '../runtime/player-contracts';
const lightCache = new WeakMap<SpatialGeometry, Map<string, Polygon[]>>();
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function intersects(a: Point, b: Point, c: Point, d: Point) {
  return cross(a, b, c) * cross(a, b, d) < -1e-10 && cross(c, d, a) * cross(c, d, b) < -1e-10;
}
export function normalizePolygons(p: Polygon[]): Polygon[] {
  const ring = (r: Point[]) =>
    r
      .map((p) => ({ x: Math.round(p.x * 1e5) / 1e5, y: Math.round(p.y * 1e5) / 1e5 }))
      .filter((p, i, a) => !i || distance(p, a[i - 1]!) > 1e-6);
  return p
    .map((p) => ({ outer: ring(p.outer), holes: p.holes.map(ring).filter((r) => r.length >= 3) }))
    .filter((p) => p.outer.length >= 3);
}
export function unionPerception(a: Polygon[], b: Polygon[]) {
  return normalizePolygons(combineRooms([normalizePolygons(a), normalizePolygons(b)]));
}
export function clipPolygons(a: Polygon[], b: Polygon[]): Polygon[] {
  a = normalizePolygons(a);
  b = normalizePolygons(b);
  if (!a.length || !b.length) return [];
  const multi = (p: Polygon[]): MultiPolygon =>
    p.map((p) =>
      [p.outer, ...p.holes].map((r) => [
        ...r.map((p) => [p.x, p.y] as [number, number]),
        [r[0]!.x, r[0]!.y] as [number, number],
      ]),
    );
  return normalizePolygons(
    clipping
      .intersection(multi(a), multi(b))
      .map((p) => ({
        outer: p[0]!.slice(0, -1).map(([x, y]) => ({ x, y })),
        holes: p.slice(1).map((r) => r.slice(0, -1).map(([x, y]) => ({ x, y }))),
      }))
      .filter((p) => p.outer.length >= 3),
  );
}
export function centerInRoom(room: RoomGeometry, near?: Point): Point {
  if (near && inside(near, room.polygons)) return near;
  const points = room.polygons.flatMap((p) => p.outer),
    center = {
      x: points.reduce((n, p) => n + p.x, 0) / points.length,
      y: points.reduce((n, p) => n + p.y, 0) / points.length,
    };
  if (near) {
    for (const radius of [0.05, 0.15, 0.4, 1, 2, 4])
      for (let i = 0; i < 32; i++) {
        const p = {
          x: near.x + radius * Math.cos((i * Math.PI) / 16),
          y: near.y + radius * Math.sin((i * Math.PI) / 16),
        };
        if (inside(p, room.polygons)) return p;
      }
  }
  if (inside(center, room.polygons)) return center;
  for (const p of points)
    for (const t of [0.001, 0.01, 0.1]) {
      const q = { x: p.x + (center.x - p.x) * t, y: p.y + (center.y - p.y) * t };
      if (inside(q, room.polygons)) return q;
    }
  throw new Error('In diesem Raum fehlt eine begehbare Position.');
}
function withinRoom(g: SpatialGeometry, room: RoomGeometry, a: Point, b: Point): Point[] {
  const barriers = g.drawing.elements
    .filter(
      (e) =>
        !e.archived &&
        e.floorId === room.floorId &&
        ((e.kind === 'wall' && !e.passable) || (e.kind === 'door' && e.state !== 'open')),
    )
    .flatMap((e) => {
      const p = anchored(e, g.rooms);
      return p.slice(1).map((b, i) => ({ a: p[i]!, b }));
    });
  const rings = room.polygons.flatMap((p) => [p.outer, ...p.holes]);
  const clear = (a: Point, b: Point) => {
    if (!inside(a, room.polygons) || !inside(b, room.polygons)) return false;
    for (const ring of rings)
      for (let i = 0; i < ring.length; i++)
        if (intersects(a, b, ring[i]!, ring[(i + 1) % ring.length]!)) return false;
    return !barriers.some((e) => intersects(a, b, e.a, e.b));
  };
  if (clear(a, b)) return [b];
  const vertices = rings.flat(),
    minX = Math.min(...vertices.map((p) => p.x)),
    minY = Math.min(...vertices.map((p) => p.y)),
    maxX = Math.max(...vertices.map((p) => p.x)),
    maxY = Math.max(...vertices.map((p) => p.y)),
    cell = Math.max(0.3, Math.max(maxX - minX, maxY - minY) / 70),
    cols = Math.ceil((maxX - minX) / cell) + 1,
    rows = Math.ceil((maxY - minY) / cell) + 1;
  const point = (i: number) => ({
      x: minX + (i % cols) * cell,
      y: minY + Math.floor(i / cols) * cell,
    }),
    valid = new Map<number, boolean>(),
    usable = (i: number) => {
      if (!valid.has(i)) valid.set(i, inside(point(i), room.polygons));
      return valid.get(i)!;
    },
    near = (p: Point) => {
      const x = Math.round((p.x - minX) / cell),
        y = Math.round((p.y - minY) / cell),
        candidates: number[] = [];
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          if (x + dx < 0 || x + dx >= cols || y + dy < 0 || y + dy >= rows) continue;
          const i = (y + dy) * cols + x + dx;
          if (usable(i) && clear(p, point(i))) candidates.push(i);
        }
      return candidates.sort((i, j) => distance(p, point(i)) - distance(p, point(j)))[0];
    };
  const start = near(a),
    end = near(b);
  if (start === undefined || end === undefined)
    throw new Error('Kein begehbarer Weg im Raum. Kontur oder Wanddurchgang prüfen.');
  const scores = new Map<number, number>([[start, 0]]),
    parent = new Map<number, number>(),
    open = [start],
    closed = new Set<number>();
  let found = false;
  while (open.length && closed.size < 6000) {
    let best = 0;
    for (let k = 1; k < open.length; k++)
      if (
        scores.get(open[k]!)! + distance(point(open[k]!), b) <
        scores.get(open[best]!)! + distance(point(open[best]!), b)
      )
        best = k;
    const i = open.splice(best, 1)[0]!;
    if (i === end) {
      found = true;
      break;
    }
    closed.add(i);
    const x = i % cols,
      y = Math.floor(i / cols);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= cols || y + dy < 0 || y + dy >= rows) continue;
        const n = (y + dy) * cols + x + dx;
        if (closed.has(n) || !usable(n) || !clear(point(i), point(n))) continue;
        const score = scores.get(i)! + distance(point(i), point(n));
        if (score < (scores.get(n) ?? Infinity)) {
          scores.set(n, score);
          parent.set(n, i);
          if (!open.includes(n)) open.push(n);
        }
      }
  }
  if (!found) throw new Error('Kein begehbarer Weg im Raum. Kontur oder Wanddurchgang prüfen.');
  const path = [b];
  let i = end;
  while (i !== start) {
    path.unshift(point(i));
    i = parent.get(i)!;
  }
  path.unshift(point(start));
  const simple: Point[] = [];
  let at = a;
  while (path.length) {
    let k = path.length - 1;
    while (k > 0 && !clear(at, path[k]!)) k--;
    at = path[k]!;
    simple.push(at);
    path.splice(0, k + 1);
  }
  return simple;
}
export function planDungeon(
  g: SpatialGeometry,
  start: DungeonPose,
  end: DungeonPose,
  options?: { movement?: DungeonMovement },
): DungeonWaypoint[] {
  const movement = options?.movement ?? start.movement ?? 'walk';
  if (
    movement !== 'walk' ||
    g.drawing.volumes?.some((v) => v.roomId === start.roomId || v.roomId === end.roomId) ||
    Math.abs(
      start.z -
        (g.floors.find((f) => f.id === start.floorId && f.scopeId === start.scopeId)?.elevation ??
          0),
    ) > 0.01 ||
    Math.abs(
      end.z -
        (g.floors.find((f) => f.id === end.floorId && f.scopeId === end.scopeId)?.elevation ?? 0),
    ) > 0.01
  )
    return planVoxelDungeon(g, start, end, movement);
  if (start.scopeId !== end.scopeId)
    throw new Error('Ziel liegt in einer anderen Dungeonzeichnung.');
  const roomById = new Map(g.rooms.map((r) => [r.id, r]));
  const queue = [start.roomId],
    came = new Map<string, { from: string; portalId: string }>(),
    visited = new Set(queue);
  while (queue.length && !visited.has(end.roomId)) {
    const id = queue.shift()!;
    for (const e of g.drawing.elements) {
      if (
        e.archived ||
        !e.passable ||
        !['door', 'stairs'].includes(e.kind) ||
        (e.kind === 'door' && e.state !== 'open') ||
        !e.roomId ||
        !e.targetRoomId
      )
        continue;
      const next = e.roomId === id ? e.targetRoomId : e.targetRoomId === id ? e.roomId : null,
        from = roomById.get(id),
        to = next ? roomById.get(next) : null;
      if (
        !next ||
        !from ||
        !to ||
        e.scopeId !== start.scopeId ||
        (e.kind === 'door' && from.floorId !== to.floorId) ||
        visited.has(next)
      )
        continue;
      visited.add(next);
      came.set(next, { from: id, portalId: e.id });
      queue.push(next);
    }
  }
  if (!visited.has(end.roomId))
    throw new Error(
      'Kein offener begehbarer Tür- oder Treppenweg zum Ziel. Verbinde die Räume und öffne nötige Türen.',
    );
  const links: { from: string; to: string; portalId: string }[] = [];
  let id = end.roomId;
  while (id !== start.roomId) {
    const c = came.get(id)!;
    links.unshift({ ...c, to: id });
    id = c.from;
  }
  const route: DungeonWaypoint[] = [];
  let at = start;
  const append = (room: RoomGeometry, point: Point, portalId?: string) => {
    const z =
      g.floors.find((f) => f.scopeId === room.scopeId && f.id === room.floorId)?.elevation ?? 0;
    const next = {
        ...point,
        scopeId: room.scopeId,
        floorId: room.floorId,
        roomId: room.id,
        z,
        ...(portalId ? { portalId } : {}),
      },
      n = portalId ? 1 : Math.max(1, Math.ceil(distance(at, next) / 1.5));
    for (let i = 1; i <= n; i++)
      route.push({
        ...next,
        x: at.x + ((next.x - at.x) * i) / n,
        y: at.y + ((next.y - at.y) * i) / n,
        z: at.z + ((next.z - at.z) * i) / n,
      });
    at = next;
  };
  for (const link of links) {
    const e = g.drawing.elements.find((e) => e.id === link.portalId)!,
      p = anchored(e, g.rooms),
      center =
        e.kind === 'stairs'
          ? p[0]!
          : {
              x: p.reduce((s, p) => s + p.x, 0) / p.length,
              y: p.reduce((s, p) => s + p.y, 0) / p.length,
            },
      source = roomById.get(link.from)!,
      target = roomById.get(link.to)!,
      entry = centerInRoom(source, center),
      exit = centerInRoom(target, e.kind === 'stairs' && p.length > 1 ? p.at(-1)! : center);
    if (
      e.kind === 'door' &&
      (distance(entry, center) > e.width / 2 + 1 || distance(exit, center) > e.width / 2 + 1)
    )
      throw new Error('Tür verbindet räumlich keine angrenzenden Konturen.');
    for (const p of withinRoom(g, source, at, entry)) append(source, p);
    append(target, exit, e.id);
  }
  const last = roomById.get(end.roomId)!;
  for (const p of withinRoom(g, last, at, end)) append(last, p);
  if (route.length > 5000) throw new Error('Weg zu lang. Wähle ein näher gelegenes Zwischenziel.');
  return route;
}
export function perception(
  g: SpatialGeometry,
  pose: DungeonPose,
  o: PlayerObserver,
  s: PlayerSettings,
  revealed: Set<string>,
): Polygon[] {
  if (!o.enabled) return [];
  if (
    g.drawing.volumes?.some((v) => v.scopeId === pose.scopeId) ||
    (pose.movement && pose.movement !== 'walk')
  ) {
    const eye =
        pose.z +
        (['crawl', 'swim'].includes(pose.movement ?? 'walk')
          ? Math.min(o.eyeHeightMeters, 0.7)
          : o.eyeHeightMeters),
      origin = { ...pose, z: eye },
      rooms = g.rooms.filter(
        (r) =>
          r.scopeId === pose.scopeId &&
          (!g.drawing.styles.find((t) => t.id === r.id)?.secret || revealed.has(r.id)),
      ),
      geometry = rooms.flatMap((r) => {
        const v = g.drawing.volumes?.find((v) => v.roomId === r.id),
          base = floorElevation(g, r);
        return v
          ? volumeProjection(v, (eye - base) / 1.524)
          : eye >= base &&
              eye < base + (g.drawing.styles.find((s) => s.id === r.id)?.ceilingMeters ?? 3.048)
            ? r.polygons
            : [];
      }),
      range = Math.min(o.rangeMeters, 1000),
      fan = (at: DungeonPose, radius: number, kind: 'sight' | 'light' = 'sight') =>
        radius > 0 ? [{ outer: spatialFan(g, at, eye, radius, kind), holes: [] }] : [],
      los = fan(origin, range);
    let lit: Polygon[] = [];
    if (s.light === 'daylight' || s.light === 'dim')
      lit = fan(origin, s.light === 'dim' ? Math.max(range / 2, o.darkvisionMeters) : range);
    else {
      lit = fan(origin, Math.min(range, o.darkvisionMeters));
      let cache = lightCache.get(g);
      if (!cache) {
        cache = new Map();
        lightCache.set(g, cache);
      }
      const key = pose.scopeId + ':' + eye + ':' + rooms.map((r) => r.id).join(','),
        remembered = cache.get(key);
      let lamps = remembered ?? [];
      if (!remembered) {
        for (const e of g.drawing.elements.filter(
          (e) => !e.archived && e.kind === 'light' && e.scopeId === pose.scopeId,
        )) {
          const room =
            rooms.find((r) => r.id === e.roomId) ||
            rooms.find((r) => r.floorId === e.floorId && inside(e.points[0]!, r.polygons));
          if (room)
            lamps = unionPerception(
              lamps,
              fan(
                {
                  ...pose,
                  ...e.points[0]!,
                  roomId: room.id,
                  floorId: room.floorId,
                  z: floorElevation(g, room) + (e.zOffsetMeters ?? 1.5),
                },
                e.width,
                'light',
              ),
            );
        }
        cache.set(key, lamps);
      }
      lit = unionPerception(lit, lamps);
    }
    return clipPolygons(clipPolygons(los, lit), geometry);
  }
  const rooms = g.rooms.filter((r) => r.scopeId === pose.scopeId && r.floorId === pose.floorId),
    allowed = rooms.filter(
      (r) => !g.drawing.styles.find((t) => t.id === r.id)?.secret || revealed.has(r.id),
    ),
    elements = g.drawing.elements.filter(
      (e) => e.scopeId === pose.scopeId && e.floorId === pose.floorId && !e.archived,
    ),
    segments = drawingSegments(
      rooms,
      elements.filter((e) => e.kind !== 'wall' || e.height >= o.eyeHeightMeters),
    );
  const fan = (at: Point, radius: number): Polygon[] =>
      radius <= 0
        ? []
        : [
            {
              outer: visibility(
                {
                  id: 'view',
                  floorId: pose.floorId,
                  kind: 'light',
                  x: at.x,
                  y: at.y,
                  radius: Math.min(radius, 1000),
                  intensity: 1,
                  color: 0,
                  shadows: true,
                },
                segments,
              ),
              holes: [],
            },
          ].filter((p) => p.outer.length >= 3),
    range = Math.min(o.rangeMeters, 1000),
    los = fan(pose, range),
    geometry = allowed.flatMap((r) => r.polygons);
  let lit: Polygon[] = [];
  if (s.light === 'daylight' || s.light === 'dim')
    lit = fan(pose, s.light === 'dim' ? Math.max(range / 2, o.darkvisionMeters) : range);
  else {
    if (o.darkvisionMeters > 0) lit = fan(pose, Math.min(range, o.darkvisionMeters));
    for (const e of elements.filter(
      (e) => e.kind === 'light' && distance(pose, e.points[0]!) < range + e.width,
    )) {
      const p = anchored(e, rooms)[0]!;
      lit = unionPerception(lit, fan(p, e.width));
    }
  }
  return clipPolygons(clipPolygons(los, lit), geometry);
}
export function trapEntry(
  a: DungeonPose,
  b: DungeonPose,
  point: Point,
  radius: number,
  height: number,
): number | null {
  if (a.floorId !== b.floorId) return distance(b, point) < radius ? 1 : null;
  if (Math.abs(a.z - b.z) > height) return null;
  const dx = b.x - a.x,
    dy = b.y - a.y,
    ox = a.x - point.x,
    oy = a.y - point.y,
    c = ox * ox + oy * oy - radius * radius;
  if (c < 0) return 0;
  const aa = dx * dx + dy * dy,
    bb = 2 * (ox * dx + oy * dy),
    disc = bb * bb - 4 * aa * c;
  if (!aa || disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : null;
}
