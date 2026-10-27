import type { DungeonPose, DungeonWaypoint, SpatialGeometry } from './dungeon-contracts';
import { resolvePathAnchor } from './path-anchor';
import type { DungeonPassage } from './path-contracts';
import { VOXEL_METERS as U } from './volume-contracts';
export function passageOpening(
  g: SpatialGeometry,
  fromRoomId: string,
  toRoomId: string,
  p: { x: number; y: number; z: number },
  kind: 'move' | 'sight' | 'sound' | 'light',
) {
  return (
    (g.drawing.passages ?? []).find((passage) => {
      if (
        !passage.assigned ||
        !passage.otherRoomId ||
        !(
          (passage.roomId === fromRoomId && passage.otherRoomId === toRoomId) ||
          (passage.roomId === toRoomId && passage.otherRoomId === fromRoomId)
        )
      )
        return false;
      const side = fromRoomId === passage.roomId ? passage.outbound : passage.inbound;
      if (
        side.target.kind !== 'geometry' ||
        side.target.id !== toRoomId ||
        (kind === 'move' && !side.passable) ||
        (kind === 'sight' && !side.sight) ||
        (kind === 'light' && !side.light) ||
        (kind === 'sound' && !side.sound)
      )
        return false;
      try {
        const a = resolvePathAnchor(g, passage.anchor),
          face = passage.anchor.local!.face,
          w = passage.widthSteps * U,
          h = passage.heightSteps * U;
        if (face === 'up' || face === 'down')
          return (
            Math.abs(p.z - a.world.z) < U / 3 &&
            Math.abs(p.x - a.world.x) <= w / 2 + 0.1 &&
            Math.abs(p.y - a.world.y) <= w / 2 + 0.1
          );
        return (
          p.z >= a.world.z - 0.05 &&
          p.z <= a.world.z + h + 0.05 &&
          (face === 'east' || face === 'west'
            ? Math.abs(p.x - a.world.x) < U / 3 && Math.abs(p.y - a.world.y) <= w / 2 + 0.1
            : Math.abs(p.y - a.world.y) < U / 3 && Math.abs(p.x - a.world.x) <= w / 2 + 0.1)
        );
      } catch {
        return false;
      }
    }) ?? null
  );
}
export function pathStep(g: SpatialGeometry, a: DungeonPose, b: DungeonPose) {
  if (
    a.roomId !== b.roomId ||
    Math.abs(b.z - a.z) > U + 0.05 ||
    Math.hypot(b.x - a.x, b.y - a.y) > U + 0.05 ||
    Math.abs(b.z - a.z) < 0.05
  )
    return false;
  const path = g.drawing.paths?.find((p) => p.roomId === a.roomId);
  return !!path && path.segments.some((s) => s.form === 'stairs' || s.form === 'ramp');
}
export function pathLadder(g: SpatialGeometry, p: DungeonPose) {
  return (g.drawing.paths ?? []).some(
    (path) =>
      path.segments.some((s) => s.form === 'ladder') &&
      [path.from, path.to].some((anchor) => {
        try {
          const a = resolvePathAnchor(g, anchor),
            minimum =
              a.base + Math.min(...a.volume.columns.flatMap((c) => c.spans.map((s) => s.z))) * U;
          return (
            Math.hypot(p.x - a.world.x, p.y - a.world.y) < U * 0.8 &&
            p.z >= minimum - 0.05 &&
            p.z <= Math.max(...path.route.map((r) => a.base + r.z * U)) + U
          );
        } catch {
          return false;
        }
      }),
  );
}
export function annotatePathRoute(
  g: SpatialGeometry,
  start: DungeonPose,
  route: DungeonWaypoint[],
) {
  let before = start;
  for (const node of route) {
    if (node.roomId !== before.roomId) {
      const p = passageOpening(
        g,
        before.roomId,
        node.roomId,
        {
          x: (before.x + node.x) / 2,
          y: (before.y + node.y) / 2,
          z: Math.min(before.z, node.z) + 0.1,
        },
        'move',
      );
      if (p) {
        node.passageId = p.id;
        node.additionalSeconds = (
          before.roomId === p.roomId ? p.outbound : p.inbound
        ).additionalSeconds;
      }
    }
    const path = g.drawing.paths?.find((p) => p.roomId === node.roomId);
    if (path) {
      const base =
          g.floors.find((f) => f.id === node.floorId && f.scopeId === node.scopeId)?.elevation ?? 0,
        r = path.route.find(
          (r) =>
            r.x === Math.floor(node.x / U) &&
            r.y === Math.floor(node.y / U) &&
            Math.abs(base + r.z * U - node.z) < 0.05,
        );
      node.factor = r?.factor ?? 1;
    }
    before = node;
  }
  return route;
}
export function passageLanding(g: SpatialGeometry, p: DungeonPassage) {
  const a = resolvePathAnchor(g, p.anchor);
  return {
    x: (a.cell.x + 0.5) * U,
    y: (a.cell.y + 0.5) * U,
    z: a.base + a.cell.z * U,
    roomId: p.roomId,
    floorId: a.volume.floorId,
    scopeId: p.scopeId,
  };
}
