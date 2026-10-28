import { createHash } from 'node:crypto';
import type { NpcView } from '../campaign/npc-contracts';
import { npcRecord, npcDisposition } from './npc-record';
import { npcPosition } from './npc-world';
import { readWorldActor } from './session-read';
import { worldNoteDocument } from '../../features/world/world-notes';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export function note(db: any, cam: string, id: string) {
  const r = db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam, id);
  if (!r || r.trashed || hash(r.payload) !== r.checksum)
    throw new Error('NPC fehlt, ist im Papierkorb oder beschädigt.');
  const n = worldNoteDocument(JSON.parse(r.payload));
  if (n.id !== r.id || n.revision !== r.revision)
    throw new Error('NPC-Profil ist falsch zugeordnet.');
  if (n.kind !== 'npc') throw new Error('Dieser Weltinhalt ist kein NPC.');
  return n;
}

export function readNpc(db: any, cam: string, id: string): NpcView {
  const n = note(db, cam, id),
    record = npcRecord(db, cam, id),
    p = npcPosition(db, cam, id),
    exists = db.prepare('SELECT 1 FROM world_actor WHERE campaign_id=? AND id=?').get(cam, id),
    actor = exists ? readWorldActor(db, cam, id) : null;
  return {
    id,
    name: n.title,
    noteRevision: n.revision,
    creatureId: actor?.creatureId ?? n.creatureId,
    readAloud: n.readAloud,
    gmNotes: n.gmNotes,
    record,
    locationId: p.locationId,
    positionRevision: p.revision,
    actorRevision: actor?.revision ?? null,
    health: actor
      ? {
          hp: actor.hp,
          maxHp: actor.maxHp,
          tempHp: actor.tempHp,
          conditions: actor.conditions,
          concentrating: actor.concentrating,
        }
      : null,
    ...npcDisposition(db, cam, record),
  };
}
