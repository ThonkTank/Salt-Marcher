import type { Polygon, RoomGeometry } from '../contracts';
import { inside, combineRooms } from './drawing-model';
import type { DungeonVolume, VolumeColumn, VolumeAction, VolumeSpan } from './volume-contracts';
import { VOXEL_METERS as U, MAX_VOLUME_COLUMNS, MAX_VOLUME_CELLS } from './volume-contracts';
export function volumeOrigin(v: DungeonVolume) {
  let x = Infinity,
    y = Infinity,
    z = Infinity;
  for (const column of v.columns) {
    x = Math.min(x, column.x);
    y = Math.min(y, column.y);
    for (const span of column.spans) z = Math.min(z, span.z);
  }
  return { x, y, z };
}
export const cellKey = (x: number, y: number) => x + ',' + y;
export function volumeFromRoom(room: RoomGeometry, heightSteps = 2, id = room.id): DungeonVolume {
  const points = room.polygons.flatMap((p) => p.outer),
    minX = Math.floor(Math.min(...points.map((p) => p.x)) / U),
    maxX = Math.ceil(Math.max(...points.map((p) => p.x)) / U),
    minY = Math.floor(Math.min(...points.map((p) => p.y)) / U),
    maxY = Math.ceil(Math.max(...points.map((p) => p.y)) / U);
  if ((maxX - minX) * (maxY - minY) > MAX_VOLUME_COLUMNS)
    throw new Error('Kontur für diesen Volumenzug verkleinern.');
  const columns: VolumeColumn[] = [];
  for (let y = minY; y < maxY; y++)
    for (let x = minX; x < maxX; x++)
      if (inside({ x: (x + 0.5) * U, y: (y + 0.5) * U }, room.polygons))
        columns.push({
          x,
          y,
          spans: [{ z: 0, height: heightSteps, floor: true, ceiling: true, medium: 'air' }],
        });
  if (!columns.length) throw new Error('Kontur enthält keine 5-Fuß-Zelle.');
  return {
    id,
    revision: 0,
    roomId: room.id,
    scopeId: room.scopeId,
    floorId: room.floorId,
    columns,
    faces: {},
  };
}
function normalize(spans: VolumeSpan[], overlay?: VolumeSpan) {
  let result: VolumeSpan[] = [];
  if (overlay) {
    const end = overlay.z + overlay.height;
    for (const old of spans) {
      const oldEnd = old.z + old.height;
      if (oldEnd <= overlay.z || old.z >= end) {
        result.push({ ...old });
        continue;
      }
      if (old.z < overlay.z) result.push({ ...old, height: overlay.z - old.z, ceiling: false });
      if (oldEnd > end) result.push({ ...old, z: end, height: oldEnd - end, floor: false });
    }
    result.push({ ...overlay });
  } else result = spans.map((span) => ({ ...span }));
  result.sort((a, b) => a.z - b.z);
  const merged: VolumeSpan[] = [];
  for (const span of result) {
    const previous = merged.at(-1);
    if (
      previous &&
      previous.z + previous.height === span.z &&
      !previous.ceiling &&
      !span.floor &&
      previous.medium === span.medium
    ) {
      previous.height += span.height;
      previous.ceiling = span.ceiling;
    } else merged.push({ ...span });
  }
  return merged;
}
export function editVolume(
  before: DungeonVolume,
  a: Extract<VolumeAction, { kind: 'volume-edit' }>,
): DungeonVolume {
  const v = structuredClone(before),
    columns = new Map(v.columns.map((c) => [cellKey(c.x, c.y), c]));
  for (const p of a.cells) {
    if (![p.x, p.y, p.z].every((n) => Number.isSafeInteger(n) && Math.abs(n) <= 1000000))
      throw new Error('Volumenzelle ungültig.');
    const key = cellKey(p.x, p.y),
      column = columns.get(key) ?? { x: p.x, y: p.y, spans: [] };
    if (a.operation === 'wall') {
      v.faces[p.x + ',' + p.y + ',' + p.z + ',' + a.side] = a.enabled ? 'solid' : 'open';
      continue;
    }
    if (a.operation === 'fill') {
      column.spans = normalize(column.spans, {
        z: p.z,
        height: 2,
        floor: true,
        ceiling: true,
        medium: a.medium,
      });
      columns.set(key, column);
    } else if (a.operation === 'erase') {
      column.spans = normalize(
        column.spans.flatMap((s) => {
          if (p.z < s.z || p.z >= s.z + s.height) return [s];
          return [
            ...(p.z > s.z ? [{ ...s, height: p.z - s.z, ceiling: true }] : []),
            ...(p.z + 1 < s.z + s.height
              ? [{ ...s, z: p.z + 1, height: s.z + s.height - p.z - 1, floor: true }]
              : []),
          ];
        }),
      );
      if (column.spans.length) columns.set(key, column);
      else columns.delete(key);
    } else {
      const split: VolumeSpan[] = [];
      for (const s of column.spans) {
        if (a.operation === 'floor' && p.z >= s.z && p.z < s.z + s.height) {
          if (p.z === s.z) split.push({ ...s, floor: a.enabled });
          else
            split.push(
              { ...s, height: p.z - s.z, ceiling: false },
              { ...s, z: p.z, height: s.z + s.height - p.z, floor: a.enabled },
            );
        } else if (a.operation === 'ceiling' && p.z >= s.z && p.z < s.z + s.height) {
          if (p.z === s.z + s.height - 1) split.push({ ...s, ceiling: a.enabled });
          else
            split.push(
              { ...s, height: p.z - s.z + 1, ceiling: a.enabled },
              { ...s, z: p.z + 1, height: s.z + s.height - p.z - 1, floor: false },
            );
        } else split.push(s);
      }
      column.spans = split;
    }
  }
  v.columns = [...columns.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  if (
    v.columns.length > MAX_VOLUME_COLUMNS ||
    v.columns.reduce((n, c) => n + c.spans.reduce((n, s) => n + s.height, 0), 0) > MAX_VOLUME_CELLS
  )
    throw new Error('Volumen für diesen Zug verkleinern.');
  return v;
}
export function volumeProjection(v: DungeonVolume, z?: number): Polygon[] {
  const rows = new Map<number, number[]>();
  for (const c of v.columns.filter(
    (c) => z === undefined || c.spans.some((s) => z >= s.z && z < s.z + s.height),
  )) {
    const row = rows.get(c.y) ?? [];
    row.push(c.x);
    rows.set(c.y, row);
  }
  const rectangles: Polygon[][] = [];
  for (const [y, xs] of rows) {
    xs.sort((a, b) => a - b);
    let first = xs[0],
      last = first;
    const add = () => {
      if (first === undefined || last === undefined) return;
      rectangles.push([
        {
          outer: [
            { x: first * U, y: y * U },
            { x: (last + 1) * U, y: y * U },
            { x: (last + 1) * U, y: (y + 1) * U },
            { x: first * U, y: (y + 1) * U },
          ],
          holes: [],
        },
      ]);
    };
    for (const x of xs.slice(1)) {
      if (x === last! + 1) last = x;
      else {
        add();
        first = x;
        last = x;
      }
    }
    add();
  }
  let result: Polygon[] = [];
  for (let i = 0; i < rectangles.length; i += 128)
    result = combineRooms([result, ...rectangles.slice(i, i + 128)]);
  return result;
}
export function volumeComponents(v: DungeonVolume) {
  const nodes = v.columns.flatMap((c) =>
      c.spans.map((s, index) => ({ c, s, index, key: c.x + ',' + c.y + ',' + index })),
    ),
    byColumn = new Map<string, typeof nodes>();
  for (const n of nodes) {
    const k = cellKey(n.c.x, n.c.y),
      list = byColumn.get(k) ?? [];
    list.push(n);
    byColumn.set(k, list);
  }
  const seen = new Set<string>(),
    parts: VolumeColumn[][] = [];
  for (const node of nodes) {
    if (seen.has(node.key)) continue;
    const queue = [node],
      part = new Map<string, VolumeColumn>();
    seen.add(node.key);
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i]!,
        key = cellKey(n.c.x, n.c.y),
        column = part.get(key) ?? { x: n.c.x, y: n.c.y, spans: [] };
      column.spans.push(n.s);
      part.set(key, column);
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        for (const next of byColumn.get(cellKey(n.c.x + dx!, n.c.y + dy!)) ?? []) {
          if (seen.has(next.key)) continue;
          const same = dx === 0 && dy === 0,
            connected = same
              ? (n.s.z + n.s.height === next.s.z && !n.s.ceiling && !next.s.floor) ||
                (next.s.z + next.s.height === n.s.z && !next.s.ceiling && !n.s.floor)
              : Math.max(n.s.z, next.s.z) < Math.min(n.s.z + n.s.height, next.s.z + next.s.height);
          if (connected) {
            seen.add(next.key);
            queue.push(next);
          }
        }
    }
    parts.push([...part.values()]);
  }
  return parts.sort(
    (a, b) =>
      b.reduce((n, c) => n + c.spans.reduce((n, s) => n + s.height, 0), 0) -
      a.reduce((n, c) => n + c.spans.reduce((n, s) => n + s.height, 0), 0),
  );
}
export function isometricVolume(v: DungeonVolume, base = 0, limit = 1200) {
  const polygons: { points: string; fill: string }[] = [];
  let count = 0;
  const project = (x: number, y: number, z: number) => ({
    x: (x - y) * 0.866,
    y: (x + y) * 0.5 - z,
  });
  for (const c of v.columns.slice().sort((a, b) => a.x + a.y - b.x - b.y))
    for (const s of c.spans) {
      if (count++ >= limit) break;
      const z = base / U + s.z,
        top = z + s.height,
        corners = [
          [c.x, c.y, top],
          [c.x + 1, c.y, top],
          [c.x + 1, c.y + 1, top],
          [c.x, c.y + 1, top],
        ],
        left = [
          [c.x, c.y + 1, z],
          [c.x, c.y + 1, top],
          [c.x + 1, c.y + 1, top],
          [c.x + 1, c.y + 1, z],
        ],
        right = [
          [c.x + 1, c.y, z],
          [c.x + 1, c.y, top],
          [c.x + 1, c.y + 1, top],
          [c.x + 1, c.y + 1, z],
        ];
      for (const [points, fill] of [
        [left, s.medium === 'water' ? '#386b91' : '#657c82'],
        [right, s.medium === 'water' ? '#527eab' : '#8aa0a2'],
        [corners, s.medium === 'water' ? '#83badd' : '#bdcfbd'],
      ] as const)
        polygons.push({
          points: points
            .map(([x, y, z]) => {
              const p = project(x!, y!, z!);
              return p.x + ',' + p.y;
            })
            .join(' '),
          fill,
        });
    }
  return polygons;
}
