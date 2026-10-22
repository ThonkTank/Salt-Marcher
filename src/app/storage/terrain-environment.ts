import {createHash} from 'node:crypto';

const kind = 'terrain-environment';
const hash = (payload: string) => createHash('sha256').update(payload).digest('hex');

/** A small durable travel guard, independent of the potentially huge map.cells.
 * Absent in older snapshots until their first terrain edit. Never restored by
 * Atlas history: undo/redo also advance it, so old travel previews stay stale. */
export function terrainEnvironmentRevision(db: any, campaignId: string, mapId: string): number | null {
  const row = db.prepare('SELECT revision,payload,checksum FROM world_record WHERE campaign_id=? AND kind=? AND id=?').get(campaignId, kind, mapId);
  if (!row) return null;
  if (!Number.isSafeInteger(row.revision) || row.revision < 1 || hash(row.payload) !== row.checksum || JSON.parse(row.payload)?.revision !== row.revision)
    throw new Error('Gespeicherter Geländestand ist beschädigt.');
  return row.revision;
}

/** Called inside the canonical Atlas transaction, only for actual terrain changes. */
export function advanceTerrainEnvironment(db: any, campaignId: string) {
  const {map_id: mapId} = db.prepare('SELECT map_id FROM campaign_atlas WHERE campaign_id=?').get(campaignId);
  const revision = (terrainEnvironmentRevision(db, campaignId, mapId) ?? 0) + 1;
  if (!Number.isSafeInteger(revision)) throw new Error('Geländerevision außerhalb des gültigen Bereichs.');
  const payload = JSON.stringify({revision});
  db.prepare('INSERT INTO world_record VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,kind,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum')
    .run(campaignId, kind, mapId, revision, payload, hash(payload));
}

export function validateTerrainEnvironment(db: any) {
  for (const row of db.prepare('SELECT campaign_id,id FROM world_record WHERE kind=?').iterate(kind)) {
    if (!db.prepare('SELECT 1 FROM campaign_atlas WHERE campaign_id=? AND map_id=?').get(row.campaign_id, row.id))
      throw new Error('Geländestand gehört zu keinem Atlas.');
    terrainEnvironmentRevision(db, row.campaign_id, row.id);
  }
}
