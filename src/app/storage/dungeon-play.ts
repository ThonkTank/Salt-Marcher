import { roomGeometries } from './room-reads';
import {
  installDungeonPace,
  readDungeonPace,
  saveDungeonPace,
  validateDungeonPaces,
} from './dungeon-pace';
import { seen3D } from '../spatial-3d';
import { surfaceWorldFaces } from '../surface-model';
import {
  dungeonContentContexts,
  evaluateContents,
  confirmFeatureDiscovery,
  dismissContentSignal,
  bindDungeonGroup,
  contentState,
  saveContentState,
} from './content-runtime';
import type { ProgressCommand } from '../progression';
import { readTriggerEvents, saveTriggerEvent, createTriggerEvents } from './triggers';
import { refineTriggerRoute } from '../trigger-model';
import { keyDiscoveries, revealKey } from './dungeon-key';
import { renderDungeonKey } from '../key-model';
import { passageLanding } from '../path-spatial';
import { poseSpace } from '../spatial-3d';
import { startPursuit, continuePursuit, pursuitGuard } from './dungeon-pursuit';
import {
  dungeonTraces,
  dungeonSenseView,
  executeDungeonSense,
  evaluateDungeonSenses,
  emitDungeonSound,
  recordDungeonTrace,
  correctDungeonTrack,
  dungeonTraceRules,
  saveDungeonTraceRules,
  addDungeonTrace,
} from './dungeon-senses';
import type { CombatCommand } from '../combat-contracts';
import { readPreparedGroup } from './session';
import { npcDungeonPose, placeNpcDungeon } from './npc-dungeon';
import { createHash, randomUUID } from 'node:crypto';
import type {
  DungeonCommand,
  DungeonGeometry,
  DungeonJourney,
  DungeonPose,
  DungeonPreview,
  DungeonRequest,
  DungeonView,
  DungeonDisplay,
} from '../dungeon-contracts';
import type { PlayerObserver, PlayerSettings } from '../player-contracts';
import type { LiveCommand } from '../live-contracts';
import { readLive, readLiveScene } from './live';
import { position, savePosition } from './world';
import { drawingRoom, drawingView, activateDungeonFeature } from './drawing';
import { npcPosition } from './npc-world';
import { planDungeon, perception, centerInRoom, unionPerception } from '../dungeon-model';
import { inside, carveRoom } from '../drawing-model';
const hash = (s: string) => createHash('sha256').update(s).digest('hex'),
  parsed = (r: any) => {
    if (!r || hash(r.payload) !== r.checksum) throw new Error('Dungeonlaufstand beschädigt.');
    return JSON.parse(r.payload);
  };
export function installDungeonPlaySchema(db: any) {
  installDungeonPace(db);
  db.exec(`CREATE TABLE IF NOT EXISTS dungeon_journey(campaign_id TEXT NOT NULL,id TEXT NOT NULL,scene_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_memory(campaign_id TEXT NOT NULL,character_id TEXT NOT NULL,scope_id TEXT NOT NULL,floor_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,character_id,scope_id,floor_id),FOREIGN KEY(campaign_id,character_id) REFERENCES roster_member(campaign_id,id),FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_reveal(campaign_id TEXT NOT NULL,character_id TEXT NOT NULL,room_id TEXT NOT NULL,PRIMARY KEY(campaign_id,character_id,room_id),FOREIGN KEY(campaign_id,character_id) REFERENCES roster_member(campaign_id,id),FOREIGN KEY(campaign_id,room_id) REFERENCES room(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS npc_dungeon_position(campaign_id TEXT NOT NULL,actor_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,actor_id),FOREIGN KEY(campaign_id,actor_id) REFERENCES npc_position(campaign_id,actor_id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_receipt(campaign_id TEXT NOT NULL REFERENCES campaign(id),command_id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL) STRICT;`);
}
export function dungeonMapView(
  db: any,
  cam: string,
  shape?: import('../contracts').WorkspaceGeometry,
  drawingOverride?: import('../drawing-contracts').DrawingView<
    import('../contracts').RoomGeometry,
    import('../drawing-contracts').DrawingElementGeometry
  >,
): import('../dungeon-contracts').DungeonView<
  import('../contracts').RoomGeometry,
  import('../drawing-contracts').DrawingElementGeometry
