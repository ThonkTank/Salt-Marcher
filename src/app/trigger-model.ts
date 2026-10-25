import { volumeOrigin } from './atlas/volume-model';
import type { DungeonGeometry, DungeonPose, DungeonWaypoint } from './atlas/dungeon-contracts';
import type { TriggerField, TriggerFragment } from './trigger-contracts';
import { poseOwner, bodyHeight } from './atlas/spatial-3d';
import { annotatePathRoute } from './atlas/path-spatial';
const U = 1.524;
const columnIndex = new WeakMap<
  DungeonGeometry,
  Map<string, Map<string, ReturnType<typeof buildTriggerBoxes>>>
>();
const boxCache = new WeakMap<DungeonGeometry, Map<string, ReturnType<typeof buildTriggerBoxes>>>();
export function triggerVolumeOrigin(g: DungeonGeometry, fragment: TriggerFragment) {
  if (fragment.unbound) return null;
  const volume = g.drawing.volumes?.find(
    (v) => v.id === fragment.volumeId && g.rooms.some((r) => r.id === v.roomId),
  );
  if (!volume?.columns.length) return null;
  return {
    volume,
    ...volumeOrigin(volume),
    base:
      g.floors.find((f) => f.id === volume.floorId && f.scopeId === volume.scopeId)?.elevation ?? 0,
  };
}
function buildTriggerBoxes(g: DungeonGeometry, field: TriggerField) {
  const boxes: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    roomId: string;
  }[] = [];
  for (const fragment of field.fragments) {
    const o = triggerVolumeOrigin(g, fragment);
    if (!o) continue;
    const columns = new Map(o.volume.columns.map((c) => [c.x + ',' + c.y, c]));
    for (const cell of fragment.cells) {
      const x = o.x + cell.x,
        y = o.y + cell.y,
        z = o.z + cell.z,
        column = columns.get(x + ',' + y);
      if (!column?.spans.some((s) => z >= s.z && z < s.z + s.height)) continue;
      boxes.push({
        min: { x: x * U, y: y * U, z: o.base + z * U },
        max: { x: (x + 1) * U, y: (y + 1) * U, z: o.base + (z + 1) * U },
        roomId: o.volume.roomId,
      });
    }
  }
  return boxes;
}
export function triggerBoxes(g: DungeonGeometry, field: TriggerField) {
  let cache = boxCache.get(g);
  if (!cache) {
    cache = new Map();
    boxCache.set(g, cache);
  }
  const key = field.id + ':' + field.revision;
  if (!cache.has(key)) cache.set(key, buildTriggerBoxes(g, field));
  return cache.get(key)!;
}
function indexedBoxes(g: DungeonGeometry, field: TriggerField) {
  let fields = columnIndex.get(g);
  if (!fields) {
    fields = new Map();
    columnIndex.set(g, fields);
  }
  const id = field.id + ':' + field.revision;
  if (!fields.has(id)) {
    const index = new Map<string, ReturnType<typeof buildTriggerBoxes>>();
    for (const box of triggerBoxes(g, field)) {
      const key = Math.floor(box.min.x / U) + ',' + Math.floor(box.min.y / U),
        list = index.get(key) ?? [];
      list.push(box);
      index.set(key, list);
    }
    fields.set(id, index);
  }
  return fields.get(id)!;
}
function routeColumns(a: DungeonPose, b: DungeonPose) {
  let x = Math.floor(a.x / U),
    y = Math.floor(a.y / U);
  const endX = Math.floor(b.x / U),
    endY = Math.floor(b.y / U),
    dx = b.x - a.x,
    dy = b.y - a.y,
    sx = Math.sign(dx),
    sy = Math.sign(dy),
    stepX = dx ? U / Math.abs(dx) : Infinity,
    stepY = dy ? U / Math.abs(dy) : Infinity;
  let tx = dx ? ((sx > 0 ? (x + 1) * U : x * U) - a.x) / dx : Infinity,
    ty = dy ? ((sy > 0 ? (y + 1) * U : y * U) - a.y) / dy : Infinity;
  const result: string[] = [];
  for (let i = 0; i < 10000; i++) {
    result.push(x + ',' + y);
    if (x === endX && y === endY) break;
    if (tx < ty) {
      x += sx;
      tx += stepX;
    } else if (ty < tx) {
      y += sy;
      ty += stepY;
    } else {
      x += sx;
      y += sy;
      tx += stepX;
      ty += stepY;
    }
  }
  return result;
}
function interval(
  a: DungeonPose,
  b: DungeonPose,
  box: ReturnType<typeof triggerBoxes>[number],
  height: number,
) {
  let low = 0,
    high = 1;
  for (const k of ['x', 'y', 'z'] as const) {
    const delta = b[k] - a[k];
    if (Math.abs(delta) < 1e-9) {
      if (a[k] < box.min[k] - (k === 'z' ? height - 0.001 : 0) || a[k] >= box.max[k]) return null;
      continue;
    }
    let from = (box.min[k] - (k === 'z' ? height - 0.001 : 0) - a[k]) / delta,
      to = (box.max[k] - a[k]) / delta;
    if (from > to) [from, to] = [to, from];
    low = Math.max(low, from);
    high = Math.min(high, to);
    if (high < low) return null;
  }
  return high - low > 1e-9 ? { from: low, to: high, roomId: box.roomId } : null;
}
export function triggerIntervals(
  g: DungeonGeometry,
  field: TriggerField,
  a: DungeonPose,
  b: DungeonPose,
) {
  if (field.archived || field.scopeId !== a.scopeId || b.scopeId !== a.scopeId) return [];
  const index = indexedBoxes(g, field),
    ranges = routeColumns(a, b)
      .flatMap((key) => index.get(key) ?? [])
      .map((box) => interval(a, b, box, bodyHeight(b.movement ?? a.movement ?? 'walk')))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .sort((a, b) => a.from - b.from),
    merged: typeof ranges = [];
  for (const r of ranges) {
    const previous = merged.at(-1);
    if (previous && r.from <= previous.to + 1e-7) previous.to = Math.max(previous.to, r.to);
    else merged.push({ ...r });
  }
  return merged;
}
export function enteredTrigger(
  g: DungeonGeometry,
  field: TriggerField,
  a: DungeonPose,
  b: DungeonPose,
) {
  if (triggerIntervals(g, field, a, b).some((r) => r.from > 1e-7)) return true;
  const height = bodyHeight(b.movement ?? a.movement ?? 'walk'),
    index = indexedBoxes(g, field),
    inside = (p: DungeonPose) =>
      (index.get(Math.floor(p.x / U) + ',' + Math.floor(p.y / U)) ?? []).some(
        (box) =>
          p.x >= box.min.x &&
          p.x < box.max.x &&
          p.y >= box.min.y &&
          p.y < box.max.y &&
          p.z >= box.min.z - height + 0.001 &&
          p.z < box.max.z,
      );
  return (
    !field.archived &&
    field.scopeId === a.scopeId &&
    a.scopeId === b.scopeId &&
    !inside(a) &&
    inside(b)
  );
}
export function refineTriggerRoute(
  g: DungeonGeometry,
  start: DungeonPose,
  route: DungeonWaypoint[],
  movement?: import('./atlas/volume-contracts').DungeonMovement,
) {
  if (!g.drawing.triggerFields?.some((f) => !f.archived)) return route;
  const out: DungeonWaypoint[] = [],
    mode = movement ?? start.movement ?? 'walk';
  let from = start;
  for (const next of route) {
    const points: { t: number; roomId: string }[] = [];
    if (!['walk', 'crawl'].includes(mode) || Math.abs(next.z - from.z) < 0.01)
      for (const field of g.drawing.triggerFields ?? [])
        for (const r of triggerIntervals(g, field, from, next)) {
          if (r.from <= 1e-7 || r.from >= 1 - 1e-7) continue;
          const length = Math.hypot(next.x - from.x, next.y - from.y, next.z - from.z),
            t = Math.min(
              r.to - 1e-7,
              r.from + Math.min((r.to - r.from) * 0.05, 0.01 / Math.max(0.01, length)),
            );
          points.push({ t, roomId: r.roomId });
        }
    points.sort((a, b) => a.t - b.t);
    let last = -1;
    for (const cut of points) {
      if (cut.t - last < 1e-6) continue;
      const p = poseOwner(
        g,
        {
          scopeId: from.scopeId,
          x: from.x + (next.x - from.x) * cut.t,
          y: from.y + (next.y - from.y) * cut.t,
          z: from.z + (next.z - from.z) * cut.t,
        },
        mode,
        cut.roomId,
      );
      if (p) {
        out.push(p);
        last = cut.t;
      }
    }
    const clean = { ...next };
    delete clean.additionalSeconds;
    delete clean.passageId;
    delete clean.factor;
    out.push(clean);
    from = next;
  }
  if (out.length > 5000) throw new Error('Triggerweg durch ein näheres Zwischenziel begrenzen.');
  return annotatePathRoute(g, start, out);
}
