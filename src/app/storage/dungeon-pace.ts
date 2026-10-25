import { createHash } from 'node:crypto';
import { readRoster, readLiveScene } from './live';
import { checkedDungeonPace, dungeonPartyPace, type DungeonPaceSettings } from '../dungeon-pace';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installDungeonPace(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS dungeon_travel_settings(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;`,
  );
}
export function readDungeonPace(db: any, cam: string, sceneId: string) {
  const scene = readLiveScene(db, cam, sceneId),
    row = db
      .prepare('SELECT * FROM dungeon_travel_settings WHERE campaign_id=? AND scene_id=?')
      .get(cam, sceneId);
  const settings: DungeonPaceSettings = row
    ? JSON.parse(row.payload)
    : { sceneId, revision: 0, movement: 'walk', groupMetersPerMinute: null, members: [] };
  if (
    row &&
    (hash(row.payload) !== row.checksum ||
      settings.revision !== row.revision ||
      settings.sceneId !== row.scene_id)
  )
    throw new Error('Dungeon-Tempovorgaben beschädigt.');
  checkedDungeonPace(settings);
  const members = readRoster(db, cam).filter((c) => c.active && scene.members.includes(c.id));
  return {
    settings,
    pace: dungeonPartyPace(members, settings),
    membershipRevision: scene.membershipRevision,
  };
}
export function saveDungeonPace(
  db: any,
  cam: string,
  settings: DungeonPaceSettings,
  expectedMembershipRevision: number,
) {
  checkedDungeonPace(settings);
  const current = readDungeonPace(db, cam, settings.sceneId);
  if (
    current.settings.revision !== settings.revision ||
    current.membershipRevision !== expectedMembershipRevision
  )
    throw new Error(
      'Gruppe oder Tempovorgaben geändert. Offene Einstellungen verwerfen und aktualisieren.',
    );
  const ids = new Set(current.pace.members.map((m) => m.characterId));
  if (settings.members.some((m) => !ids.has(m.characterId)))
    throw new Error('Tempovorgaben dürfen nur aktuelle Gruppenmitglieder betreffen.');
  const next = { ...settings, revision: settings.revision + 1 },
    payload = JSON.stringify(next);
  db.prepare(
    'INSERT INTO dungeon_travel_settings VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,scene_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, settings.sceneId, next.revision, payload, hash(payload));
}
export function validateDungeonPaces(db: any) {
  for (const row of db.prepare('SELECT * FROM dungeon_travel_settings').iterate()) {
    if (hash(row.payload) !== row.checksum) throw new Error('Dungeon-Tempovorgaben beschädigt.');
    const s = checkedDungeonPace(JSON.parse(row.payload));
    if (s.sceneId !== row.scene_id || s.revision !== row.revision)
      throw new Error('Dungeon-Tempovorgaben widersprüchlich.');
  }
}
