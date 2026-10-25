import { volumeOrigin } from '../atlas/volume-model';
import { createHash, randomUUID } from 'node:crypto';
import type { KeyContent } from '../campaign/key-contracts';
import type { DungeonVolume } from '../atlas/volume-contracts';
import {
  isSurfaceFace,
  connectedSurface,
  surfaceFaceKey,
  type SurfaceFace,
} from '../atlas/surface-model';
import { readDungeonKeys } from './dungeon-key';
const keyRow = (cam: string, c: KeyContent) => {
  const payload = JSON.stringify(c);
  return {
    campaign_id: cam,
    id: c.id,
    scope_id: c.scopeId,
    kind: c.kind,
    revision: c.revision,
    payload,
    checksum: createHash('sha256').update(payload).digest('hex'),
  };
};
export function validateSurfaceGeometry(db: any, cam: string, c: KeyContent) {
  if (c.kind !== 'surface') return;
  const room = db
    .prepare('SELECT scope_id FROM room WHERE campaign_id=? AND id=?')
    .get(cam, c.surface!.roomId);
  if (!room || room.scope_id !== c.scopeId)
    throw new Error('Oberflächenbereich benötigt einen Raum derselben Zeichnung.');
  for (const f of c.surface!.fragments) {
    if (f.unbound) continue;
    const row = db
        .prepare('SELECT payload FROM dungeon_volume WHERE campaign_id=? AND id=?')
        .get(cam, f.volumeId),
      v = row ? (JSON.parse(row.payload) as DungeonVolume) : null;
    if (!v || v.scopeId !== c.scopeId || !v.columns.length)
      throw new Error('Oberflächenfragment zuerst einem Volumen zuordnen.');
    const o = volumeOrigin(v),
      faces = f.faces.map((p) => ({ ...p, x: p.x + o.x, y: p.y + o.y, z: p.z + o.z }));
    if (
      faces.length &&
      (!connectedSurface(faces) ||
        new Set(faces.map(surfaceFaceKey)).size !== faces.length ||
        faces.some((p) => !isSurfaceFace(v, p)))
    )
      throw new Error('Eine zusammenhängende Wand-, Boden- oder Deckenfläche markieren.');
  }
}
export function captureSurfaces(db: any, cam: string, volumes: DungeonVolume[]) {
  const selected = new Map(volumes.filter((v) => v.columns.length).map((v) => [v.id, v]));
  return readDungeonKeys(db, cam)
    .filter(
      (c) =>
        c.kind === 'surface' &&
        c.surface!.fragments.some((f) => !f.unbound && selected.has(f.volumeId)),
    )
    .map((content) => ({
      content,
      parts: content
        .surface!.fragments.filter((f) => !f.unbound && selected.has(f.volumeId))
        .map((fragment) => {
          const v = selected.get(fragment.volumeId)!,
            o = volumeOrigin(v);
          return {
            fragment,
            floorId: v.floorId,
            faces: fragment.faces.map((f) => ({ ...f, x: f.x + o.x, y: f.y + o.y, z: f.z + o.z })),
          };
        }),
    }));
}
export function transformSurfaces(
  captured: ReturnType<typeof captureSurfaces>,
  t: { dx: number; dy: number; angle: number; origin: { x: number; y: number } },
) {
  const sides = ['east', 'south', 'west', 'north'] as const,
    turn = ((Math.round(t.angle / (Math.PI / 2)) % 4) + 4) % 4;
  for (const record of captured)
    for (const part of record.parts)
      part.faces = part.faces.map((f) => {
        const dx = (f.x + 0.5) * 1.524 - t.origin.x,
          dy = (f.y + 0.5) * 1.524 - t.origin.y;
        return {
          ...f,
          x: Math.floor(
            (t.origin.x + t.dx + dx * Math.cos(t.angle) - dy * Math.sin(t.angle)) / 1.524,
          ),
          y: Math.floor(
            (t.origin.y + t.dy + dx * Math.sin(t.angle) + dy * Math.cos(t.angle)) / 1.524,
          ),
          side:
            f.side === 'floor' || f.side === 'ceiling'
              ? f.side
              : sides[(sides.indexOf(f.side) + turn) % 4]!,
        };
      });
}
export function rebindSurfaces(
  cam: string,
  captured: ReturnType<typeof captureSurfaces>,
  volumes: DungeonVolume[],
  apply: (key: { table: string; id: string }, row: any) => void,
) {
  const origins = new Map<DungeonVolume, ReturnType<typeof volumeOrigin>>();
  const origin = (v: DungeonVolume) => {
    let value = origins.get(v);
    if (!value) {
      value = volumeOrigin(v);
      origins.set(v, value);
    }
    return value;
  };
  for (const record of captured) {
    const c = structuredClone(record.content),
      surface = c.surface!;
    surface.fragments = surface.fragments.filter(
      (f) => !record.parts.some((p) => p.fragment.id === f.id),
    );
    for (const part of record.parts) {
      const groups = new Map<string, SurfaceFace[]>(),
        lost: SurfaceFace[] = [];
      for (const face of part.faces) {
        const candidates = volumes.filter(
          (v) => v.scopeId === c.scopeId && v.floorId === part.floorId && isSurfaceFace(v, face),
        );
        if (candidates.length !== 1) {
          lost.push(face);
          continue;
        }
        const v = candidates[0]!,
          o = origin(v),
          list = groups.get(v.id) ?? [];
        list.push({ ...face, x: face.x - o.x, y: face.y - o.y, z: face.z - o.z });
        groups.set(v.id, list);
      }
      let keep = true;
      for (const [volumeId, faces] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
        surface.fragments.push({ id: keep ? part.fragment.id : randomUUID(), volumeId, faces });
        keep = false;
      }
      if (lost.length)
        surface.fragments.push({
          ...part.fragment,
          id: keep ? part.fragment.id : randomUUID(),
          faces: [],
          unbound: true,
          orphanedWorld: { floorId: part.floorId, faces: lost },
        });
    }
    const best = surface.fragments
        .filter((f) => !f.unbound)
        .sort((a, b) => b.faces.length - a.faces.length)[0],
      v = volumes.find((v) => v.id === best?.volumeId);
    if (v) surface.roomId = v.roomId;
    apply({ table: 'dungeon_key_content', id: c.id }, keyRow(cam, c));
  }
}
