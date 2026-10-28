import { connectedSurface, isSurfaceFace, surfaceFaceKey } from '../atlas/surface-model';
import type { DungeonVolume } from '../atlas/volume-contracts';
import { volumeOrigin } from '../atlas/volume-model';
import type { KeyContent } from '../campaign/key-contracts';
import { checkedQuery, type SqliteDatabase } from './sqlite-connection';

export function validateSurfaceGeometry(db: SqliteDatabase, cam: string, c: KeyContent) {
  if (c.kind !== 'surface') return;
  const room = checkedQuery(db, 'SELECT scope_id FROM room WHERE campaign_id=? AND id=?', {
    scope_id: 'text',
  }).get(cam, c.surface!.roomId);
  if (!room || room.scope_id !== c.scopeId)
    throw new Error('Oberflächenbereich benötigt einen Raum derselben Zeichnung.');
  for (const f of c.surface!.fragments) {
    if (f.unbound) continue;
    const row = checkedQuery(
        db,
        'SELECT payload FROM dungeon_volume WHERE campaign_id=? AND id=?',
        { payload: 'text' },
      ).get(cam, f.volumeId),
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
