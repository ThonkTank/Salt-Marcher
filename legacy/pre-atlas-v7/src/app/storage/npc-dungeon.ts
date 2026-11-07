import { poseSpace } from '../atlas/spatial-3d';
import type { DungeonTraceRules } from '../atlas/dungeon-travel-contracts';
import { recordDungeonTrace } from './dungeon-senses';
import { createHash } from 'node:crypto';
import type { DungeonGeometry } from '../atlas/dungeon-geometry-contracts';
import type { DungeonPose } from '../atlas/dungeon-position-contracts';
import { npcPosition, placeNpc } from './npc-world';
const hash = (p: string) => createHash('sha256').update(p).digest('hex');
export function npcDungeonPose(db: any, cam: string, id: string): DungeonPose | null {
  const row = db
    .prepare('SELECT * FROM npc_dungeon_position WHERE campaign_id=? AND actor_id=?')
    .get(cam, id);
  if (!row) return null;
  if (hash(row.payload) !== row.checksum) throw new Error('Dungeonlaufstand beschädigt.');
  return JSON.parse(row.payload);
}
export function installNpcDungeonSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS dungeon_track(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,actor_id TEXT NOT NULL,scope_id TEXT NOT NULL,floor_id TEXT NOT NULL,epoch_id TEXT NOT NULL,instant_ms TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,actor_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE INDEX IF NOT EXISTS dungeon_track_local ON dungeon_track(campaign_id,scope_id,floor_id,instant_ms);`);
}
/** Dungeon owns fine placement; World retains the individual actor and coarse location. */
export function placeNpcDungeon(
  db: any,
  cam: string,
  id: string,
  pose: DungeonPose,
  expected: number | null,
  g: DungeonGeometry,
  track?: { epochId: string; instantMs: string; jobId: string; traceRules?: DungeonTraceRules },
) {
  const room = g.rooms.find(
      (r) => r.id === pose.roomId && r.scopeId === pose.scopeId && r.floorId === pose.floorId,
    ),
    floor = g.floors.find((f) => f.id === pose.floorId && f.scopeId === pose.scopeId),
    location = db
      .prepare('SELECT location_id FROM location_map WHERE campaign_id=? AND scope_id=?')
      .get(cam, pose.scopeId),
    current = npcPosition(db, cam, id);
  if (
    !room ||
    !floor ||
    !poseSpace(g, pose, pose.movement ?? 'walk') ||
    ![pose.x, pose.y, pose.z].every(Number.isFinite)
  )
    throw new Error('NPC-Position benötigt einen begehbaren Raum und die Geschosshöhe.');
  if (!location) throw new Error('Dungeonzeichnung zuerst einem Ort zuordnen.');
  if (current.revision !== expected) throw new Error('NPC-Position geändert.');
  if (current.locationId !== location.location_id || current.revision === null)
    placeNpc(db, cam, id, location.location_id, expected);
  else {
    if (
      !db
        .prepare(
          "SELECT 1 FROM world_note WHERE campaign_id=? AND id=? AND trashed=0 AND json_extract(payload,'$.kind')='npc'",
        )
        .get(cam, id)
    )
      throw new Error('NPC fehlt.');
    db.prepare(
      'UPDATE npc_position SET revision=revision+1 WHERE campaign_id=? AND actor_id=?',
    ).run(cam, id);
  }
  const payload = JSON.stringify(pose);
  db.prepare(
    'INSERT INTO npc_dungeon_position VALUES(?,?,?,?) ON CONFLICT(campaign_id,actor_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, id, payload, hash(payload));
  if (track && current.dungeon)
    recordDungeonTrace(
      db,
      cam,
      {
        actorId: id,
        sceneId: null,
        characterIds: [],
        from: current.dungeon,
        to: pose,
        jobId: track.jobId,
        epochId: track.epochId,
        instantMs: track.instantMs,
        surface: pose.movement === 'swim' ? 'water' : 'stone',
        movement: pose.movement ?? 'walk',
      },
      track.traceRules,
    );
  return npcPosition(db, cam, id);
}