> {
  const drawing = drawingOverride ?? drawingView(db, cam, true),
    live = readLive(db, cam),
    scene = live.scene,
    p = scene ? position(db, cam, scene.id) : null,
    npcs = db
      .prepare(
        "SELECT n.id,json_extract(n.payload,'$.title') name,json_extract(a.payload,'$.dungeonTravel') travel,json_extract(a.payload,'$.paused') paused,json_extract(a.payload,'$.pending') pending FROM world_note n LEFT JOIN autonomy_actor a ON a.campaign_id=n.campaign_id AND a.id=n.id WHERE n.campaign_id=? AND n.trashed=0 AND json_extract(n.payload,'$.kind')='npc' ORDER BY name LIMIT 2000",
      )
      .all(cam)
      .map((r: any) => {
        const p = npcPosition(db, cam, r.id);
        const travel = r.travel ? JSON.parse(r.travel) : null;
        return {
          id: r.id,
          name: r.name,
          ...p,
          pose: npcDungeonPose(db, cam, r.id),
          traceRules: dungeonTraceRules(db, cam, null, r.id),
          destination: travel?.destination ?? null,
          path: travel?.route.slice(travel.nextIndex, travel.nextIndex + 64) ?? [],
          paused: !!r.paused,
          pending: r.pending ?? null,
        };
      });
  const rooms = shape?.rooms ?? roomGeometries(db, cam).rooms;
  const senses = dungeonSenseView(db, cam, scene?.id ?? null, { rooms, floors: [], drawing });
  return {
    rooms,
    floors: shape
      ? shape.floors.map((f) => ({
          id: f.id,
          scopeId: f.scopeId,
          name: f.name,
          elevation: f.sourceElevation,
        }))
      : db
          .prepare(
            `SELECT f.id,f.scope_id scopeId,f.name,f.source_elevation elevation FROM drawing_floor f WHERE f.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=f.campaign_id AND h.id=f.id AND h.scope_id=f.scope_id AND h.kind='floor' AND h.hidden=1)`,
          )
          .all(cam),
    drawing,
    sceneId: scene?.id ?? null,
    sceneTitle: scene?.title ?? '',
    position: p?.dungeon ?? null,
    positionRevision: p?.revision ?? 0,
    clockRevision: scene?.clock.revision ?? 0,
    instantMs: scene?.clock.instantMs ?? '0',
    epochId: scene?.clock.epochId ?? '',
    journey: scene ? activeJourney(db, cam, scene.id) : null,
    npcs,
    tracks: dungeonTraces(db, cam),
    senses,
    traceRules: dungeonTraceRules(db, cam, scene?.id ?? null),
  };
}
export function dungeonGeometry(db: any, cam: string): DungeonGeometry {
  const drawing = drawingView(db, cam);
  for (const key of drawing.keyContent ?? []) {
    if (key.kind !== 'room' || !key.secret) continue;
    const style = drawing.styles.find((s) => s.id === key.id);
    if (style) style.secret = true;
    else
      drawing.styles.push({
        id: key.id,
        revision: 0,
        scopeId: key.scopeId,
        ceilingMeters: 3.048,
        fill: '#c5b998',
        wall: '#56493e',
        publicLabel: '',
        secret: true,
      });
  }
  const rooms = db
      .prepare(
        `SELECT r.id FROM room r WHERE r.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1) AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.floor_id AND h.scope_id=r.scope_id AND h.kind='floor' AND h.hidden=1)`,
      )
      .all(cam)
      .map((r: any) => drawingRoom(db, cam, r.id)),
    floors = db
      .prepare(
        `SELECT f.id,f.scope_id scopeId,f.name,f.source_elevation elevation FROM drawing_floor f WHERE f.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=f.campaign_id AND h.id=f.id AND h.scope_id=f.scope_id AND h.kind='floor' AND h.hidden=1)`,
      )
      .all(cam);
  return { rooms, floors, drawing };
}
function checkedPose(g: DungeonGeometry, p: DungeonPose) {
  const room = g.rooms.find(
      (r) => r.id === p?.roomId && r.scopeId === p.scopeId && r.floorId === p.floorId,
    ),
    floor = g.floors.find((f) => f.id === p.floorId && f.scopeId === p.scopeId);
  if (!room || !floor || ![p.x, p.y, p.z].every(Number.isFinite))
    throw new Error('Position liegt außerhalb des verfügbaren Raums oder Geschosses.');
  if (!poseSpace(g, p, p.movement ?? 'walk'))
    throw new Error(
      'Position hat für diese Bewegung keine freie Körperhöhe, Standfläche oder passendes Medium.',
    );
  return p;
}
export function dungeonGeometryBasis(g: DungeonGeometry, scopeId: string) {
  return hash(
    JSON.stringify({
      rooms: g.rooms.filter((r) => r.scopeId === scopeId).map((r) => [r.id, r.revision]),
      floors: g.floors.filter((f) => f.scopeId === scopeId),
      passages: g.drawing.passages
        ?.filter((p) => p.scopeId === scopeId)
        .map((p) => [p.id, p.revision]),
      paths: g.drawing.paths?.filter((p) => p.scopeId === scopeId).map((p) => [p.id, p.revision]),
      elements: g.drawing.elements
        .filter((e) => e.scopeId === scopeId)
        .map((e) => [e.id, e.revision]),
      triggerFields: g.drawing.triggerFields
        ?.filter((f) => f.scopeId === scopeId)
        .map((f) => [f.id, f.revision]),
      styles: g.drawing.styles.filter((e) => e.scopeId === scopeId).map((e) => [e.id, e.revision]),
    }),
  );
}
function checkedPartial(j: DungeonJourney) {
  const elapsed = j.segmentElapsedSeconds;
  if (
    elapsed !== undefined &&
    (!Number.isSafeInteger(elapsed) ||
      elapsed < 0 ||
      !Number.isSafeInteger(j.nextIndex) ||
      j.nextIndex < 0 ||
      j.nextIndex >= j.route.length ||
      elapsed >= j.segmentSeconds[j.nextIndex]!)
  )
    throw new Error('Gespeicherter Rundenfortschritt ungültig.');
  return j;
}
function activeJourney(db: any, cam: string, sceneId: string) {
  const r = db
    .prepare(
      'SELECT * FROM dungeon_journey WHERE campaign_id=? AND scene_id=? ORDER BY rowid DESC LIMIT 1',
    )
    .get(cam, sceneId);
  return r ? checkedPartial(parsed(r)) : null;
}
function saveJourney(db: any, cam: string, j: DungeonJourney) {
  const p = JSON.stringify(j);
  db.prepare(
    'INSERT INTO dungeon_journey VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, j.id, j.request.sceneId, j.revision, p, hash(p));
}

function keyHeading(db: any, cam: string, sceneId: string) {
  const journey = activeJourney(db, cam, sceneId),
    current = position(db, cam, sceneId);
  if (!journey || !current.dungeon || journey.positionRevision !== current.revision) return null;
  for (let i = Math.min(journey.nextIndex, journey.route.length) - 1; i > 0; i--) {
    const at = journey.route[i]!,
      prior = journey.route[i - 1]!;
    if (Math.hypot(at.x - prior.x, at.y - prior.y) > 0.01)
      return (Math.atan2(at.x - prior.x, prior.y - at.y) * 180) / Math.PI;
  }
  return null;
}
export function dungeonView(db: any, cam: string): DungeonView {
  const live = readLive(db, cam),
    scene = live.scene,
    p = scene ? position(db, cam, scene.id) : null,
    g = dungeonGeometry(db, cam),
    npcs = db
      .prepare(
        "SELECT n.id,json_extract(n.payload,'$.title') name,json_extract(a.payload,'$.dungeonTravel') travel,json_extract(a.payload,'$.paused') paused,json_extract(a.payload,'$.pending') pending FROM world_note n LEFT JOIN autonomy_actor a ON a.campaign_id=n.campaign_id AND a.id=n.id WHERE n.campaign_id=? AND n.trashed=0 AND json_extract(n.payload,'$.kind')='npc' ORDER BY name LIMIT 2000",
      )
      .all(cam)
      .map((r: any) => {
        const p = npcPosition(db, cam, r.id);
        const travel = r.travel ? JSON.parse(r.travel) : null;
        return {
          id: r.id,
          name: r.name,
          ...p,
          pose: npcDungeonPose(db, cam, r.id),
          traceRules: dungeonTraceRules(db, cam, null, r.id),
          destination: travel?.destination ?? null,
          path: travel?.route.slice(travel.nextIndex, travel.nextIndex + 64) ?? [],
          paused: !!r.paused,
          pending: r.pending ?? null,
        };
      });
  const journey = scene ? activeJourney(db, cam, scene.id) : null,
    at = journey && journey.nextIndex > 0 ? journey.route[journey.nextIndex - 1] : null,
    prior = journey && journey.nextIndex > 1 ? journey.route[journey.nextIndex - 2] : null,
    heading =
      p?.dungeon && journey?.positionRevision === p.revision && at && prior
        ? (Math.atan2(at.x - prior.x, prior.y - at.y) * 180) / Math.PI
        : null,
    room = p?.dungeon ? g.rooms.find((r) => r.id === p.dungeon!.roomId) : null,
    discovered = keyDiscoveries(db, cam, scene?.members ?? []),
    keyDescription = room
      ? renderDungeonKey(room, g.drawing.keyContent ?? [], g, {
          audience: 'gm',
          discovered,
          heading,
        })
      : undefined;
  return {
    ...g,
    ...(scene ? { travelPace: readDungeonPace(db, cam, scene.id) } : {}),
    keyDiscoveries: [...discovered],
    contents: dungeonContentContexts(db, cam, scene?.id ?? null, g),
    contentRecipients: (live.roster ?? [])
      .filter((m) => scene?.members.includes(m.id))
      .map((m) => ({ id: m.id, name: m.profile.name, membershipRevision: m.membershipRevision })),
    triggerEvents: readTriggerEvents(db, cam, scene?.id ?? null),
    keyDescription,
    keyHeading: heading,
    activeDungeonName: p?.dungeon
      ? (db
          .prepare('SELECT name FROM scope WHERE campaign_id=? AND id=?')
          .get(cam, p.dungeon.scopeId)?.name ?? null)
      : null,
    sceneId: scene?.id ?? null,
    sceneTitle: scene?.title ?? '',
    position: p?.dungeon ?? null,
    positionRevision: p?.revision ?? 0,
    clockRevision: scene?.clock.revision ?? 0,
    instantMs: scene?.clock.instantMs ?? '0',
    epochId: scene?.clock.epochId ?? '',
    journey: scene ? activeJourney(db, cam, scene.id) : null,
    npcs,
    tracks: dungeonTraces(db, cam),
    senses: dungeonSenseView(db, cam, scene?.id ?? null, g),
    traceRules: dungeonTraceRules(db, cam, scene?.id ?? null),
  };
}
export function previewDungeon(db: any, cam: string, r: DungeonRequest): DungeonPreview {
  if (r.useGroupPace !== undefined && typeof r.useGroupPace !== 'boolean')
    throw new Error('Tempoquelle prüfen.');
  const scene = readLiveScene(db, cam, r.sceneId),
    p = position(db, cam, r.sceneId),
    g = dungeonGeometry(db, cam);
  const travelPace = r.useGroupPace ? readDungeonPace(db, cam, r.sceneId) : null;
  if (travelPace) {
    if (r.movement !== undefined && r.movement !== travelPace.settings.movement)
      throw new Error('Bewegung zuerst unter Gruppentempo übernehmen.');
    const speed = travelPace.pace.metersPerMinute;
    if (speed === null || speed < 0.1) throw new Error(travelPace.pace.reason);
    r = { ...r, movement: travelPace.settings.movement, speedMetersPerMinute: speed };
  }
  if (!p.dungeon) throw new Error('Gruppe zuerst im Dungeon platzieren.');
  checkedPose(g, p.dungeon);
  checkedPose(g, r.destination);
  if (
    !scene.members.length ||
    !Number.isFinite(r.speedMetersPerMinute) ||
    r.speedMetersPerMinute < 0.1 ||
    r.speedMetersPerMinute > 1000 ||
    !Number.isFinite(r.factor) ||
    r.factor < 0.01 ||
    r.factor > 1000 ||
    (r.finalSeconds !== null &&
      (!Number.isSafeInteger(r.finalSeconds) || r.finalSeconds < 1 || r.finalSeconds > 100000000))
  )
    throw new Error('Gruppe, Tempo und Zeit prüfen.');
  let route: import('../dungeon-contracts').DungeonWaypoint[] = [],
    start = p.dungeon;
  for (const destination of [...(r.waypoints ?? []), r.destination]) {
    checkedPose(g, destination);
    route.push(
      ...planDungeon(g, start, destination, {
        movement: r.movement ?? p.dungeon.movement ?? 'walk',
      }),
    );
    start = destination;
  }
  route = refineTriggerRoute(g, p.dungeon, route, r.movement ?? p.dungeon.movement);
  if (route.length > 5000) throw new Error('Weg benötigt ein näheres Zwischenziel.');
  let prev = p.dungeon;
  const lengths = route.map((n) => {
      const length = Math.hypot(n.x - prev.x, n.y - prev.y, n.z - prev.z);
      prev = n;
      return length;
    }),
    distanceMeters = lengths.reduce((a, b) => a + b, 0),
    weights = lengths.map((l, i) => l * (route[i]!.factor ?? 1)),
    weighted = weights.reduce((a, b) => a + b, 0),
    fixed = route.reduce((n, p) => n + (p.additionalSeconds ?? 0), 0),
    durationSeconds =
      r.finalSeconds ??
      Math.max(1, Math.ceil((weighted / r.speedMetersPerMinute) * 60 * r.factor)) + fixed;
  if (durationSeconds < fixed)
    throw new Error('Gesamtdauer deckt die zusätzliche Passagenzeit nicht ab.');
  let cumulative = 0,
    last = 0;
  const segmentSeconds = weights.map((l, i) => {
    cumulative += l;
    const end =
        i === weights.length - 1
          ? durationSeconds - fixed
          : Math.round(
              (durationSeconds - fixed) *
                (weighted ? cumulative / weighted : (i + 1) / weights.length),
            ),
      seconds = end - last + (route[i]!.additionalSeconds ?? 0);
    last = end;
    return seconds;
  });
  return {
    ...(travelPace ? { pace: travelPace.pace, paceRevision: travelPace.settings.revision } : {}),
    request: r,
    basis: dungeonGeometryBasis(g, p.dungeon.scopeId),
    positionRevision: p.revision,
    clockRevision: scene.clock.revision,
    membershipRevision: scene.membershipRevision,
    actorIds: scene.members,
    route,
    distanceMeters,
    durationSeconds,
    segmentSeconds,
  };
}
function memory(db: any, cam: string, o: PlayerObserver, pose: DungeonPose) {
  const slice = Math.round(pose.z / 1.524),
    row = db
      .prepare(
        'SELECT * FROM dungeon_slice_memory WHERE campaign_id=? AND character_id=? AND scope_id=? AND slice_z=?',
      )
      .get(cam, o.characterId, pose.scopeId, slice);
  if (row) return parsed(row).polygons;
  const floor = db
    .prepare(
      'SELECT source_elevation FROM drawing_floor WHERE campaign_id=? AND scope_id=? AND id=?',
    )
    .get(cam, pose.scopeId, pose.floorId);
  if (!floor || Math.abs(pose.z - floor.source_elevation) > 0.01) return [];
  const legacy = db
    .prepare(
      'SELECT * FROM dungeon_memory WHERE campaign_id=? AND character_id=? AND scope_id=? AND floor_id=?',
    )
    .get(cam, o.characterId, pose.scopeId, pose.floorId);
  return legacy ? parsed(legacy).polygons : [];
}
function remember(db: any, cam: string, id: string, pose: DungeonPose, polygons: any[]) {
  const payload = JSON.stringify({ polygons });
  db.prepare(
    'INSERT INTO dungeon_slice_memory VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,character_id,scope_id,slice_z) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, id, pose.scopeId, Math.round(pose.z / 1.524), payload, hash(payload));
}

function revealed(db: any, cam: string, id: string) {
  return new Set<string>(
    db
      .prepare('SELECT room_id FROM dungeon_reveal WHERE campaign_id=? AND character_id=?')
      .all(cam, id)
      .map((r: any) => r.room_id),
  );
}
function observerFor(db: any, cam: string, id: string): PlayerObserver {
  const row = db
    .prepare("SELECT * FROM player_record WHERE campaign_id=? AND kind='observer' AND id=?")
    .get(cam, id);
  return row
    ? parsed(row)
    : {
        characterId: id,
        enabled: true,
        rangeMeters: 10000,
        darkvisionMeters: 0,
        eyeHeightMeters: 1.7,
      };
}
function settingsFor(db: any, cam: string): PlayerSettings {
  const r = db
    .prepare("SELECT * FROM player_record WHERE campaign_id=? AND kind='settings' AND id='main'")
    .get(cam);
  return r ? parsed(r) : ({ light: 'auto', labels: false } as PlayerSettings);
}
export function learnDungeon(db: any, cam: string, sceneId: string, geometry?: DungeonGeometry) {
  const scene = readLiveScene(db, cam, sceneId),
    p = position(db, cam, sceneId).dungeon;
  if (!p) return;
  const g = geometry ?? dungeonGeometry(db, cam),
    s = settingsFor(db, cam);
  for (const id of scene.members) {
    const o = observerFor(db, cam, id),
      seen = perception(g, p, o, s, revealed(db, cam, id));
    if (seen.length) remember(db, cam, id, p, unionPerception(memory(db, cam, o, p), seen));
  }
}
export function dungeonDisplay(
  db: any,
  cam: string,
  sceneId: string,
  s: PlayerSettings,
  list: PlayerObserver[],
  mapGeometry?: import('../dungeon-contracts').SpatialGeometry,
): DungeonDisplay | null {
  const p = position(db, cam, sceneId).dungeon;
  if (!p) return null;
  const authored = mapGeometry ? null : dungeonGeometry(db, cam),
    g = mapGeometry ?? authored!;
  if (!g.rooms.some((r) => r.id === p.roomId)) return null;
  let known: any[] = [],
    visible: any[] = [];
  for (const o of list) {
    known = unionPerception(known, memory(db, cam, o, p));
    visible = unionPerception(visible, perception(g, p, o, s, revealed(db, cam, o.characterId)));
  }
  known = unionPerception(known, visible);
  const labels = s.labels
      ? g.drawing.styles
          .filter((t) => t.publicLabel)
          .flatMap((t) => {
            const room = g.rooms.find(
              (r) => r.id === t.id && r.scopeId === p.scopeId && r.floorId === p.floorId,
            );
            if (!room) return [];
            const point = centerInRoom(room);
            return inside(point, known) ? [{ point, text: t.publicLabel }] : [];
          })
      : [],
    markers = g.drawing.elements
      .filter(
        (e) =>
          !e.archived &&
          !e.secret &&
          e.scopeId === p.scopeId &&
          e.floorId === p.floorId &&
          ['door', 'stairs'].includes(e.kind) &&
          inside(e.points[0]!, visible),
      )
      .map((e) => ({
        point: e.points[0]!,
        kind: e.kind as 'door' | 'stairs',
        open: e.state === 'open',
      }));
  const sense = dungeonSenseView(db, cam, sceneId, g),
    assets = db
      .prepare("SELECT subject_id,payload FROM player_asset WHERE campaign_id=? AND kind='npc'")
      .all(cam),
    npcMarkers = sense.observations
      .filter((o) => o.subjectKind === 'actor' && o.known && o.visible && o.override !== 'unknown')
      .flatMap((o) => {
        const pose = npcDungeonPose(db, cam, o.subjectId);
        if (
          !pose ||
          pose.scopeId !== p.scopeId ||
          pose.floorId !== p.floorId ||
          (o.override !== 'known' && !inside(pose, visible))
        )
          return [];
        const art = assets.find((a: any) => a.subject_id === o.subjectId);
        return [
          {
            point: { x: pose.x, y: pose.y },
            kind: 'npc' as const,
            open: true,
            label: art ? JSON.parse(art.payload).title : '',
          },
        ];
      }),
    clues = [
      ...new Set(
        sense.observations
          .filter(
            (o: any) =>
              o.subjectKind === 'sound' &&
              o.heard &&
              o.publicText &&
              o.scopeId === p.scopeId &&
              o.floorId === p.floorId,
          )
          .map((o) => o.publicText!),
      ),
    ],
    tracks = sense.observations
      .filter(
        (o) =>
          o.subjectKind === 'track' &&
          o.known &&
          !db
            .prepare(
              "SELECT 1 FROM dungeon_track_adjustment WHERE campaign_id=? AND id=? AND json_extract(payload,'$.hidden')=1",
            )
            .get(cam, o.subjectId),
      )
      .flatMap((o: any) =>
        o.to?.scopeId === p.scopeId &&
        o.to?.floorId === p.floorId &&
        inside(o.from, known) &&
        inside(o.to, known)
          ? [
              {
                from: { x: o.from.x, y: o.from.y },
                to: { x: o.to.x, y: o.to.y },
                label: o.publicText ?? 'Spuren',
              },
            ]
          : [],
      );
  if (mapGeometry)
    return {
      position: { x: p.x, y: p.y },
      floorLabel: 'Höhe ' + p.z.toFixed(2) + ' m',
      known,
      visible,
      labels,
      markers: [...markers, ...npcMarkers],
      clues,
      tracks,
    };
  const full = authored!,
    room = full.rooms.find((r) => r.id === p.roomId)!;
  const surfaceIds = new Set(
    (full.drawing.keyContent ?? [])
      .filter(
        (c) =>
          c.kind === 'surface' &&
          surfaceWorldFaces(c, full).some((f) =>
            list.some(
              (o) =>
                o.enabled &&
                seen3D(
                  g,
                  p,
                  f.pose,
                  Math.min(o.rangeMeters, 18),
                  o.darkvisionMeters,
                  s.light,
                  o.eyeHeightMeters,
                ),
            ),
          ),
      )
      .map((c) => c.id),
  );
  const description = renderDungeonKey(room, full.drawing.keyContent ?? [], full, {
    surfaceIds,
    audience: 'public',
    discovered: keyDiscoveries(
      db,
      cam,
      list.map((o) => o.characterId),
    ),
    heading: keyHeading(db, cam, sceneId),
  }).text;
  const content = dungeonContentContexts(
    db,
    cam,
    sceneId,
    full,
    list.filter((o) => o.enabled).map((o) => o.characterId),
  )
    .filter((c) => c.known && c.visible && c.publicText)
    .map((c) => c.publicText);
  return {
    description: [description, ...content].join('\n\n'),
    position: { x: p.x, y: p.y },
    floorLabel: 'Höhe ' + p.z.toFixed(2) + ' m',
    known,
    visible,
    labels,
    markers: [...markers, ...npcMarkers],
    clues,
    tracks,
  };
}
/** The receipt is authoritative even if rebuilding the travel view currently fails. */
export function dungeonCommandState(
  db: any,
  c: import('../dungeon-contracts').DungeonCommand,
): import('../dungeon-contracts').DungeonCommandState {
  if (typeof c.commandId !== 'string' || !c.commandId)
    throw new Error('Dungeonauftragskennung prüfen.');
  const row = db
    .prepare('SELECT campaign_id,fingerprint FROM dungeon_receipt WHERE command_id=?')
    .get(c.commandId);
  return {
    outcome: !row
      ? 'not-applied'
      : row.campaign_id === c.campaignId &&
          row.fingerprint === hash(JSON.stringify({ ...c, token: undefined }))
        ? 'applied'
        : 'conflict',
  };
}
export function executeDungeon(
  db: any,
  c: DungeonCommand,
  guard: () => void,
  liveWrite: (command: LiveCommand) => unknown,
  combatWrite: (command: CombatCommand) => unknown,
  progressWrite: (command: ProgressCommand) => unknown,
) {
  return db
    .transaction(() => {
      guard();
      const cam = c.campaignId,
        fp = hash(JSON.stringify({ ...c, token: undefined })),
        receipt = db
          .prepare('SELECT fingerprint FROM dungeon_receipt WHERE command_id=?')
          .get(c.commandId);
      if (receipt) {
        if (receipt.fingerprint !== fp)
          throw new Error('Dungeonänderungskennung anders verwendet.');
        return dungeonView(db, cam);
      }
      const a = c.action,
        g = dungeonGeometry(db, cam);
      if (a.kind === 'track-correct') {
        correctDungeonTrack(db, cam, a.id, a.dc, a.hidden, a.publicText);
      } else if (a.kind === 'npc-place') {
        placeNpcDungeon(db, cam, a.actorId, a.pose, a.expectedRevision, g);
      } else {
        const sceneId = a.kind === 'journey' ? a.preview.request.sceneId : a.sceneId,
          scene = readLiveScene(db, cam, sceneId),
          p = position(db, cam, sceneId);
        if (scene.retired || !scene.members.length)
          throw new Error('Eine aktive Gruppe auswählen.');
        if (a.kind === 'pace-settings') {
          if (a.settings.sceneId !== sceneId)
            throw new Error('Tempovorgaben gehören zu einer anderen Gruppe.');
          saveDungeonPace(db, cam, a.settings, a.expectedMembershipRevision);
        } else if (
          a.kind === 'content-discovery' ||
          a.kind === 'content-dismiss' ||
          a.kind === 'content-bind' ||
          a.kind === 'content-combat' ||
          a.kind === 'content-allocate'
        ) {
          const e = g.drawing.elements.find(
            (e) => e.id === a.featureId && !e.archived && e.kind === 'feature',
          );
          if (!e) throw new Error('Dungeon-Inhalt fehlt.');
          if (a.kind !== 'content-dismiss' && e.revision !== a.expectedRevision)
            throw new Error('Dungeon-Inhalt geändert.');
          if (a.kind === 'content-discovery') {
            confirmFeatureDiscovery(db, cam, scene.members, e.id, a.known);
            dismissContentSignal(db, cam, sceneId, e.id);
          } else if (a.kind === 'content-dismiss') {
            dismissContentSignal(db, cam, sceneId, e.id);
            const j = activeJourney(db, cam, sceneId);
            if (j?.status === 'paused' && j.reason.startsWith('Dungeon-Inhalt'))
              saveJourney(db, cam, {
                ...j,
                revision: j.revision + 1,
                status: 'active',
                reason: '',
              });
          } else {
            const ctx = dungeonContentContexts(db, cam, sceneId, g).find((ctx) => ctx.id === e.id);
            if (
              !ctx?.pose ||
              !p.dungeon ||
              ctx.pose.scopeId !== p.dungeon.scopeId ||
              Math.hypot(
                ctx.pose.x - p.dungeon.x,
                ctx.pose.y - p.dungeon.y,
                ctx.pose.z - p.dungeon.z,
              ) > 18
            )
              throw new Error('Gruppe zuerst in den räumlichen Inhaltskontext bringen.');
            if (a.kind === 'content-bind' || a.kind === 'content-combat') {
              if (e.feature !== 'encounter') throw new Error('Dieser Inhalt ist kein Encounter.');
              const group = bindDungeonGroup(db, cam, e, g);
              if (a.kind === 'content-combat') {
                if (a.expectedGroupRevision !== null && group.revision !== a.expectedGroupRevision)
                  throw new Error('NPC-Gruppe geändert.');
                let state = contentState(db, cam, e.id),
                  reuse = state.combatId
                    ? db
                        .prepare('SELECT phase,scene_id FROM combat WHERE campaign_id=? AND id=?')
                        .get(cam, state.combatId)
                    : null,
                  active = reuse && ['preparing', 'running'].includes(reuse.phase);
                if (active && reuse.scene_id !== sceneId)
                  throw new Error('Diese Actor kämpfen bereits in einer anderen laufenden Gruppe.');
                if (!active) {
                  const actors = group.actors.filter((actor) => !actor.unavailable && actor.hp > 0);
                  if (!actors.length)
                    throw new Error('Keine lebenden Actor in dieser Encountergruppe.');
                  const result = combatWrite({
                    commandId: c.commandId + ':content-combat',
                    token: c.token,
                    campaignId: cam,
                    combatId: null,
                    expectedRevision: null,
                    action: {
                      kind: 'create',
                      sceneId,
                      title: e.name || group.title,
                      includeParty: true,
                      expectedMembershipRevision: scene.membershipRevision,
                      preparedGroupId: group.id,
                      expectedPreparedRevision: group.revision,
                      worldActorIds: actors.map((a) => a.id),
                    },
                  }) as import('../combat-contracts').CombatView;
                  state = {
                    ...state,
                    revision: state.revision + 1,
                    combatId: result.combat?.id ?? null,
                  };
                  saveContentState(db, cam, state);
                }
                dismissContentSignal(db, cam, sceneId, e.id);
              }
            } else {
              if (!ctx.known) throw new Error('Loot zuerst für die Gruppe ausdrücklich entdecken.');
              if (
                e.feature !== 'loot' ||
                e.content?.reference?.kind !== 'treasure' ||
                !scene.members.includes(a.characterId)
              )
                throw new Error('Loot und Empfänger müssen zum laufenden Gruppenkontext gehören.');
              progressWrite({
                commandId: c.commandId + ':content-loot',
                token: c.token,
                campaignId: cam,
                action: {
                  kind: 'allocate',
                  treasureId: e.content.reference.id,
                  expectedRevision: a.treasureRevision,
                  expectedDefinitionRevision: a.definitionRevision,
                  itemId: a.itemId,
                  quantity: a.quantity,
                  characterId: a.characterId,
                  expectedMembershipRevision: a.membershipRevision,
                },
              });
            }
          }
        } else if (a.kind === 'trigger-event') {
          const event = readTriggerEvents(db, cam, sceneId).find((e) => e.id === a.eventId);
          if (!event || event.revision !== a.expectedRevision)
            throw new Error('Triggerkontext geändert.');
          if (a.operation === 'activate' && !event.activated) {
            const feature = g.drawing.elements.find((e) => e.id === event.trapId && !e.archived);
            if (!feature) throw new Error('Falle ist nicht mehr aktiv zugeordnet.');
            const state = g.drawing.features.find((s) => s.id === feature.id);
            activateDungeonFeature(
              db,
              cam,
              event.trapId,
              sceneId,
              state?.revision ?? 0,
              'activate',
              null,
              'trigger-activation:' + event.id,
            );
            event.activated = true;
            event.activatedMs = readLiveScene(db, cam, sceneId).clock.instantMs;
          } else if (a.operation === 'dismiss') event.status = 'dismissed';
          else if (a.operation === 'abort') event.status = 'aborted';
          else if (a.operation === 'reopen') event.status = 'open';
          event.revision++;
          saveTriggerEvent(db, cam, event);
          const journey = activeJourney(db, cam, sceneId);
          if (
            journey &&
            journey.triggerEventId === event.id &&
            (a.operation === 'dismiss' || a.operation === 'abort')
          ) {
            if (a.operation === 'abort') {
              journey.status = 'ended';
              journey.reason = 'Reise am Triggerkontext abgebrochen.';
            } else {
              const pending = readTriggerEvents(db, cam, sceneId).find(
                (e) =>
                  e.journeyId === journey.id &&
                  e.routeIndex === journey.nextIndex - 1 &&
                  e.mode === 'interrupt' &&
                  e.status === 'open' &&
                  e.id !== event.id,
              );
              journey.triggerEventId = pending?.id ?? null;
              journey.featureId = pending?.trapId ?? null;
              journey.status = pending
                ? 'decision'
                : journey.nextIndex === journey.route.length
                  ? 'arrived'
                  : 'active';
              journey.reason = pending ? 'Weiterer Triggerkontext wartet auf GM-Klärung.' : '';
            }
            journey.revision++;
            saveJourney(db, cam, journey);
          }
        } else if (a.kind === 'key-discovery') {
          revealKey(db, cam, a.roomId, a.subjectId, scene.members, a.known);
        } else if (a.kind === 'passage-traverse') {
          const passage = g.drawing.passages?.find((p) => p.id === a.passageId);
          if (
            !passage ||
            passage.revision !== a.expectedRevision ||
            !passage.assigned ||
            !p.dungeon
          )
            throw new Error('Passage geändert oder ungebunden.');
          const side = passage[a.side],
            anchor = passageLanding(g, passage);
          if (!side.passable) throw new Error('Diese Passagenseite ist nicht begehbar.');
          if (
            p.dungeon.scopeId !== anchor.scopeId ||
            p.dungeon.floorId !== anchor.floorId ||
            p.dungeon.roomId !== anchor.roomId ||
            Math.hypot(p.dungeon.x - anchor.x, p.dungeon.y - anchor.y, p.dungeon.z - anchor.z) >
              3.048
          )
            throw new Error('Gruppe zuerst an die Passage bringen.');
          if (side.target.kind === 'geometry')
            throw new Error('Geometrische Passage über den normalen Dungeonweg nutzen.');
          let landing: import('../dungeon-contracts').DungeonPose | null = null,
            locationId: string | null = null;
          if (side.target.kind === 'passage') {
            const target = g.drawing.passages?.find((p) => p.id === side.target.id && p.assigned);
            if (!target)
              throw new Error(
                'Passagenziel fehlt. Lokale Passage und Beschreibung bleiben erhalten.',
              );
            landing = { ...passageLanding(g, target), movement: a.movement };
            checkedPose(g, landing);
            locationId =
              db
                .prepare('SELECT location_id FROM location_map WHERE campaign_id=? AND scope_id=?')
                .get(cam, landing.scopeId)?.location_id ?? null;
          } else {
            if (
              !db
                .prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0')
                .get(cam, side.target.id)
            )
              throw new Error('Kampagnenort des Links fehlt.');
            locationId = side.target.id;
          }
          if (side.additionalSeconds) {
            const clock = readLiveScene(db, cam, sceneId).clock;
            liveWrite({
              commandId: c.commandId + ':passage-time',
              token: c.token,
              campaignId: cam,
              action: {
                kind: 'advance-clock',
                sceneId,
                expectedRevision: clock.revision,
                amount: side.additionalSeconds,
                unit: 'seconds',
                calendarVersion: 'relative-v1',
                reason: 'Bestätigter Passagenlink',
              },
            });
          }
          const currentScene = readLiveScene(db, cam, sceneId);
          if (locationId !== currentScene.locationId)
            liveWrite({
              commandId: c.commandId + ':passage-location',
              token: c.token,
              campaignId: cam,
              action: {
                kind: 'scene-content',
                sceneId,
                expectedRevision: currentScene.revision,
                title: currentScene.title,
                notes: currentScene.notes,
                readAloud: currentScene.readAloud,
                locationId,
              },
            });
          const actual = position(db, cam, sceneId);
          savePosition(db, cam, sceneId, {
            ...actual,
            revision: actual.revision + 1,
            dungeon: landing,
          });
          const journey = activeJourney(db, cam, sceneId);
          if (journey && !['ended', 'arrived'].includes(journey.status))
            saveJourney(db, cam, {
              ...journey,
              revision: journey.revision + 1,
              status: 'ended',
              reason: 'GM hat einen Passagenlink benutzt.',
            });
          if (landing) {
            learnDungeon(db, cam, sceneId, g);
            evaluateContents(db, cam, sceneId, g);
            evaluateDungeonSenses(db, cam, sceneId, g);
          }
        } else if (a.kind === 'trace-rules') {
          saveDungeonTraceRules(db, cam, sceneId, a.actorId, a.rules);
        } else if (a.kind === 'trace-add') {
          checkedPose(g, a.from);
          checkedPose(g, a.to);
          const path = planDungeon(g, a.from, a.to);
          addDungeonTrace(
            db,
            cam,
            sceneId,
            a.from,
            a.to,
            [a.from, ...path],
            a.actorId,
            a.sourceKnown,
            a.publicText,
            a.dc,
            a.strength,
          );
        } else if (a.kind === 'pursue') {
          const prepared = startPursuit(
              db,
              cam,
              sceneId,
              a.traceId,
              a.score,
              a.direction,
              a.skill,
              (r) => previewDungeon(db, cam, r),
            ),
            old = activeJourney(db, cam, sceneId);
          if (old && !['arrived', 'ended'].includes(old.status))
            saveJourney(db, cam, {
              ...old,
              revision: old.revision + 1,
              status: 'ended',
              reason: 'GM bestätigt eine neue Spurverfolgung.',
            });
          saveJourney(db, cam, {
            ...prepared,
            id: randomUUID(),
            revision: 1,
            nextIndex: 0,
            status: 'active',
            reason: 'Folgt bestätigter Spur.',
            featureId: null,
            authorizedFeatures: [],
          });
        } else if (a.kind === 'pursuit-check') {
          const j = activeJourney(db, cam, sceneId);
          if (
            !j?.pursuit ||
            j.id !== a.id ||
            j.revision !== a.expectedRevision ||
            j.status !== 'decision'
          )
            throw new Error('Verfolgung zuerst aktualisieren.');
          continuePursuit(db, cam, j, a.score, a.traceId, (r) => previewDungeon(db, cam, r));
          j.revision++;
          saveJourney(db, cam, j);
        } else if (a.kind === 'senses') {
          executeDungeonSense(db, cam, sceneId, a.action, g);
          evaluateContents(db, cam, sceneId, g, a.action.score);
        } else if (a.kind === 'sound') {
          checkedPose(g, a.pose);
          emitDungeonSound(
            db,
            cam,
            a.pose,
            scene.clock.epochId,
            scene.clock.instantMs,
            a.publicText,
            a.rangeMeters,
            a.dc,
          );
          evaluateDungeonSenses(db, cam, sceneId, g);
        } else if (a.kind === 'encounter') {
          if (!p.dungeon) throw new Error('Gruppe zuerst im Dungeon platzieren.');
          const group = readPreparedGroup(db, cam, a.groupId);
          if (group.revision !== a.expectedGroupRevision) throw new Error('NPC-Gruppe geändert.');
          const actorIds = group.actors
            .filter((actor) => actor.hp > 0)
            .filter((actor) => {
              const pose = npcDungeonPose(db, cam, actor.id);
              return (
                pose?.scopeId === p.dungeon!.scopeId &&
                pose.floorId === p.dungeon!.floorId &&
                Math.hypot(pose.x - p.dungeon!.x, pose.y - p.dungeon!.y) <= 30
              );
            })
            .map((actor) => actor.id);
          if (!actorIds.length)
            throw new Error('Keine lebenden Gruppenmitglieder in der Nähe der Party.');
          combatWrite({
            commandId: c.commandId + ':encounter',
            token: c.token,
            campaignId: cam,
            combatId: null,
            expectedRevision: null,
            action: {
              kind: 'create',
              sceneId,
              title: group.title,
              includeParty: true,
              expectedMembershipRevision: scene.membershipRevision,
              preparedGroupId: group.id,
              expectedPreparedRevision: group.revision,
              worldActorIds: actorIds,
            },
          });
        } else if (a.kind === 'place') {
          if (a.expectedPositionRevision !== p.revision)
            throw new Error('Gruppenposition geändert.');
          if (a.pose) {
            checkedPose(g, a.pose);
            if (
              db
                .prepare(
                  "SELECT 1 FROM world_journey WHERE campaign_id=? AND scene_id=? AND status IN('active','paused','interrupted')",
                )
                .get(cam, sceneId)
            )
              throw new Error('Weltreise zuerst beenden.');
            const binding = db
              .prepare('SELECT location_id FROM location_map WHERE campaign_id=? AND scope_id=?')
              .get(cam, a.pose.scopeId);
            if (binding && binding.location_id !== scene.locationId)
              liveWrite({
                commandId: c.commandId + ':location',
                token: c.token,
                campaignId: cam,
                action: {
                  kind: 'scene-content',
                  sceneId,
                  expectedRevision: scene.revision,
                  title: scene.title,
                  notes: scene.notes,
                  readAloud: scene.readAloud,
                  locationId: binding.location_id,
                },
              });
          }
          const actual = position(db, cam, sceneId);
          savePosition(db, cam, sceneId, {
            ...actual,
            revision: actual.revision + 1,
            dungeon: a.pose,
          });
          const j = activeJourney(db, cam, sceneId);
          if (j && !['arrived', 'ended'].includes(j.status))
            saveJourney(db, cam, {
              ...j,
              revision: j.revision + 1,
              status: 'ended',
              reason: 'GM hat die Gruppenposition gesetzt.',
            });
          learnDungeon(db, cam, sceneId, g);
          evaluateContents(db, cam, sceneId, g, null, { activateEvents: false });
          evaluateDungeonSenses(db, cam, sceneId, g);
        } else if (a.kind === 'reveal') {
          const room = g.rooms.find((r) => r.id === a.roomId);
          if (!room) throw new Error('Raum fehlt.');
          const pose = {
            ...centerInRoom(room),
            scopeId: room.scopeId,
            floorId: room.floorId,
            roomId: room.id,
            z: g.floors.find((f) => f.id === room.floorId && f.scopeId === room.scopeId)!.elevation,
          };
          for (const id of scene.members) {
            if (a.known) {
              db.prepare('INSERT OR IGNORE INTO dungeon_reveal VALUES(?,?,?)').run(
                cam,
                id,
                room.id,
              );
              const o = observerFor(db, cam, id);
              remember(db, cam, id, pose, unionPerception(memory(db, cam, o, pose), room.polygons));
            } else {
              db.prepare(
                'DELETE FROM dungeon_reveal WHERE campaign_id=? AND character_id=? AND room_id=?',
              ).run(cam, id, room.id);
              const o = observerFor(db, cam, id);
              remember(db, cam, id, pose, carveRoom(memory(db, cam, o, pose), room.polygons));
            }
          }
          learnDungeon(db, cam, sceneId, g);
          evaluateContents(db, cam, sceneId, g);
        } else if (a.kind === 'journey') {
          const fresh = previewDungeon(db, cam, a.preview.request);
          if (JSON.stringify(fresh) !== JSON.stringify(a.preview))
            throw new Error('Wegvorschau geändert. Neu berechnen.');
          const old = activeJourney(db, cam, sceneId);
          if (old && !['arrived', 'ended'].includes(old.status))
            saveJourney(db, cam, {
              ...old,
              revision: old.revision + 1,
              status: 'ended',
              reason: 'Neue Route bestätigt.',
            });
          saveJourney(db, cam, {
            ...fresh,
            id: randomUUID(),
            revision: 1,
            nextIndex: 0,
            status: 'active',
            reason: '',
            featureId: null,
            authorizedFeatures: [],
          });
        } else {
          const j = activeJourney(db, cam, sceneId);
          if (!j || j.id !== a.id || j.revision !== a.expectedRevision)
            throw new Error('Dungeonreise geändert.');
          if (a.kind === 'state') {
            if (
              !['active', 'paused', 'ended'].includes(a.status) ||
              ['arrived', 'ended'].includes(j.status)
            )
              throw new Error('Reisestatus prüfen.');
            if (j.status === 'decision' && j.pursuit && a.status === 'active')
              throw new Error('Verfolgung mit einer neuen Prüfung und Spurwahl fortsetzen.');
            if (j.status === 'decision' && j.triggerEventId && a.status === 'active')
              throw new Error('Den Triggerkontext ausdrücklich schließen und fortsetzen.');
            if (j.status === 'decision' && a.status === 'active') {
              if (a.authorizeFeatureId !== j.featureId)
                throw new Error('Fallendurchgang ausdrücklich freigeben.');
              j.authorizedFeatures.push(j.featureId!);
            }
            if (a.status === 'ended' && j.triggerEventId) {
              const event = readTriggerEvents(db, cam, sceneId).find(
                (e) => e.id === j.triggerEventId,
              );
              if (event?.status === 'open') {
                event.status = 'aborted';
                event.revision++;
                saveTriggerEvent(db, cam, event);
              }
              j.triggerEventId = null;
            }
            j.status = a.status;
            j.reason = '';
            j.featureId = null;
            j.revision++;
            saveJourney(db, cam, j);
          } else {
            const round = a.kind === 'round',
              settings = round ? readDungeonPace(db, cam, sceneId).settings : null;
            if (
              round &&
              (settings!.revision !== a.expectedSettingsRevision ||
                readLive(db, cam).focusId !== sceneId)
            )
              throw new Error('Rundenstand oder Fokus geändert. Dungeonreise aktualisieren.');
            const maxSteps = round ? Math.max(1, j.route.length) : a.maxSteps;
            if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || (!round && maxSteps > 24))
              throw new Error('Schrittzahl prüfen.');
            let remaining = round ? (settings!.explorationRoundSeconds ?? 600) : Infinity;
            if (j.status !== 'active') throw new Error('Reise ist angehalten.');
            let pose = p.dungeon;
            if (
              !pose ||
              p.revision !== j.positionRevision ||
              scene.clock.revision !== j.clockRevision ||
              scene.membershipRevision !== j.membershipRevision ||
              JSON.stringify(scene.members) !== JSON.stringify(j.actorIds) ||
              dungeonGeometryBasis(g, pose.scopeId) !== j.basis
            ) {
              j.status = 'paused';
              j.reason = 'Position, Gruppe, Zeit oder Geometrie geändert. Route neu vorbereiten.';
              j.revision++;
              saveJourney(db, cam, j);
            } else {
              for (
                let step = 0;
                step < maxSteps && j.nextIndex < j.route.length && remaining > 0;
                step++
              ) {
                const problem = pursuitGuard(db, cam, j);
                if (problem) {
                  j.status = 'decision';
                  j.reason = problem;
                  j.pursuit!.state = 'check';
                  j.pursuit!.reason = problem;
                  break;
                }
                const next = j.route[j.nextIndex]!;
                const from = pose,
                  elapsed = j.segmentElapsedSeconds ?? 0,
                  planned = j.segmentSeconds[j.nextIndex]!;
                if (!Number.isSafeInteger(elapsed) || elapsed < 0 || elapsed > planned)
                  throw new Error('Gespeicherter Rundenfortschritt ungültig.');
                const seconds = Math.min(planned - elapsed, remaining);
                remaining -= seconds;
                if (seconds > 0) {
                  const clock = readLiveScene(db, cam, sceneId).clock;
                  liveWrite({
                    commandId: c.commandId + ':time:' + j.nextIndex,
                    token: c.token,
                    campaignId: cam,
                    action: {
                      kind: 'advance-clock',
                      sceneId,
                      expectedRevision: clock.revision,
                      amount: seconds,
                      unit: 'seconds',
                      calendarVersion: 'relative-v1',
                      reason: 'Dungeonbewegung',
                    },
                  });
                }
                j.clockRevision = readLiveScene(db, cam, sceneId).clock.revision;
                if (elapsed + seconds < planned) {
                  j.segmentElapsedSeconds = elapsed + seconds;
                  learnDungeon(db, cam, sceneId, g);
                  const contentOpened = evaluateContents(db, cam, sceneId, g),
                    detected = evaluateDungeonSenses(db, cam, sceneId, g),
                    persisted = activeJourney(db, cam, sceneId);
                  if (persisted?.status === 'paused' && persisted.revision > j.revision) {
                    j.revision = persisted.revision;
                    j.status = 'paused';
                    j.reason = persisted.reason;
                  }
                  if (contentOpened.length || detected.length) {
                    j.status = 'paused';
                    j.reason =
                      'Während der Bewegung ist ein Inhalt oder NPC wahrnehmbar. Als GM klären.';
                  }
                  break;
                }
                delete j.segmentElapsedSeconds;
                const current = position(db, cam, sceneId);
                pose = {
                  x: next.x,
                  y: next.y,
                  z: next.z,
                  scopeId: next.scopeId,
                  floorId: next.floorId,
                  roomId: next.roomId,
                  movement: j.request.movement ?? pose.movement ?? 'walk',
                };
                savePosition(db, cam, sceneId, {
                  ...current,
                  revision: current.revision + 1,
                  dungeon: pose,
                });
                j.positionRevision = current.revision + 1;
                j.clockRevision = readLiveScene(db, cam, sceneId).clock.revision;
                j.nextIndex++;
                recordDungeonTrace(db, cam, {
                  actorId: null,
                  sceneId,
                  characterIds: scene.members,
                  from,
                  to: pose,
                  jobId: null,
                  epochId: scene.clock.epochId,
                  instantMs: readLiveScene(db, cam, sceneId).clock.instantMs,
                  surface: pose.movement === 'swim' ? 'water' : 'stone',
                  movement: pose.movement ?? 'walk',
                });
                const events = createTriggerEvents(
                    db,
                    cam,
                    g,
                    j,
                    from,
                    pose,
                    readLiveScene(db, cam, sceneId).clock.instantMs,
                  ),
                  interrupt = events.find((e) => e.mode === 'interrupt' && e.status === 'open');
                if (interrupt) {
                  j.status = 'decision';
                  j.featureId = interrupt.trapId;
                  j.triggerEventId = interrupt.id;
                  j.reason =
                    'Triggerfeld betreten: ' +
                    interrupt.fieldNames.join(', ') +
                    '. Beschreibung öffnen; tatsächliche Aktivierung als GM bestätigen oder Kontext schließen.';
                  learnDungeon(db, cam, sceneId, g);
                  evaluateContents(db, cam, sceneId, g);
                  evaluateDungeonSenses(db, cam, sceneId, g);
                  break;
                }
                learnDungeon(db, cam, sceneId, g);
                const contentOpened = evaluateContents(db, cam, sceneId, g);
                if (contentOpened.length) {
                  j.status = 'paused';
                  j.reason =
                    'Dungeon-Inhalt ist wahrnehmbar oder hat einen privaten Suchhinweis. Kontext als GM klären.';
                  break;
                }
                const detected = evaluateDungeonSenses(db, cam, sceneId, g);
                const persisted = activeJourney(db, cam, sceneId);
                if (persisted?.status === 'paused' && persisted.revision > j.revision) {
                  j.revision = persisted.revision;
                  j.status = 'paused';
                  j.reason = persisted.reason;
                }
                if (detected.length || j.status === 'paused') {
                  j.status = 'paused';
                  j.reason = 'Neue NPC-Wahrnehmung. Als GM klären oder Begegnung vorbereiten.';
                  break;
                }
              }
              if (j.nextIndex === j.route.length && j.status === 'active') {
                if (j.pursuit)
                  continuePursuit(db, cam, j, j.pursuit.score, null, (r) =>
                    previewDungeon(db, cam, r),
                  );
                else {
                  j.status = 'arrived';
                  j.reason = 'Ziel erreicht.';
                }
              }
              j.revision++;
              saveJourney(db, cam, j);
            }
          }
        }
      }
      db.prepare('INSERT INTO dungeon_receipt VALUES(?,?,?)').run(cam, c.commandId, fp);
      return dungeonView(db, cam);
    })
    .immediate();
}
export function validateDungeonPlay(db: any) {
  validateDungeonPaces(db);
  for (const row of db.prepare('SELECT * FROM dungeon_journey').iterate()) {
    const j = checkedPartial(parsed(row));
    if (j.id !== row.id || j.request.sceneId !== row.scene_id || j.revision !== row.revision)
      throw new Error('Dungeonreiseidentität widersprüchlich.');
    if (j.triggerEventId) {
      const eventRow = db
          .prepare('SELECT * FROM dungeon_trigger_event WHERE campaign_id=? AND id=?')
          .get(row.campaign_id, j.triggerEventId),
        event = eventRow ? parsed(eventRow) : null;
      if (
        !event ||
        event.id !== j.triggerEventId ||
        event.sceneId !== row.scene_id ||
        event.journeyId !== j.id
      )
        throw Error('Dungeonreise verweist auf einen fehlenden oder fremden Triggerkontext.');
    }
  }
  for (const table of ['dungeon_memory', 'npc_dungeon_position'])
    for (const row of db.prepare('SELECT * FROM ' + table).iterate()) parsed(row);
}
