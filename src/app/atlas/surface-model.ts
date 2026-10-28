import { type SurfaceFace } from './surface-contracts';
import { volumeOrigin } from './volume-model';
import type { DungeonVolume } from './volume-contracts';
import type { SpatialGeometry } from './dungeon-geometry-contracts';
import type { DungeonPose } from './dungeon-position-contracts';
import type { KeyContent } from '../campaign/key-contracts';
export const surfaceFaceKey = (f: SurfaceFace) => [f.x, f.y, f.z, f.side].join(',');
const indexes = new WeakMap<DungeonVolume, Map<string, DungeonVolume['columns'][number]>>();
export function isSurfaceFace(v: DungeonVolume, f: SurfaceFace) {
  let index = indexes.get(v);
  if (!index) {
    index = new Map(v.columns.map((c) => [c.x + ',' + c.y, c]));
    indexes.set(v, index);
  }
  const s = index.get(f.x + ',' + f.y)?.spans.find((s) => f.z >= s.z && f.z < s.z + s.height);
  if (!s) return false;
  if (f.side === 'floor') return s.floor && f.z === s.z;
  if (f.side === 'ceiling') return s.ceiling && f.z === s.z + s.height - 1;
  const explicit = v.faces[[f.x, f.y, f.z, f.side].join(',')];
  if (explicit) return explicit === 'solid';
  const [dx, dy] = ({ north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] } as const)[
    f.side
  ];
  return !index
    .get(f.x + dx + ',' + (f.y + dy))
    ?.spans.some((s) => f.z >= s.z && f.z < s.z + s.height);
}
export function surfaceVertices(f: SurfaceFace) {
  const { x, y, z } = f;
  if (f.side === 'floor' || f.side === 'ceiling') {
    const h = z + Number(f.side === 'ceiling');
    return [
      [x, y, h],
      [x + 1, y, h],
      [x + 1, y + 1, h],
      [x, y + 1, h],
    ];
  }
  if (f.side === 'north' || f.side === 'south') {
    const h = y + Number(f.side === 'south');
    return [
      [x, h, z],
      [x + 1, h, z],
      [x + 1, h, z + 1],
      [x, h, z + 1],
    ];
  }
  const h = x + Number(f.side === 'east');
  return [
    [h, y, z],
    [h, y + 1, z],
    [h, y + 1, z + 1],
    [h, y, z + 1],
  ];
}
export function connectedSurface(faces: SurfaceFace[]) {
  if (!faces.length) return false;
  const edges = new Map<string, number[]>(),
    neighbors = faces.map(() => new Set<number>());
  faces.forEach((f, i) => {
    const v = surfaceVertices(f).map((p) => p.join(','));
    for (let n = 0; n < 4; n++) {
      const key = [v[n], v[(n + 1) % 4]].sort().join('|'),
        others = edges.get(key) ?? [];
      for (const j of others) {
        neighbors[i]!.add(j);
        neighbors[j]!.add(i);
      }
      others.push(i);
      edges.set(key, others);
    }
  });
  const seen = new Set([0]),
    queue = [0];
  for (let i = 0; i < queue.length; i++)
    for (const j of neighbors[queue[i]!]!)
      if (!seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
  return seen.size === faces.length;
}
export function surfaceWorldFaces(content: KeyContent, g: SpatialGeometry) {
  const result: { face: SurfaceFace; volume: DungeonVolume; pose: DungeonPose }[] = [];
  for (const fragment of content.surface?.fragments ?? []) {
    if (fragment.unbound) continue;
    const v = g.drawing.volumes?.find((v) => v.id === fragment.volumeId);
    if (!v?.columns.length) continue;
    const o = volumeOrigin(v),
      base = g.floors.find((f) => f.id === v.floorId && f.scopeId === v.scopeId)?.elevation ?? 0;
    for (const local of fragment.faces) {
      const face = { ...local, x: local.x + o.x, y: local.y + o.y, z: local.z + o.z };
      if (!isSurfaceFace(v, face)) continue;
      const p = {
          x: (face.x + 0.5) * 1.524,
          y: (face.y + 0.5) * 1.524,
          z: base + (face.z + 0.5) * 1.524,
        },
        near = 0.001;
      if (face.side === 'floor') p.z = base + face.z * 1.524 + near;
      if (face.side === 'ceiling') p.z = base + (face.z + 1) * 1.524 - near;
      if (face.side === 'north') p.y = face.y * 1.524 + near;
      if (face.side === 'south') p.y = (face.y + 1) * 1.524 - near;
      if (face.side === 'west') p.x = face.x * 1.524 + near;
      if (face.side === 'east') p.x = (face.x + 1) * 1.524 - near;
      result.push({
        face,
        volume: v,
        pose: { scopeId: v.scopeId, floorId: v.floorId, roomId: v.roomId, ...p },
      });
    }
  }
  return result;
}
