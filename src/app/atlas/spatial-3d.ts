import { passageOpening, pathStep, pathLadder, annotatePathRoute } from './path-spatial';
import type { Point, RoomGeometry } from '../shared/contracts';
import type { SpatialGeometry, DungeonPose, DungeonWaypoint } from './dungeon-contracts';
import type { DungeonMovement, DungeonVolume, VolumeSpan } from './volume-contracts';
import { VOXEL_METERS as U } from './volume-contracts';
import { inside, anchored } from './drawing-model';
interface Interior {
  room: RoomGeometry;
  volume: DungeonVolume | null;
  span: VolumeSpan;
  bottom: number;
  top: number;
  columnX: number;
  columnY: number;
  medium: 'air' | 'water';
}
const caches = new WeakMap<
  SpatialGeometry,
  Map<string, Map<string, import('./volume-contracts').VolumeColumn>>
>();
function columns(g: SpatialGeometry, v: DungeonVolume) {
  let cache = caches.get(g);
  if (!cache) {
    cache = new Map();
    caches.set(g, cache);
  }
  if (!cache.has(v.id)) cache.set(v.id, new Map(v.columns.map((c) => [c.x + ',' + c.y, c])));
  return cache.get(v.id)!;
}
export function floorElevation(g: SpatialGeometry, r: RoomGeometry) {
  return g.floors.find((f) => f.id === r.floorId && f.scopeId === r.scopeId)?.elevation ?? 0;
}
function interior(
  g: SpatialGeometry,
  p: { x: number; y: number; z: number; scopeId: string },
  preferred?: string,
): Interior | null {
  const rs = preferred
    ? [...g.rooms.filter((r) => r.id === preferred), ...g.rooms.filter((r) => r.id !== preferred)]
    : g.rooms;
  for (const room of rs) {
    if (room.scopeId !== p.scopeId) continue;
    const base = floorElevation(g, room),
      volume = g.drawing.volumes?.find((v) => v.roomId === room.id) ?? null,
      x = Math.floor(p.x / U),
      y = Math.floor(p.y / U);
    if (volume) {
      const c = columns(g, volume).get(x + ',' + y),
        span = c?.spans.find(
          (s) => p.z >= base + s.z * U - 1e-6 && p.z < base + (s.z + s.height) * U - 1e-6,
        );
      if (span)
        return {
          room,
          volume,
          span,
          bottom: base + span.z * U,
          top: base + (span.z + span.height) * U,
          columnX: x,
          columnY: y,
          medium: span.medium,
        };
    } else {
      const height = g.drawing.styles.find((s) => s.id === room.id)?.ceilingMeters ?? 3.048;
      if (p.z >= base - 1e-6 && p.z < base + height - 1e-6 && inside(p, room.polygons))
        return {
          room,
          volume: null,
          span: { z: 0, height: height / U, floor: true, ceiling: true, medium: 'air' },
          bottom: base,
          top: base + height,
          columnX: x,
          columnY: y,
          medium: 'air',
        };
    }
  }
  return null;
}
function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
function portal(
  g: SpatialGeometry,
  a: Interior,
  b: Interior,
  p: { x: number; y: number; z: number },
  kind: 'move' | 'sight' | 'sound' | 'light',
) {
  if (passageOpening(g, a.room.id, b.room.id, p, kind)) return true;
  return g.drawing.elements.some((e) => {
    if (
      e.archived ||
      !['door', 'stairs'].includes(e.kind) ||
      e.scopeId !== a.room.scopeId ||
      !e.roomId ||
      !e.targetRoomId ||
      ![a.room.id, b.room.id].every((id) => id === e.roomId || id === e.targetRoomId)
    )
      return false;
    if (
      (kind === 'move' && (!e.passable || (e.kind === 'door' && e.state !== 'open'))) ||
      ((kind === 'sight' || kind === 'light') && e.state !== 'open' && e.blocksSight) ||
      (kind === 'sound' && e.state !== 'open' && e.blocksSound)
    )
      return false;
    const points = anchored(e, g.rooms),
      center = {
        x: points.reduce((n, p) => n + p.x, 0) / points.length,
        y: points.reduce((n, p) => n + p.y, 0) / points.length,
      },
      base = g.floors.find((f) => f.id === e.floorId && f.scopeId === e.scopeId)?.elevation ?? 0,
      bottom = base + (e.zOffsetMeters ?? 0),
      top = e.kind === 'stairs' ? Math.max(a.top, b.top) : bottom + (e.verticalMeters ?? e.height);
    return (
      p.z >= bottom - 0.05 &&
      p.z <= top + 0.05 &&
      Math.hypot(p.x - center.x, p.y - center.y) <= Math.max(e.width, U) / 2 + 0.12
    );
  });
}
function face(v: DungeonVolume | null, i: Interior, z: number, side: string) {
  return v?.faces[
    i.columnX + ',' + i.columnY + ',' + Math.floor((z - floorElevationCache(i)) / U) + ',' + side
  ];
}
function floorElevationCache(i: Interior) {
  return i.bottom - i.span.z * U;
}
function boundary(
  g: SpatialGeometry,
  a: Interior,
  b: Interior,
  p: { x: number; y: number; z: number },
  before: { x: number; y: number; z: number },
  kind: 'move' | 'sight' | 'sound' | 'light',
) {
  const crossesFloor =
    (before.z < a.bottom && p.z >= a.bottom) ||
    (before.z >= a.bottom && p.z < a.bottom) ||
    (before.z < a.top && p.z >= a.top) ||
    (before.z >= a.top && p.z < a.top);
  if (a.room.id === b.room.id && a.span === b.span) {
    const side =
        b.columnX > a.columnX
          ? 'east'
          : b.columnX < a.columnX
            ? 'west'
            : b.columnY > a.columnY
              ? 'south'
              : b.columnY < a.columnY
                ? 'north'
                : null,
      opposite =
        side === 'east' ? 'west' : side === 'west' ? 'east' : side === 'south' ? 'north' : 'south';
    return (
      !side ||
      (face(a.volume, a, p.z, side) !== 'solid' && face(b.volume, b, p.z, opposite) !== 'solid')
    );
  }
  if (portal(g, a, b, p, kind)) return true;
  if (crossesFloor) {
    const up = p.z >= before.z;
    return up ? !a.span.ceiling && !b.span.floor : !a.span.floor && !b.span.ceiling;
  }
  if (a.room.id === b.room.id) {
    const side =
      b.columnX > a.columnX
        ? 'east'
        : b.columnX < a.columnX
          ? 'west'
          : b.columnY > a.columnY
            ? 'south'
            : 'north';
    return face(a.volume, a, p.z, side) !== 'solid';
  }
  const side =
    b.columnX > a.columnX
      ? 'east'
      : b.columnX < a.columnX
        ? 'west'
        : b.columnY > a.columnY
          ? 'south'
          : 'north';
  return face(a.volume, a, p.z, side) === 'open';
}
export function spatialObstacle(
  g: SpatialGeometry,
  p: { x: number; y: number; z: number; scopeId: string },
  kind: 'move' | 'sight' | 'sound' | 'light',
) {
  for (const e of g.drawing.elements) {
    if (
      e.archived ||
      e.scopeId !== p.scopeId ||
      !['object', 'wall', 'door'].includes(e.kind) ||
      (kind === 'move' && e.passable && !(e.kind === 'door' && e.state !== 'open')) ||
      ((kind === 'sight' || kind === 'light') && !e.blocksSight) ||
      (kind === 'sound' && !e.blocksSound) ||
      (e.kind === 'door' && e.state === 'open')
    )
      continue;
    const base =
        (g.floors.find((f) => f.id === e.floorId && f.scopeId === e.scopeId)?.elevation ?? 0) +
        (e.zOffsetMeters ?? 0),
      height = e.verticalMeters ?? (e.kind === 'object' ? 1 : e.height);
    if (p.z < base || p.z >= base + height) continue;
    const points = anchored(e, g.rooms);
    if (e.kind === 'object') {
      const at = points[0]!,
        angle = (-e.angle * Math.PI) / 180,
        dx = p.x - at.x,
        dy = p.y - at.y,
        x = dx * Math.cos(angle) - dy * Math.sin(angle),
        y = dx * Math.sin(angle) + dy * Math.cos(angle);
      if (Math.abs(x) < e.width / 2 && Math.abs(y) < e.height / 2) return true;
    } else
      for (let i = 1; i < points.length; i++)
        if (
          segmentDistance(p, points[i - 1]!, points[i]!) <
          Math.max(0.06, e.width / 2) * (e.kind === 'door' ? 0.15 : 1)
        )
          return true;
  }
  return false;
}
function surfaceBarrier(
  g: SpatialGeometry,
  a: DungeonPose,
  b: DungeonPose,
  owner: Interior,
  next: Interior,
  kind: 'move' | 'sight' | 'sound' | 'light',
) {
  if (Math.abs(a.z - b.z) < 1e-9) return false;
  const middle = { ...b, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 },
    low = Math.min(a.z, b.z),
    high = Math.max(a.z, b.z);
  for (const r of g.rooms.filter((r) => r.scopeId === a.scopeId)) {
    const v = g.drawing.volumes?.find((v) => v.roomId === r.id),
      base = floorElevation(g, r),
      spans = v
        ? (columns(g, v).get(Math.floor(middle.x / U) + ',' + Math.floor(middle.y / U))?.spans ??
          [])
        : inside(middle, r.polygons)
          ? [
              {
                z: 0,
                height: (g.drawing.styles.find((s) => s.id === r.id)?.ceilingMeters ?? 3.048) / U,
                floor: true,
                ceiling: true,
                medium: 'air' as const,
              },
            ]
          : [];
    for (const s of spans) {
      const planes = [
        ...(s.floor ? [base + s.z * U] : []),
        ...(s.ceiling ? [base + (s.z + s.height) * U] : []),
      ];
      if (
        planes.some((z) => z > low + 1e-6 && z <= high + 1e-6) &&
        !portal(
          g,
          owner,
          next,
          { ...middle, z: planes.find((z) => z > low + 1e-6 && z <= high + 1e-6)! },
          kind,
        )
      )
        return true;
    }
  }
  return false;
}
export function spatialRay(
  g: SpatialGeometry,
  a: DungeonPose,
  b: DungeonPose,
  kind: 'move' | 'sight' | 'sound' | 'light' = 'sight',
) {
  if (a.scopeId !== b.scopeId) return false;
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / (U / 6)));
  if (n > 2000) return false;
  let previous = a,
    owner = interior(g, a, a.roomId);
  if (!owner || spatialObstacle(g, a, kind)) return false;
  for (let i = 1; i <= n; i++) {
    const p = {
        ...b,
        x: a.x + ((b.x - a.x) * i) / n,
        y: a.y + ((b.y - a.y) * i) / n,
        z: a.z + ((b.z - a.z) * i) / n,
      },
      next = interior(g, p, owner.room.id);
    if (
      !next ||
      spatialObstacle(g, p, kind) ||
      !boundary(g, owner, next, p, previous, kind) ||
      surfaceBarrier(g, previous, p, owner, next, kind)
    )
      return false;
    previous = p;
    owner = next;
  }
  return true;
}
export function bodyHeight(mode: DungeonMovement) {
  return mode === 'crawl' ? 0.8 : mode === 'swim' ? 1 : 1.8;
}
export function poseSpace(
  g: SpatialGeometry,
  p: DungeonPose,
  mode: DungeonMovement = p.movement ?? 'walk',
) {
  const owner = interior(g, { ...p, z: p.z + 0.03 }, p.roomId);
  if (
    !owner ||
    owner.room.id !== p.roomId ||
    owner.room.floorId !== p.floorId ||
    (mode === 'fly' && owner.medium === 'water') ||
    (mode === 'swim' && owner.medium !== 'water')
  )
    return false;
  const head = { ...p, z: p.z + bodyHeight(mode) - 0.04 };
  if (!spatialRay(g, { ...p, z: p.z + 0.03 }, head, 'move')) return false;
  if (
    ['walk', 'crawl'].includes(mode) &&
    (!owner.span.floor || Math.abs(p.z - owner.bottom) > 0.04)
  )
    return false;
  if (
    mode === 'climb' &&
    !(owner.span.floor && Math.abs(p.z - owner.bottom) < 0.04) &&
    !pathLadder(g, p)
  ) {
    const touch = [
      [-U * 0.55, 0],
      [U * 0.55, 0],
      [0, -U * 0.55],
      [0, U * 0.55],
    ].some(([dx, dy]) => !interior(g, { ...p, x: p.x + dx!, y: p.y + dy!, z: p.z + 0.5 }));
    if (!touch) return false;
  }
  return true;
}
export function poseOwner(
  g: SpatialGeometry,
  p: { x: number; y: number; z: number; scopeId: string },
  mode: DungeonMovement,
  preferred?: string,
): DungeonPose | null {
  const owner = interior(g, { ...p, z: p.z + 0.03 }, preferred);
  if (!owner) return null;
  const pose = { ...p, roomId: owner.room.id, floorId: owner.room.floorId, movement: mode };
  return poseSpace(g, pose, mode) ? pose : null;
}
export function planVoxelDungeon(
  g: SpatialGeometry,
  start: DungeonPose,
  end: DungeonPose,
  mode: DungeonMovement,
): DungeonWaypoint[] {
  if (!poseSpace(g, start, mode) || !poseSpace(g, end, mode))
    throw new Error(
      'Start oder Ziel hat für diese Bewegung keine freie Körperhöhe, Standfläche oder passendes Medium.',
    );
  const h = bodyHeight(mode),
    clear = (a: DungeonPose, b: DungeonPose) =>
      (pathStep(g, a, b) ||
        spatialRay(g, { ...a, z: a.z + 0.05 }, { ...b, z: b.z + 0.05 }, 'move')) &&
      spatialRay(g, { ...a, z: a.z + h - 0.05 }, { ...b, z: b.z + h - 0.05 }, 'move');
  if (
    start.roomId === end.roomId &&
    clear(start, end) &&
    (!['walk', 'crawl'].includes(mode) || Math.abs(start.z - end.z) < 0.01)
  )
    return annotatePathRoute(g, start, [{ ...end, movement: mode }]);
  const origin = Math.min(
      ...g.floors.filter((f) => f.scopeId === start.scopeId).map((f) => f.elevation),
    ),
    key = (x: number, y: number, z: number) => x + ',' + y + ',' + z,
    coords = (p: DungeonPose) => ({
      x: Math.floor(p.x / U),
      y: Math.floor(p.y / U),
      z: Math.round((p.z - origin) / U),
    }),
    pose = (c: { x: number; y: number; z: number }) =>
      poseOwner(
        g,
        { x: (c.x + 0.5) * U, y: (c.y + 0.5) * U, z: origin + c.z * U, scopeId: start.scopeId },
        mode,
      ),
    nearest = (p: DungeonPose) => {
      const center = coords(p),
        options: { x: number; y: number; z: number }[] = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const c = { ...center, x: center.x + dx, y: center.y + dy },
            at = pose(c);
          if (at && clear(p, at)) options.push(c);
        }
      options.sort(
        (a, b) =>
          Math.hypot((a.x + 0.5) * U - p.x, (a.y + 0.5) * U - p.y) -
          Math.hypot((b.x + 0.5) * U - p.x, (b.y + 0.5) * U - p.y),
      );
      return options[0];
    },
    first = nearest(start),
    last = nearest(end);
  if (!first || !last) throw new Error('Kein freier Anschluss an das 5-Fuß-Raster.');
  const fk = key(first.x, first.y, first.z),
    lk = key(last.x, last.y, last.z),
    nodes = new Map<string, typeof first>([[fk, first]]),
    score = new Map<string, number>([[fk, 0]]),
    parent = new Map<string, string>(),
    open = [fk],
    closed = new Set<string>(),
    heuristic = (k: string) => {
      const c = nodes.get(k)!;
      return Math.hypot(c.x - last.x, c.y - last.y, c.z - last.z);
    };
  let found = false;
  while (open.length && closed.size < 20000) {
    let best = 0;
    for (let i = 1; i < open.length; i++)
      if (
        score.get(open[i]!)! + heuristic(open[i]!) <
        score.get(open[best]!)! + heuristic(open[best]!)
      )
        best = i;
    const k = open.splice(best, 1)[0]!,
      c = nodes.get(k)!,
      at = pose(c)!;
    if (k === lk) {
      found = true;
      break;
    }
    closed.add(k);
    const neighbors = [
      { ...c, x: c.x + 1 },
      { ...c, x: c.x - 1 },
      { ...c, y: c.y + 1 },
      { ...c, y: c.y - 1 },
      ...(['fly', 'swim', 'climb'].includes(mode)
        ? [
            { ...c, z: c.z + 1 },
            { ...c, z: c.z - 1 },
          ]
        : []),
    ];
    if (
      ['walk', 'crawl'].includes(mode) &&
      g.drawing.paths?.some(
        (p) =>
          p.roomId === at.roomId &&
          p.segments.some((s) => s.form === 'stairs' || s.form === 'ramp'),
      )
    )
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        for (const dz of [-1, 1]) neighbors.push({ x: c.x + dx!, y: c.y + dy!, z: c.z + dz });
    for (const e of g.drawing.elements.filter(
      (e) =>
        !e.archived &&
        e.kind === 'stairs' &&
        e.passable &&
        (e.roomId === at.roomId || e.targetRoomId === at.roomId),
    )) {
      const other = g.rooms.find(
          (r) => r.id === (e.roomId === at.roomId ? e.targetRoomId : e.roomId),
        ),
        p = e.points[e.roomId === at.roomId ? e.points.length - 1 : 0]!;
      if (other && Math.hypot(at.x - e.points[0]!.x, at.y - e.points[0]!.y) < U * 1.5)
        neighbors.push({
          x: Math.floor(p.x / U),
          y: Math.floor(p.y / U),
          z: Math.round((floorElevation(g, other) - origin) / U),
        });
    }
    for (const n of neighbors) {
      const nk = key(n.x, n.y, n.z);
      if (closed.has(nk)) continue;
      const next = pose(n);
      if (!next || !clear(at, next)) continue;
      const cost = score.get(k)! + Math.hypot(n.x - c.x, n.y - c.y, n.z - c.z);
      if (cost < (score.get(nk) ?? Infinity)) {
        nodes.set(nk, n);
        score.set(nk, cost);
        parent.set(nk, k);
        if (!open.includes(nk)) open.push(nk);
      }
    }
  }
  if (!found)
    throw new Error(
      'Kein begehbarer 3D-Weg zum Ziel. Körperhöhe, Hindernisse, Flächen und Medium prüfen.',
    );
  const path: DungeonWaypoint[] = [{ ...end, movement: mode }];
  let k = lk;
  while (k !== fk) {
    path.unshift(pose(nodes.get(k)!)!);
    k = parent.get(k)!;
  }
  path.unshift(pose(first)!);
  return annotatePathRoute(g, start, path);
}
export function seen3D(
  g: SpatialGeometry,
  from: DungeonPose,
  to: DungeonPose,
  range: number,
  darkvision: number,
  light: 'auto' | 'daylight' | 'dim' | 'darkness',
  eyeHeight = 1.7,
) {
  const eye = ['crawl', 'swim'].includes(from.movement ?? 'walk')
      ? Math.min(0.7, eyeHeight)
      : eyeHeight,
    a = { ...from, z: from.z + eye },
    b = { ...to, z: to.z + Math.min(eyeHeight, 1.2) },
    distance = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  if (distance > range || !spatialRay(g, a, b)) return false;
  if (light === 'daylight' || (light === 'dim' && distance <= range / 2) || distance <= darkvision)
    return true;
  return g.drawing.elements
    .filter((e) => !e.archived && e.kind === 'light' && e.scopeId === from.scopeId)
    .some((e) => {
      const room =
        g.rooms.find((r) => r.id === e.roomId) ||
        g.rooms.find((r) => r.floorId === e.floorId && inside(e.points[0]!, r.polygons));
      if (!room) return false;
      const lamp = {
        ...e.points[0]!,
        z: floorElevation(g, room) + (e.zOffsetMeters ?? 1.5),
        scopeId: room.scopeId,
        floorId: room.floorId,
        roomId: room.id,
      };
      return (
        Math.hypot(lamp.x - b.x, lamp.y - b.y, lamp.z - b.z) <= e.width &&
        spatialRay(g, lamp, b, 'light')
      );
    });
}

export function spatialFan(
  g: SpatialGeometry,
  source: DungeonPose,
  targetZ: number,
  radius: number,
  kind: 'sight' | 'light' = 'sight',
) {
  const angles = Array.from({ length: 96 }, (_, i) => (i * Math.PI) / 48),
    points: Point[] = [];
  for (const angle of angles) {
    let low = 0,
      high = Math.min(radius, 1000);
    for (let step = 0; step < 14; step++) {
      const distance = (low + high) / 2,
        target = {
          ...source,
          x: source.x + Math.cos(angle) * distance,
          y: source.y + Math.sin(angle) * distance,
          z: targetZ,
        };
      if (spatialRay(g, source, target, kind)) low = distance;
      else high = distance;
    }
    points.push({ x: source.x + Math.cos(angle) * low, y: source.y + Math.sin(angle) * low });
  }
  return points;
}
