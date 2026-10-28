import { seen3D, spatialRay } from '../atlas/spatial-3d';
import {
  defaultTraceRules,
  traceProfile,
  trackAt,
  movementModes,
  trackSurfaces,
} from '../runtime/track-model';
import type { DungeonTraceRules } from '../atlas/dungeon-contracts';
import { readPreparedGroup } from './session-read';
import { createHash, randomUUID } from 'node:crypto';
import type {
  DungeonGeometry,
  SpatialGeometry,
  DungeonPose,
  DungeonSenseAction,
  DungeonTrace,
  DungeonSenseView,
} from '../atlas/dungeon-contracts';
import { perception, planDungeon } from '../atlas/dungeon-model';
import { inside } from '../atlas/drawing-model';
import { readLiveScene } from './live-read';
import { position } from './scene-position';
const hash = (s: string) => createHash('sha256').update(s).digest('hex'),
  parsed = (r: any) => {
    if (!r || hash(r.payload) !== r.checksum) throw new Error('Dungeonwahrnehmung beschädigt.');
    return JSON.parse(r.payload);
  };
export function installDungeonSenses(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS dungeon_slice_memory(campaign_id TEXT NOT NULL,character_id TEXT NOT NULL,scope_id TEXT NOT NULL,slice_z INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,character_id,scope_id,slice_z),FOREIGN KEY(campaign_id,character_id) REFERENCES roster_member(campaign_id,id),FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_trace_rules(campaign_id TEXT NOT NULL REFERENCES campaign(id),owner_kind TEXT NOT NULL,owner_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,owner_kind,owner_id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_trace(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,actor_id TEXT,scene_id TEXT,scope_id TEXT NOT NULL,floor_id TEXT NOT NULL,epoch_id TEXT NOT NULL,instant_ms TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
CREATE INDEX IF NOT EXISTS dungeon_trace_local ON dungeon_trace(campaign_id,scope_id,floor_id,instant_ms);
CREATE TABLE IF NOT EXISTS dungeon_signal(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,scope_id TEXT NOT NULL,floor_id TEXT NOT NULL,epoch_id TEXT NOT NULL,instant_ms TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_perception(campaign_id TEXT NOT NULL,character_id TEXT NOT NULL,subject_kind TEXT NOT NULL,subject_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,character_id,subject_kind,subject_id),FOREIGN KEY(campaign_id,character_id) REFERENCES roster_member(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_sense_settings(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_track_adjustment(campaign_id TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,id) REFERENCES dungeon_trace(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_npc_knowledge(campaign_id TEXT NOT NULL,actor_id TEXT NOT NULL,scene_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,actor_id,scene_id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_perception_log(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,scene_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;`);
  let cursor = 0;
  while (true) {
    const batch = db
      .prepare(
        'SELECT rowid cursor,* FROM dungeon_track WHERE rowid>? AND NOT EXISTS(SELECT 1 FROM dungeon_trace n WHERE n.campaign_id=dungeon_track.campaign_id AND n.id=dungeon_track.id) ORDER BY rowid LIMIT 256',
      )
      .all(cursor);
    if (!batch.length) break;
    for (const row of batch) {
      cursor = row.cursor;
      const t = parsed(row),
        payload = JSON.stringify({
          ...t,
          sceneId: null,
          characterIds: [],
          dc: 10,
          strength: 100,
          surface: 'stone',
          movement: 'walk',
          publicText: 'Spuren',
          profile: 'dungeon-tracks-v1',
        });
      db.prepare('INSERT INTO dungeon_trace VALUES(?,?,?,?,?,?,?,?,?,?)').run(
        row.campaign_id,
        row.id,
        row.actor_id,
        null,
        row.scope_id,
        row.floor_id,
        row.epoch_id,
        row.instant_ms,
        payload,
        hash(payload),
      );
    }
  }
}
function log(db: any, cam: string, sceneId: string, text: string, facts: any) {
  const id = randomUUID(),
    p = JSON.stringify({ id, text, facts });
  db.prepare('INSERT INTO dungeon_perception_log VALUES(?,?,?,?,?)').run(
    cam,
    id,
    sceneId,
    p,
    hash(p),
  );
}
export function emitDungeonSound(
  db: any,
  cam: string,
  pose: DungeonPose,
  epochId: string,
  instantMs: string,
  publicText: string,
  rangeMeters = 18,
  dc = 10,
  actorId: string | null = null,
  sceneId: string | null = null,
) {
  if (
    !Number.isFinite(rangeMeters) ||
    rangeMeters < 0 ||
    rangeMeters > 1000 ||
    !Number.isFinite(dc) ||
    dc < -100 ||
    dc > 100 ||
    typeof publicText !== 'string' ||
    publicText.length > 1000
  )
    throw new Error('Geräuschreichweite, SG und Spielertext prüfen.');
  const id = randomUUID(),
    payload = JSON.stringify({
      id,
      pose,
      epochId,
      instantMs,
      publicText,
      rangeMeters,
      dc,
      durationSeconds: 30,
      actorId,
      sceneId,
      profile: 'dungeon-sound-v1',
    });
  db.prepare('INSERT INTO dungeon_signal VALUES(?,?,?,?,?,?,?,?)').run(
    cam,
    id,
    pose.scopeId,
    pose.floorId,
    epochId,
    instantMs,
    payload,
    hash(payload),
  );
  return id;
}
export function dungeonTraceRules(
  db: any,
  cam: string,
  sceneId: string | null,
  actorId: string | null = null,
): DungeonTraceRules {
  const r = db
    .prepare(
      'SELECT * FROM dungeon_trace_rules WHERE campaign_id=? AND owner_kind=? AND owner_id=?',
    )
    .get(cam, actorId ? 'actor' : 'scene', actorId ?? sceneId ?? '');
  if (r) return parsed(r);
  const defaults = defaultTraceRules(),
    pose = db
      .prepare(
        actorId
          ? 'SELECT payload FROM npc_dungeon_position WHERE campaign_id=? AND actor_id=?'
          : 'SELECT payload FROM scene_position WHERE campaign_id=? AND scene_id=?',
      )
      .get(cam, actorId ?? sceneId ?? ''),
    mode = pose ? JSON.parse(pose.payload)[actorId ? 'movement' : 'dungeon'] : null,
    movement = actorId ? mode : mode?.movement;
  if (movement && movementModes.includes(movement)) defaults.movement = movement;
  else if (movement === 'climb') defaults.movement = 'crawl';
  return defaults;
}
export function saveDungeonTraceRules(
  db: any,
  cam: string,
  sceneId: string,
  actorId: string | null,
  r: DungeonTraceRules,
) {
  if (
    typeof r.generate !== 'boolean' ||
    !movementModes.includes(r.movement) ||
    !['auto', ...trackSurfaces].includes(r.surface) ||
    !['dry', 'rain', 'wind', 'snow'].includes(r.environment) ||
    !Number.isFinite(r.strength) ||
    r.strength < 0 ||
    r.strength > 100 ||
    (r.dcOverride !== null &&
      (!Number.isFinite(r.dcOverride) || r.dcOverride < 0 || r.dcOverride > 100)) ||
    (r.lifetimeSeconds !== null &&
      (!Number.isSafeInteger(r.lifetimeSeconds) ||
        r.lifetimeSeconds < 1 ||
        r.lifetimeSeconds > 31536000)) ||
    (r.decayPerHour !== null &&
      (!Number.isFinite(r.decayPerHour) || r.decayPerHour < 0 || r.decayPerHour > 10000)) ||
    !['perception', 'survival'].includes(r.skill)
  )
    throw new Error('Spurenprofil prüfen.');
  if (
    actorId &&
    !db
      .prepare(
        "SELECT 1 FROM world_note WHERE campaign_id=? AND id=? AND json_extract(payload,'$.kind')='npc' AND trashed=0",
      )
      .get(cam, actorId)
  )
    throw new Error('NPC fehlt.');
  const payload = JSON.stringify(r);
  db.prepare(
    'INSERT INTO dungeon_trace_rules VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,owner_kind,owner_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, actorId ? 'actor' : 'scene', actorId ?? sceneId, payload, hash(payload));
  log(db, cam, sceneId, 'GM setzt Bewegungs-/Spurenprofil.', { actorId, rules: r });
}
function insertTrace(db: any, cam: string, t: DungeonTrace) {
  const payload = JSON.stringify(t);
  db.prepare('INSERT INTO dungeon_trace VALUES(?,?,?,?,?,?,?,?,?,?)').run(
    cam,
    t.id,
    t.actorId,
    t.sceneId,
    t.to.scopeId,
    t.to.floorId,
    t.epochId,
    t.instantMs,
    payload,
    hash(payload),
  );
  return t.id;
}
export function recordDungeonTrace(
  db: any,
  cam: string,
  t: Omit<DungeonTrace, 'id' | 'dc' | 'strength' | 'publicText' | 'profile'>,
  rules?: DungeonTraceRules,
) {
  if (Math.hypot(t.from.x - t.to.x, t.from.y - t.to.y, t.from.z - t.to.z) < 0.001) return;
  const r = rules ?? dungeonTraceRules(db, cam, t.sceneId, t.actorId),
    roomSurface = db
      .prepare(
        "SELECT json_extract(payload,'$.trackSurface') surface FROM drawing_profile WHERE campaign_id=? AND target_id=?",
      )
      .get(cam, t.to.roomId)?.surface,
    terrain = db
      .prepare(
        "SELECT payload FROM drawing_element WHERE campaign_id=? AND scope_id=? AND floor_id=? AND kind='terrain' AND json_extract(payload,'$.archived')=0 ORDER BY rowid DESC LIMIT 100",
      )
      .all(cam, t.to.scopeId, t.to.floorId)
      .map((r: any) => parsed(r))
      .find(
        (e: any) =>
          trackSurfaces.includes(e.variant) && inside(t.to, [{ outer: e.points, holes: [] }]),
      )?.variant,
    surface = r.surface === 'auto' ? (roomSurface ?? terrain ?? t.surface) : r.surface,
    profile = traceProfile(r, surface);
  emitDungeonSound(
    db,
    cam,
    t.to,
    t.epochId,
    t.instantMs,
    r.movement === 'fly' ? 'Flügelrauschen' : r.movement === 'swim' ? 'Plätschern' : 'Schritte',
    profile.soundRange,
    profile.soundDc,
    t.actorId,
    t.sceneId,
  );
  if (!r.generate || r.movement === 'fly') return;
  return insertTrace(db, cam, {
    ...t,
    id: randomUUID(),
    dc: profile.dc,
    strength: profile.strength,
    decayPerHour: profile.decayPerHour,
    lifetimeSeconds: profile.lifetimeSeconds,
    publicText: r.movement === 'swim' ? 'Spuren im Wasser' : 'Spuren',
    profile: 'dungeon-tracks-v2',
    surface,
    movement: r.movement,
    environment: r.environment,
    sourceKnown: false,
  });
}
export function dungeonTraceById(db: any, cam: string, id: string): DungeonTrace {
  const row = db.prepare('SELECT * FROM dungeon_trace WHERE campaign_id=? AND id=?').get(cam, id),
    t = parsed(row),
    adjust = db
      .prepare('SELECT * FROM dungeon_track_adjustment WHERE campaign_id=? AND id=?')
      .get(cam, id);
  return { ...t, ...(adjust ? parsed(adjust) : {}) };
}
export function addDungeonTrace(
  db: any,
  cam: string,
  sceneId: string,
  from: DungeonPose,
  to: DungeonPose,
  path: DungeonPose[],
  actorId: string | null,
  sourceKnown: boolean,
  publicText: string,
  dc: number,
  strength: number,
) {
  if (
    !Number.isFinite(dc) ||
    dc < 0 ||
    dc > 100 ||
    !Number.isFinite(strength) ||
    strength < 0 ||
    strength > 100 ||
    typeof sourceKnown !== 'boolean' ||
    typeof publicText !== 'string' ||
    publicText.length > 1000
  )
    throw new Error('Manuelle Spur prüfen.');
  if (
    actorId &&
    !db
      .prepare(
        "SELECT 1 FROM world_note WHERE campaign_id=? AND id=? AND json_extract(payload,'$.kind')='npc'",
      )
      .get(cam, actorId)
  )
    throw new Error('Spurenquelle fehlt.');
  const scene = readLiveScene(db, cam, sceneId),
    r = dungeonTraceRules(db, cam, sceneId, null),
    profile = traceProfile(r, r.surface === 'auto' ? 'stone' : r.surface),
    id = randomUUID();
  insertTrace(db, cam, {
    id,
    actorId,
    sceneId: null,
    characterIds: [],
    from,
    to,
    path,
    epochId: scene.clock.epochId,
    instantMs: scene.clock.instantMs,
    jobId: null,
    dc,
    strength,
    decayPerHour: profile.decayPerHour,
    lifetimeSeconds: profile.lifetimeSeconds,
    movement: r.movement,
    surface: r.surface === 'auto' ? 'stone' : r.surface,
    environment: r.environment,
    profile: 'dungeon-tracks-v2',
    publicText,
    sourceKnown,
  });
  log(db, cam, sceneId, 'GM ergänzt eine Spur.', { traceId: id, actorId, sourceKnown });
  return id;
}
export function discoverDungeonTrack(
  db: any,
  cam: string,
  sceneId: string,
  t: DungeonTrace,
  dc: number,
) {
  for (const id of readLiveScene(db, cam, sceneId).members) {
    const old = known(db, cam, id, 'track', t.id);
    saveKnown(db, cam, id, 'track', t.id, {
      ...old,
      known: true,
      visible: true,
      publicText: t.publicText,
      from: t.from,
      to: t.to,
      dc,
      profile: t.profile,
      sourceActorId: t.sourceKnown ? t.actorId : null,
      sourceKnown: t.sourceKnown ?? false,
    });
  }
}

export function dungeonTraces(db: any, cam: string, scopeId?: string): DungeonTrace[] {
  return db
    .prepare(
      'SELECT * FROM dungeon_trace WHERE campaign_id=?' +
        (scopeId ? ' AND scope_id=?' : '') +
        ' ORDER BY rowid DESC LIMIT 160',
    )
    .all(cam, ...(scopeId ? [scopeId] : []))
    .map((row: any) => {
      const t = parsed(row),
        adjust = db
          .prepare('SELECT * FROM dungeon_track_adjustment WHERE campaign_id=? AND id=?')
          .get(cam, row.id);
      return { ...t, ...(adjust ? parsed(adjust) : {}) };
    });
}
export function soundDistance(g: DungeonGeometry, from: DungeonPose, to: DungeonPose): number {
  if (from.scopeId !== to.scopeId) return Infinity;
  if (spatialRay(g, { ...from, z: from.z + 0.2 }, { ...to, z: to.z + 0.2 }, 'sound'))
    return Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  try {
    const acoustic = {
        ...g,
        drawing: {
          ...g.drawing,
          elements: g.drawing.elements.map((e) => ({
            ...e,
            passable:
              e.kind === 'wall'
                ? !e.blocksSound
                : e.kind === 'door' || e.kind === 'stairs'
                  ? e.state === 'open' || !e.blocksSound
                  : e.passable,
            state: 'open' as const,
          })),
        },
      },
      route = planDungeon(acoustic, from, to);
    let p = from,
      length = 0;
    for (const n of route) {
      length += Math.hypot(n.x - p.x, n.y - p.y, n.z - p.z);
      p = n;
    }
    return length;
  } catch {
    return Infinity;
  }
}
function currentSettings(db: any, cam: string, sceneId: string) {
  const r = db
    .prepare('SELECT * FROM dungeon_sense_settings WHERE campaign_id=? AND scene_id=?')
    .get(cam, sceneId);
  return r ? parsed(r) : { activeScore: null, hearingMeters: 18, trackDcOverride: null };
}
function observer(db: any, cam: string, id: string) {
  const r = db
    .prepare("SELECT * FROM player_record WHERE campaign_id=? AND kind='observer' AND id=?")
    .get(cam, id);
  return r
    ? parsed(r)
    : {
        characterId: id,
        enabled: true,
        rangeMeters: 10000,
        darkvisionMeters: 0,
        eyeHeightMeters: 1.7,
      };
}
function illumination(db: any, cam: string) {
  const r = db
    .prepare("SELECT * FROM player_record WHERE campaign_id=? AND kind='settings' AND id='main'")
    .get(cam);
  return r ? parsed(r) : { light: 'auto' };
}
function known(db: any, cam: string, characterId: string, kind: string, id: string) {
  const r = db
    .prepare(
      'SELECT * FROM dungeon_perception WHERE campaign_id=? AND character_id=? AND subject_kind=? AND subject_id=?',
    )
    .get(cam, characterId, kind, id);
  return r ? parsed(r) : { known: false, visible: false, heard: false, override: null };
}
function saveKnown(db: any, cam: string, id: string, kind: string, subject: string, v: any) {
  const p = JSON.stringify(v);
  db.prepare(
    'INSERT INTO dungeon_perception VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,character_id,subject_kind,subject_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, id, kind, subject, p, hash(p));
}
function recentSignals(db: any, cam: string, scene: any, g: DungeonGeometry) {
  const transient = db
    .prepare(
      'SELECT * FROM dungeon_signal WHERE campaign_id=? AND epoch_id=? ORDER BY rowid DESC LIMIT 160',
    )
    .all(cam, scene.clock.epochId)
    .map(parsed)
    .filter(
      (s: any) =>
        BigInt(s.instantMs) <= BigInt(scene.clock.instantMs) &&
        BigInt(scene.clock.instantMs) - BigInt(s.instantMs) <= BigInt(s.durationSeconds) * 1000n &&
        s.sceneId !== scene.id,
    );
  const persistent = g.drawing.elements
    .filter((e) => !e.archived && e.sound?.enabled && e.roomId)
    .map((e) => ({
      id: e.id,
      pose: {
        ...e.points[0]!,
        scopeId: e.scopeId,
        floorId: e.floorId,
        roomId: e.roomId!,
        z: g.floors.find((f) => f.id === e.floorId && f.scopeId === e.scopeId)?.elevation ?? 0,
      },
      publicText: e.sound!.publicText,
      rangeMeters: e.sound!.rangeMeters,
      dc: e.sound!.dc,
      actorId: null,
      sceneId: null,
    }));
  return [...persistent, ...transient];
}
export function evaluateDungeonSenses(
  db: any,
  cam: string,
  sceneId: string,
  g: DungeonGeometry,
  search = false,
) {
  const scene = readLiveScene(db, cam, sceneId),
    pose = position(db, cam, sceneId).dungeon;
  if (!pose) return [];
  const settings = currentSettings(db, cam, sceneId),
    light = illumination(db, cam),
    npcs = db
      .prepare(
        "SELECT p.actor_id,p.payload,a.payload config FROM npc_dungeon_position p LEFT JOIN autonomy_actor a ON a.campaign_id=p.campaign_id AND a.id=p.actor_id WHERE p.campaign_id=? AND json_extract(p.payload,'$.scopeId')=? LIMIT 200",
      )
      .all(cam, pose.scopeId)
      .map((r: any) => ({
        id: r.actor_id,
        pose: JSON.parse(r.payload),
        config: r.config ? JSON.parse(r.config) : {},
      })),
    signals = recentSignals(db, cam, scene, g),
    newActors = new Set<string>(),
    traces = search ? dungeonTraces(db, cam, pose.scopeId) : [];
  for (const id of scene.members) {
    const profile = JSON.parse(
        db
          .prepare('SELECT payload FROM character_profile WHERE campaign_id=? AND id=?')
          .get(cam, id).payload,
      ),
      score = settings.activeScore ?? profile.passivePerception ?? 10,
      o = observer(db, cam, id),
      seen = search
        ? perception(
            g,
            pose,
            o,
            light,
            new Set(
              db
                .prepare(
                  'SELECT room_id FROM dungeon_reveal WHERE campaign_id=? AND character_id=?',
                )
                .all(cam, id)
                .map((r: any) => r.room_id),
            ) as Set<string>,
          )
        : [];
    for (const npc of npcs) {
      const old = known(db, cam, id, 'actor', npc.id),
        physical =
          o.enabled &&
          (!g.drawing.styles.find((t) => t.id === npc.pose.roomId)?.secret ||
            db
              .prepare(
                'SELECT 1 FROM dungeon_reveal WHERE campaign_id=? AND character_id=? AND room_id=?',
              )
              .get(cam, id, npc.pose.roomId)) &&
          seen3D(
            g,
            pose,
            npc.pose,
            Math.min(o.rangeMeters, 1000),
            o.darkvisionMeters,
            light.light,
            o.eyeHeightMeters,
          ) &&
          score >= (npc.config.stealthDc ?? 10),
        visible = old.override === 'known' ? true : old.override === 'unknown' ? false : physical,
        next = {
          ...old,
          known: old.override === 'unknown' ? false : old.known || visible,
          visible,
          heard: false,
          point: { x: npc.pose.x, y: npc.pose.y },
          floorId: npc.pose.floorId,
          scopeId: npc.pose.scopeId,
        };
      if (visible && !old.visible) newActors.add(npc.id);
      saveKnown(db, cam, id, 'actor', npc.id, next);
    }
    for (const previous of db
      .prepare(
        "SELECT * FROM dungeon_perception WHERE campaign_id=? AND character_id=? AND subject_kind='sound' AND json_extract(payload,'$.heard')=1 LIMIT 160",
      )
      .all(cam, id)) {
      const v = parsed(previous);
      saveKnown(db, cam, id, 'sound', previous.subject_id, { ...v, heard: false });
    }
    for (const s of signals) {
      if (s.pose.scopeId !== pose.scopeId) continue;
      const heard =
          score >= s.dc &&
          soundDistance(g, pose, s.pose) <= Math.min(settings.hearingMeters, s.rangeMeters),
        old = known(db, cam, id, 'sound', s.id);
      saveKnown(db, cam, id, 'sound', s.id, {
        ...old,
        known: old.known || heard,
        visible: false,
        heard,
        publicText: s.publicText,
        floorId: pose.floorId,
        scopeId: pose.scopeId,
        sourceActorId: s.actorId ?? null,
      });
    }
    for (const t of traces) {
      if (t.hidden || t.to.floorId !== pose.floorId || t.epochId !== scene.clock.epochId) continue;
      const state = trackAt(t, scene.clock.epochId, scene.clock.instantMs);
      if (!state.alive) continue;
      const dc = settings.trackDcOverride ?? state.dc,
        near =
          Math.hypot(pose.x - t.to.x, pose.y - t.to.y) <= 3 ||
          Math.hypot(pose.x - t.from.x, pose.y - t.from.y) <= 3,
        old = known(db, cam, id, 'track', t.id),
        detected = near && score >= dc;
      if (detected && (inside(t.from, seen) || inside(t.to, seen)))
        saveKnown(db, cam, id, 'track', t.id, {
          ...old,
          known: true,
          visible: true,
          publicText: t.publicText,
          from: t.from,
          to: t.to,
          dc,
          profile: t.profile,
          sourceKnown: t.sourceKnown ?? false,
          sourceActorId: t.sourceKnown ? t.actorId : null,
        });
    }
  }
  if (newActors.size) {
    const row = db
      .prepare(
        'SELECT * FROM dungeon_journey WHERE campaign_id=? AND scene_id=? ORDER BY rowid DESC LIMIT 1',
      )
      .get(cam, sceneId);
    if (row) {
      const j = parsed(row);
      if (j.status === 'active') {
        j.status = 'paused';
        j.reason = 'Neue NPC-Wahrnehmung. Begegnung als GM klären.';
        j.revision++;
        const p = JSON.stringify(j);
        db.prepare(
          'UPDATE dungeon_journey SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
        ).run(j.revision, p, hash(p), cam, j.id);
      }
    }
    log(db, cam, sceneId, 'Neue NPC-Wahrnehmung; Begegnung bleibt GM-Entscheidung.', {
      actorIds: [...newActors],
    });
    for (const id of newActors) {
      const row = db
        .prepare('SELECT * FROM autonomy_actor WHERE campaign_id=? AND id=?')
        .get(cam, id);
      if (row) {
        const a = parsed(row);
        if (a.enabled && !a.paused) {
          a.paused = true;
          a.pending = 'Party hat den NPC wahrgenommen. Begegnung als GM klären.';
          a.revision++;
          const p = JSON.stringify(a);
          db.prepare(
            'UPDATE autonomy_actor SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
          ).run(a.revision, p, hash(p), cam, id);
        }
      }
    }
  }
  return [...newActors];
}
export function dungeonSenseView(
  db: any,
  cam: string,
  sceneId: string | null,
  g: SpatialGeometry,
): DungeonSenseView {
  if (!sceneId)
    return {
      settings: { activeScore: null, hearingMeters: 18, trackDcOverride: null },
      observations: [],
      logs: [],
      groups: [],
    };
  const scene = readLiveScene(db, cam, sceneId),
    members = new Set(scene.members),
    observations = db
      .prepare(
        'SELECT * FROM dungeon_perception WHERE campaign_id=? AND character_id IN(SELECT id FROM roster_member WHERE campaign_id=? AND scene_id=? AND active=1) ORDER BY rowid DESC LIMIT 1000',
      )
      .all(cam, cam, sceneId)
      .filter((r: any) => members.has(r.character_id))
      .map((r: any) => ({
        characterId: r.character_id,
        subjectKind: r.subject_kind,
        subjectId: r.subject_id,
        ...parsed(r),
      })),
    groups = db
      .prepare(
        'SELECT * FROM prepared_group WHERE campaign_id=? AND draft_plan_id IS NULL LIMIT 200',
      )
      .all(cam)
      .map((row: any) => readPreparedGroup(db, cam, row.id))
      .filter((group: any) =>
        group.actors.some((a: any) => {
          const p = db
            .prepare('SELECT payload FROM npc_dungeon_position WHERE campaign_id=? AND actor_id=?')
            .get(cam, a.id);
          return p && g.rooms.some((r) => r.id === JSON.parse(p.payload).roomId);
        }),
      )
      .map((group: any) => ({
        id: group.id,
        revision: group.revision,
        name: group.title,
        actorIds: group.actors.map((a: any) => a.id),
        available:
          group.actors.some((a: any) => a.hp > 0) &&
          group.actors.every((a: any) => a.hp <= 0 || !a.unavailable),
      }));
  return {
    settings: currentSettings(db, cam, sceneId),
    observations,
    logs: db
      .prepare(
        'SELECT * FROM dungeon_perception_log WHERE campaign_id=? AND scene_id=? ORDER BY rowid DESC LIMIT 30',
      )
      .all(cam, sceneId)
      .map(parsed),
    groups,
  };
}
export function executeDungeonSense(
  db: any,
  cam: string,
  sceneId: string,
  a: DungeonSenseAction,
  g: DungeonGeometry,
) {
  const scene = readLiveScene(db, cam, sceneId);
  if (
    (a.score !== null && (!Number.isFinite(a.score) || a.score < -100 || a.score > 100)) ||
    !Number.isFinite(a.hearingMeters) ||
    a.hearingMeters < 0 ||
    a.hearingMeters > 1000 ||
    (a.trackDcOverride !== null &&
      (!Number.isFinite(a.trackDcOverride) || a.trackDcOverride < 0 || a.trackDcOverride > 100))
  )
    throw new Error('Wahrnehmungswerte prüfen.');
  const old = currentSettings(db, cam, sceneId),
    next = {
      ...old,
      hearingMeters: a.hearingMeters,
      trackDcOverride: a.trackDcOverride,
      activeScore:
        a.mode === 'active' ? a.score : a.mode === 'clear-active' ? null : old.activeScore,
    };
  if (a.mode === 'active' && a.score === null) throw new Error('Aktives Ergebnis eingeben.');
  const p = JSON.stringify(next);
  db.prepare(
    'INSERT INTO dungeon_sense_settings VALUES(?,?,?,?) ON CONFLICT(campaign_id,scene_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, sceneId, p, hash(p));
  if (['force-known', 'force-unknown', 'reevaluate'].includes(a.mode)) {
    if (!a.subjectId) throw new Error('NPC auswählen.');
    for (const id of scene.members) {
      const value = known(db, cam, id, 'actor', a.subjectId);
      value.override =
        a.mode === 'reevaluate' ? null : a.mode === 'force-known' ? 'known' : 'unknown';
      saveKnown(db, cam, id, 'actor', a.subjectId, value);
    }
  }
  log(
    db,
    cam,
    sceneId,
    'GM bestätigt Wahrnehmung: ' + a.mode + (a.reason ? ' · ' + a.reason : ''),
    {
      subjectId: a.subjectId,
      score: next.activeScore,
      hearingMeters: next.hearingMeters,
      profile: 'dungeon-perception-2014-v1',
    },
  );
  return evaluateDungeonSenses(db, cam, sceneId, g, a.mode === 'search-tracks');
}
export function correctDungeonTrack(
  db: any,
  cam: string,
  id: string,
  dc: number,
  hidden: boolean,
  publicText: string,
) {
  if (
    !Number.isFinite(dc) ||
    dc < 0 ||
    dc > 100 ||
    typeof hidden !== 'boolean' ||
    typeof publicText !== 'string' ||
    publicText.length > 1000
  )
    throw new Error('Spurenkorrektur prüfen.');
  const p = JSON.stringify({ dc, hidden, publicText });
  db.prepare(
    'INSERT INTO dungeon_track_adjustment VALUES(?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, id, p, hash(p));
}

export function npcHearsParty(
  db: any,
  cam: string,
  g: DungeonGeometry,
  at: DungeonPose,
  scene: any,
  hearingMeters: number,
  score: number,
) {
  const signals = db
    .prepare(
      'SELECT * FROM dungeon_signal WHERE campaign_id=? AND epoch_id=? ORDER BY rowid DESC LIMIT 100',
    )
    .all(cam, scene.epoch_id)
    .map(parsed)
    .filter(
      (s: any) =>
        s.sceneId === scene.scene_id &&
        BigInt(s.instantMs) <= BigInt(scene.instant_ms) &&
        BigInt(scene.instant_ms) - BigInt(s.instantMs) <= BigInt(s.durationSeconds) * 1000n,
    );
  return signals.some(
    (s: any) =>
      score >= s.dc && soundDistance(g, at, s.pose) <= Math.min(hearingMeters, s.rangeMeters),
  );
}
export function rememberNpcParty(
  db: any,
  cam: string,
  actorId: string,
  sceneId: string,
  visible: boolean,
  heard: boolean,
) {
  const old = db
      .prepare(
        'SELECT * FROM dungeon_npc_knowledge WHERE campaign_id=? AND actor_id=? AND scene_id=?',
      )
      .get(cam, actorId, sceneId),
    v = old ? parsed(old) : { known: false },
    payload = JSON.stringify({
      ...v,
      known: v.known || visible,
      visible,
      heard,
      profile: 'dungeon-perception-2014-v1',
    });
  db.prepare(
    'INSERT INTO dungeon_npc_knowledge VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,actor_id,scene_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, actorId, sceneId, payload, hash(payload));
}
