import { checkedPreparedGroupRow } from './prepared-group';
import { createHash } from 'node:crypto';
import type { DungeonPose } from '../atlas/dungeon-contracts';
import type { NpcRoute } from '../runtime/autonomy-contracts';
const hash = (p: string) => createHash('sha256').update(p).digest('hex');
export function installNpcWorldSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS npc_position(campaign_id TEXT NOT NULL,actor_id TEXT NOT NULL,location_id TEXT,revision INTEGER NOT NULL,PRIMARY KEY(campaign_id,actor_id),FOREIGN KEY(campaign_id,actor_id) REFERENCES world_note(campaign_id,id),FOREIGN KEY(campaign_id,location_id) REFERENCES location(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS npc_route(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,from_location_id TEXT NOT NULL,to_location_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,from_location_id) REFERENCES location(campaign_id,id),FOREIGN KEY(campaign_id,to_location_id) REFERENCES location(campaign_id,id)) STRICT;`);
}
/** Reuse statements for a read projection while querying the current World-owned facts. */
export function npcPositionReader(
  db: any,
  cam: string,
): (id: string) => {
  locationId: string | null;
  revision: number | null;
  dungeon?: DungeonPose | null;
} {
  const position = db.prepare(
    'SELECT location_id,revision FROM npc_position WHERE campaign_id=? AND actor_id=?',
  );
  const detail = db.prepare(
    'SELECT payload,checksum FROM npc_dungeon_position WHERE campaign_id=? AND actor_id=?',
  );
  const groups = db.prepare(
    'SELECT * FROM prepared_group WHERE campaign_id=? AND location_id IS NOT NULL ORDER BY rowid',
  );
  return (id: string) => {
    const p = position.get(cam, id);
    if (p) {
      const d = detail.get(cam, id);
      if (d && hash(d.payload) !== d.checksum) throw new Error('NPC-Raumposition beschädigt.');
      return {
        locationId: p.location_id as string | null,
        revision: p.revision as number,
        dungeon: d ? JSON.parse(d.payload) : null,
      };
    }
    for (const row of groups.iterate(cam)) {
      const g = checkedPreparedGroupRow(row);
      if (g.actors.some((actor) => actor.id === id))
        return { locationId: g.locationId, revision: null };
    }
    return { locationId: null, revision: null };
  };
}
// Position overrides group membership. Read group bytes before inspecting their actors.
export function npcIdsAtLocation(db: any, cam: string, locationId: string) {
  const ids = new Set<string>(),
    position = db.prepare('SELECT 1 FROM npc_position WHERE campaign_id=? AND actor_id=?');
  for (const row of db
    .prepare('SELECT actor_id FROM npc_position WHERE campaign_id=? AND location_id=?')
    .iterate(cam, locationId))
    ids.add(row.actor_id);
  for (const row of db
    .prepare('SELECT * FROM prepared_group WHERE campaign_id=? AND location_id=?')
    .iterate(cam, locationId)) {
    for (const actor of checkedPreparedGroupRow(row).actors) {
      if (!position.get(cam, actor.id)) ids.add(actor.id);
    }
  }
  return ids;
}
export function npcPosition(db: any, cam: string, id: string) {
  return npcPositionReader(db, cam)(id);
}
/** World owns NPC placement. Group summaries derive from the same individual positions. */
export function placeNpc(
  db: any,
  cam: string,
  id: string,
  locationId: string | null,
  expected: number | null,
) {
  if (npcPosition(db, cam, id).revision !== expected) throw new Error('NPC-Position geändert.');
  if (
    !db
      .prepare(
        "SELECT 1 FROM world_note WHERE campaign_id=? AND id=? AND json_extract(payload,'$.kind')='npc' AND trashed=0",
      )
      .get(cam, id) ||
    (locationId !== null &&
      !db
        .prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0')
        .get(cam, locationId))
  )
    throw new Error('NPC oder Zielort fehlt.');
  const groups = [];
  for (const row of db.prepare('SELECT * FROM prepared_group WHERE campaign_id=?').iterate(cam)) {
    const group = checkedPreparedGroupRow(row);
    if (group.actors.some((actor) => actor.id === id)) groups.push(group);
  }
  db.prepare(
    'INSERT INTO npc_position VALUES(?,?,?,?) ON CONFLICT(campaign_id,actor_id) DO UPDATE SET location_id=excluded.location_id,revision=excluded.revision',
  ).run(cam, id, locationId, (expected ?? 0) + 1);
  db.prepare('DELETE FROM npc_dungeon_position WHERE campaign_id=? AND actor_id=?').run(cam, id);
  const position = npcPositionReader(db, cam);
  for (const group of groups) {
    const places = group.actors.map((actor) => position(actor.id).locationId),
      common = places.length && places.every((place) => place === places[0]) ? places[0]! : null;
    if (group.locationId === common) continue;
    group.locationId = common;
    group.revision++;
    const payload = JSON.stringify(group);
    db.prepare(
      'UPDATE prepared_group SET location_id=?,revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
    ).run(common, group.revision, payload, hash(payload), cam, group.id);
  }
  return position(id);
}

export function npcRoutes(db: any, cam: string): NpcRoute[] {
  return db
    .prepare('SELECT * FROM npc_route WHERE campaign_id=? ORDER BY id')
    .all(cam)
    .map((r: any) => {
      if (hash(r.payload) !== r.checksum) throw new Error('NPC-Weg ist beschädigt.');
      return JSON.parse(r.payload);
    });
}
export function saveNpcRoute(db: any, cam: string, r: NpcRoute, expected: number | null) {
  const old = db
    .prepare('SELECT revision FROM npc_route WHERE campaign_id=? AND id=?')
    .get(cam, r.id);
  if ((old?.revision ?? null) !== expected) throw new Error('Weg geändert.');
  if (
    !r.id ||
    !r.name.trim() ||
    !Number.isSafeInteger(r.durationSeconds) ||
    r.durationSeconds < 1 ||
    r.durationSeconds > 100000000 ||
    r.fromLocationId === r.toLocationId ||
    typeof r.enabled !== 'boolean'
  )
    throw new Error('Weg, Zeit und Endpunkte prüfen.');
  for (const id of [r.fromLocationId, r.toLocationId])
    if (
      !db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0').get(cam, id)
    )
      throw new Error('Wegende fehlt.');
  const n = { ...r, revision: (expected ?? 0) + 1 },
    p = JSON.stringify(n);
  db.prepare(
    'INSERT INTO npc_route VALUES(?,?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET from_location_id=excluded.from_location_id,to_location_id=excluded.to_location_id,revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, n.id, n.fromLocationId, n.toLocationId, n.revision, p, hash(p));
  return n;
}

/** A GM group placement moves its existing individuals as one owner operation. */
export function placeNpcGroup(db: any, cam: string, ids: string[], locationId: string) {
  for (const id of ids) {
    db.prepare('DELETE FROM npc_dungeon_position WHERE campaign_id=? AND actor_id=?').run(cam, id);
    const p = npcPosition(db, cam, id);
    if (p.locationId === locationId && p.revision !== null) continue;
    db.prepare(
      'INSERT INTO npc_position VALUES(?,?,?,?) ON CONFLICT(campaign_id,actor_id) DO UPDATE SET location_id=excluded.location_id,revision=excluded.revision',
    ).run(cam, id, locationId, (p.revision ?? 0) + 1);
  }
}
