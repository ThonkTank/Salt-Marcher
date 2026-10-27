import type { SpatialGeometry } from './dungeon-contracts';
import type { BoundaryFace, PathAnchor } from './path-contracts';
import { VOXEL_METERS as U } from './volume-contracts';
import { volumeOrigin } from './volume-model';
export const directions: Record<BoundaryFace, { x: number; y: number; z: number }> = {
  north: { x: 0, y: -1, z: 0 },
  east: { x: 1, y: 0, z: 0 },
  south: { x: 0, y: 1, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  up: { x: 0, y: 0, z: 1 },
  down: { x: 0, y: 0, z: -1 },
};

export function resolvePathAnchor(g: SpatialGeometry, a: PathAnchor) {
  if (
    a.local &&
    (![a.local.x, a.local.y, a.local.z].every(Number.isSafeInteger) || !directions[a.local.face])
  )
    throw new Error('Anker benötigt ganze Rasterkoordinaten und eine Grenzfläche.');
  const v = g.drawing.volumes?.find((v) => v.roomId === a.roomId);
  if (!v || !a.local || (a.volumeId && a.volumeId !== v.id))
    throw new Error('Pfadanker benötigt ein vorhandenes Volumen.');
  const o = volumeOrigin(v),
    p = { x: o.x + a.local.x, y: o.y + a.local.y, z: o.z + a.local.z },
    column = v.columns.find((c) => c.x === p.x && c.y === p.y),
    span = column?.spans.find((s) => p.z >= s.z && p.z < s.z + s.height),
    d = directions[a.local.face],
    other = v.columns.find((c) => c.x === p.x + d.x && c.y === p.y + d.y);
  if (!span) throw new Error('Gepinnter Anker liegt nicht mehr im Volumen.');
  if (
    (a.local.face === 'up' && p.z !== span.z + span.height - 1) ||
    (a.local.face === 'down' && p.z !== span.z) ||
    (d.z === 0 && other?.spans.some((s) => p.z >= s.z && p.z < s.z + s.height))
  )
    throw new Error('Anker liegt nicht auf einer Volumengrenze.');
  const base = g.floors.find((f) => f.id === v.floorId && f.scopeId === v.scopeId)?.elevation ?? 0,
    world = {
      x: (p.x + 0.5 + d.x * 0.5) * U,
      y: (p.y + 0.5 + d.y * 0.5) * U,
      z: base + (p.z + (d.z > 0 ? 1 : 0)) * U,
    },
    outside = { x: p.x + d.x, y: p.y + d.y, z: p.z + d.z };
  return { volume: v, cell: p, world, outside, base };
}
