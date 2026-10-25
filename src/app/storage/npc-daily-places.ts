import { createHash } from 'node:crypto';
import { checkedLocationDocument } from '../../features/location/location-schema';
import type { NpcPlanLocation } from '../npc-contracts';
export function readNpcPlanLocation(db: any, cam: string, locationId: string): NpcPlanLocation {
  const row = db
    .prepare('SELECT payload,checksum,trashed FROM location WHERE campaign_id=? AND id=?')
    .get(cam, locationId);
  if (!row) return { locationId, title: 'Ort nicht verfügbar', available: false };
  if (createHash('sha256').update(row.payload).digest('hex') !== row.checksum)
    throw new Error('Tagesplanziel beschädigt.');
  const location = checkedLocationDocument(JSON.parse(row.payload));
  if (location.id !== locationId) throw new Error('Tagesplanziel hat eine andere Identität.');
  return {
    locationId,
    title: location.name + (row.trashed ? ' · Papierkorb' : ''),
    available: !row.trashed,
  };
}
