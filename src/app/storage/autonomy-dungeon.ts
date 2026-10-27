import { createHash, randomUUID } from 'node:crypto';
import { validateDrawingElement } from '../atlas/drawing-contracts';
import { inside } from '../atlas/drawing-model';
import type { DungeonGeometry, DungeonPose, DungeonTraceRules } from '../atlas/dungeon-contracts';
import { centerInRoom, planDungeon, trapEntry } from '../atlas/dungeon-model';
import { validateDungeonPassage, validateDungeonPath } from '../atlas/path-contracts';
import { seen3D } from '../atlas/spatial-3d';
import { MAX_VOLUME_CELLS, MAX_VOLUME_COLUMNS } from '../atlas/volume-contracts';
import type {
  AutonomyActor,
  AutonomyDungeonTravel,
  AutonomyJob,
} from '../runtime/autonomy-contracts';
import { validateRoom } from '../shared/room-validation';
import { npcHearsParty, recordDungeonTrace, rememberNpcParty } from './dungeon-senses';
import { placeNpcDungeon } from './npc-dungeon';
import { npcPosition } from './npc-world';
import { readDungeonPassages, readDungeonPaths } from './paths';
import { readTriggerFields } from './triggers';
import { readDungeonVolumes } from './volume';
const hash = (p: string) => createHash('sha256').update(p).digest('hex'),
  parsed = (r: any) => {
    if (!r || hash(r.payload) !== r.checksum)
      throw new Error('Bestätigter NPC-Dungeonstand fehlt oder ist beschädigt.');
    return JSON.parse(r.payload);
  };
export function installAutonomyDungeonSchema(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS autonomy_dungeon_basis(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,stamp TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),UNIQUE(campaign_id,stamp)) STRICT;`,
  );
}
function owners(db: any, cam: string, scopeId: string) {
  return {
    scopeId,
    triggerFields: db
      .prepare('SELECT id,revision FROM dungeon_trigger_field WHERE campaign_id=? AND scope_id=?')
      .all(cam, scopeId),
    locationId:
      db
        .prepare('SELECT location_id FROM location_map WHERE campaign_id=? AND scope_id=?')
        .get(cam, scopeId)?.location_id ?? null,
    rooms: db
      .prepare('SELECT id,revision FROM room WHERE campaign_id=? AND scope_id=?')
      .all(cam, scopeId),
    elements: db
      .prepare('SELECT id,revision FROM drawing_element WHERE campaign_id=? AND scope_id=?')
      .all(cam, scopeId),
    paths: db
      .prepare('SELECT id,revision FROM dungeon_path WHERE campaign_id=? AND scope_id=?')
      .all(cam, scopeId),
    passages: db
      .prepare('SELECT id,revision FROM dungeon_passage WHERE campaign_id=? AND scope_id=?')
      .all(cam, scopeId),
    volumes: db
      .prepare('SELECT id,revision FROM dungeon_volume WHERE campaign_id=? AND scope_id=?')
      .all(cam, scopeId),
    styles: db
      .prepare('SELECT id,revision FROM drawing_profile WHERE campaign_id=? AND scope_id=?')
      .all(cam, scopeId),
    floors: db
      .prepare(
        'SELECT id,source_elevation elevation FROM drawing_floor WHERE campaign_id=? AND scope_id=?',
      )
      .all(cam, scopeId),
    hidden: db
      .prepare(
        'SELECT id,kind,hidden,revision FROM drawing_hidden WHERE campaign_id=? AND scope_id=?',
      )
      .all(cam, scopeId),
  };
}
function ordered(o: any) {
  return {
    ...o,
    ...Object.fromEntries(
      [
        'rooms',
        'elements',
        'styles',
        'floors',
        'hidden',
        'volumes',
        'paths',
        'passages',
        'triggerFields',
      ].map((k) => [
        k,
        (o[k] ?? [])
          .slice()
          .sort((a: any, b: any) =>
            (a.id + ':' + (a.kind ?? '')).localeCompare(b.id + ':' + (b.kind ?? '')),
          ),
      ]),
    ),
  };
}
const object = (value: unknown): value is Record<string, any> =>
    !!value && typeof value === 'object' && !Array.isArray(value),
  identity = (value: unknown) =>
    typeof value === 'string' && value.length > 0 && value.length <= 1000,
  revision = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
function uniqueRows(rows: unknown, name: string, check: (row: any) => boolean) {
  if (!Array.isArray(rows) || rows.length > 100000)
    throw new Error('Autonomie-Dungeonbasis ' + name + ' prüfen.');
  const ids = new Set<string>();
  for (const row of rows) {
    if (!object(row) || !identity(row.id) || ids.has(row.id) || !check(row))
      throw new Error('Autonomie-Dungeonbasis ' + name + ' prüfen.');
    ids.add(row.id);
  }
}
function checkedVolume(value: any) {
  if (
    !object(value) ||
    !identity(value.id) ||
    !identity(value.scopeId) ||
    !identity(value.roomId) ||
    !identity(value.floorId) ||
    !revision(value.revision) ||
    !Array.isArray(value.columns) ||
    value.columns.length > MAX_VOLUME_COLUMNS ||
    !object(value.faces)
  )
    throw new Error('Autonomie-Dungeonvolumen prüfen.');
  const columns = new Set<string>();
  let total = 0;
  for (const column of value.columns) {
    if (
      !object(column) ||
      !Number.isSafeInteger(column.x) ||
      !Number.isSafeInteger(column.y) ||
      !Array.isArray(column.spans) ||
      !column.spans.length ||
      columns.has(column.x + ',' + column.y)
    )
      throw new Error('Autonomie-Dungeonvolumen prüfen.');
    columns.add(column.x + ',' + column.y);
    let end = -Infinity;
    for (const span of [...column.spans].sort((a: any, b: any) => a?.z - b?.z)) {
      if (
        !object(span) ||
        !Number.isSafeInteger(span.z) ||
        !Number.isSafeInteger(span.height) ||
        span.height < 1 ||
        span.z < end ||
        typeof span.floor !== 'boolean' ||
        typeof span.ceiling !== 'boolean' ||
        !['air', 'water'].includes(span.medium)
      )
        throw new Error('Autonomie-Dungeonvolumen prüfen.');
      end = span.z + span.height;
      total += span.height;
      if (total > MAX_VOLUME_CELLS) throw new Error('Autonomie-Dungeonvolumen prüfen.');
    }
  }
  for (const [key, state] of Object.entries(value.faces)) {
    const parts = key.split(',');
    if (
      parts.length !== 4 ||
      !['north', 'east', 'south', 'west'].includes(parts[3]!) ||
      !['open', 'solid'].includes(state as string) ||
      parts
        .slice(0, 3)
        .some(
          (coordinate) =>
            !Number.isSafeInteger(Number(coordinate)) || String(Number(coordinate)) !== coordinate,
        )
    )
      throw new Error('Autonomie-Dungeonvolumen prüfen.');
  }
}
export function checkedAutonomyDungeonBasis(row: any, cam = row?.campaign_id) {
  const snapshot = parsed(row);
  if (
    row.campaign_id !== cam ||
    !identity(row.id) ||
    typeof row.stamp !== 'string' ||
    !/^[a-f0-9]{64}$/.test(row.stamp) ||
    !object(snapshot) ||
    !object(snapshot.owners) ||
    !object(snapshot.geometry)
  )
    throw new Error('Autonomie-Dungeonbasis ist ungültig.');
  const owners = snapshot.owners;
  if (!identity(owners.scopeId) || (owners.locationId !== null && !identity(owners.locationId)))
    throw new Error('Autonomie-Dungeonowner prüfen.');
  for (const name of [
    'rooms',
    'elements',
    'styles',
    'volumes',
    'paths',
    'passages',
    'triggerFields',
  ])
    uniqueRows(owners[name], name, (row) => revision(row.revision));
  uniqueRows(owners.floors, 'floors', (row) => Number.isFinite(row.elevation));
  if (!Array.isArray(owners.hidden) || owners.hidden.length > 100000)
    throw new Error('Autonomie-Dungeonbasis hidden prüfen.');
  const hidden = new Set<string>();
  for (const entry of owners.hidden) {
    const key = entry?.id + ':' + entry?.kind;
    if (
      !object(entry) ||
      !identity(entry.id) ||
      !identity(entry.kind) ||
      hidden.has(key) ||
      typeof entry.hidden !== 'number' ||
      !revision(entry.revision)
    )
      throw new Error('Autonomie-Dungeonbasis hidden prüfen.');
    hidden.add(key);
  }
  const geometry = snapshot.geometry,
    drawing = geometry.drawing;
  if (
    !Array.isArray(geometry.rooms) ||
    geometry.rooms.length > 100000 ||
    !Array.isArray(geometry.floors) ||
    geometry.floors.length > 100000 ||
    !object(drawing)
  )
    throw new Error('Autonomie-Dungeongeometrie prüfen.');
  const rooms = new Set<string>();
  for (const room of geometry.rooms) {
    if (
      !object(room) ||
      !identity(room.id) ||
      rooms.has(room.id) ||
      !identity(room.scopeId) ||
      !identity(room.floorId) ||
      typeof room.number !== 'string' ||
      !revision(room.revision)
    )
      throw new Error('Autonomie-Dungeonräume prüfen.');
    validateRoom(room as any);
    rooms.add(room.id);
  }
  const floors = new Set<string>();
  for (const floor of geometry.floors) {
    if (
      !object(floor) ||
      !identity(floor.id) ||
      floors.has(floor.id) ||
      !identity(floor.scopeId) ||
      typeof floor.name !== 'string' ||
      !Number.isFinite(floor.elevation)
    )
      throw new Error('Autonomie-Dungeongeschosse prüfen.');
    floors.add(floor.id);
  }
  for (const name of ['elements', 'styles', 'hiddenRooms', 'hiddenFloors', 'features'])
    if (!Array.isArray(drawing[name]) || drawing[name].length > 100000)
      throw new Error('Autonomie-Dungeonzeichnung prüfen.');
  for (const name of ['triggerFields', 'paths', 'passages', 'volumes'])
    if (
      drawing[name] !== undefined &&
      (!Array.isArray(drawing[name]) || drawing[name].length > 100000)
    )
      throw new Error('Autonomie-Dungeonzeichnung prüfen.');
  for (const element of drawing.elements) validateDrawingElement(element);
  for (const style of drawing.styles)
    if (
      !object(style) ||
      !identity(style.id) ||
      !identity(style.scopeId) ||
      !revision(style.revision) ||
      !Number.isFinite(style.ceilingMeters) ||
      style.ceilingMeters <= 0 ||
      style.ceilingMeters > 1000 ||
      typeof style.fill !== 'string' ||
      !/^#[a-f0-9]{6}$/i.test(style.fill) ||
      typeof style.wall !== 'string' ||
      !/^#[a-f0-9]{6}$/i.test(style.wall) ||
      typeof style.publicLabel !== 'string' ||
      typeof style.secret !== 'boolean' ||
      (style.trackSurface !== undefined &&
        !['stone', 'mud', 'sand', 'snow', 'water', 'vegetation'].includes(style.trackSurface))
    )
      throw new Error('Autonomie-Dungeonraumstil prüfen.');
  for (const path of drawing.paths ?? []) validateDungeonPath(path, true);
  for (const passage of drawing.passages ?? []) validateDungeonPassage(passage);
  for (const volume of drawing.volumes ?? []) checkedVolume(volume);
  return snapshot as { owners: any; geometry: DungeonGeometry };
}
function readGeometry(db: any, cam: string, scopeId: string): DungeonGeometry {
  const hidden = owners(db, cam, scopeId).hidden,
    hiddenRoom = new Set(
      hidden.filter((h: any) => h.kind === 'room' && h.hidden).map((h: any) => h.id),
    ),
    hiddenFloor = new Set(
      hidden.filter((h: any) => h.kind === 'floor' && h.hidden).map((h: any) => h.id),
    ),
    rooms = db
      .prepare(
        "SELECT id,scope_id scopeId,floor_id floorId,number,name,revision,json_extract(payload,'$.polygons') polygons FROM room WHERE campaign_id=? AND scope_id=?",
      )
      .all(cam, scopeId)
      .filter((r: any) => !hiddenRoom.has(r.id) && !hiddenFloor.has(r.floorId))
      .map((r: any) => ({ ...r, polygons: JSON.parse(r.polygons), sections: [] })),
    floors = db
      .prepare(
        'SELECT id,scope_id scopeId,name,source_elevation elevation FROM drawing_floor WHERE campaign_id=? AND scope_id=?',
      )
      .all(cam, scopeId)
      .filter((f: any) => !hiddenFloor.has(f.id)),
    elements = db
      .prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND scope_id=?')
      .all(cam, scopeId)
      .map(parsed),
    styles = db
      .prepare('SELECT * FROM drawing_profile WHERE campaign_id=? AND scope_id=?')
      .all(cam, scopeId)
      .map(parsed);
  return {
    rooms,
    floors,
    drawing: {
      triggerFields: readTriggerFields(db, cam).filter((f) => f.scopeId === scopeId),
      paths: readDungeonPaths(db, cam).map((p) => ({ ...p, status: 'ready' })),
      passages: readDungeonPassages(db, cam),
      volumes: readDungeonVolumes(db, cam).filter((v) => v.scopeId === scopeId),
      elements,
      styles,
      features: [],
      hiddenRooms: [],
      hiddenFloors: [],
    },
  };
}
/** In-memory geometry for inspection; no sealed snapshot or perception memory is written. */
export function currentDungeonPreview(db: any, cam: string, scopeId: string | null) {
  const existing = dungeonAdapter(db, cam),
    id = scopeId ? 'preview:' + scopeId : null;
  let geometry: DungeonGeometry | null = null;
  return {
    spatial: id ? [{ scopeId: scopeId!, snapshotId: id }] : [],
    adapter: (snapshotId: string) => {
      if (snapshotId !== id) return existing(snapshotId);
      geometry ??= readGeometry(db, cam, scopeId!);
      return { geometry, current: true };
    },
  };
}
export function sealDungeonBases(db: any, cam: string, scopeIds: string[]) {
  const result: { scopeId: string; snapshotId: string }[] = [];
  for (const scopeId of [...new Set(scopeIds)].sort()) {
    const state = ordered(owners(db, cam, scopeId)),
      stamp = hash(JSON.stringify(state));
    let row = db
      .prepare('SELECT id FROM autonomy_dungeon_basis WHERE campaign_id=? AND stamp=?')
      .get(cam, stamp);
    if (!row) {
      const id = randomUUID(),
        payload = JSON.stringify({ owners: state, geometry: readGeometry(db, cam, scopeId) });
      db.prepare('INSERT INTO autonomy_dungeon_basis VALUES(?,?,?,?,?)').run(
        cam,
        id,
        stamp,
        payload,
        hash(payload),
      );
      row = { id };
    }
    checkedAutonomyDungeonBasis(
      db
        .prepare('SELECT * FROM autonomy_dungeon_basis WHERE campaign_id=? AND id=?')
        .get(cam, row.id),
      cam,
    );
    result.push({ scopeId, snapshotId: row.id });
  }
  return result;
}
export function dungeonAdapter(db: any, cam: string) {
  const cache = new Map<string, { geometry: DungeonGeometry; current: boolean }>();
  return (snapshotId: string) => {
    if (!cache.has(snapshotId)) {
      const snapshot = checkedAutonomyDungeonBasis(
          db
            .prepare('SELECT * FROM autonomy_dungeon_basis WHERE campaign_id=? AND id=?')
            .get(cam, snapshotId),
          cam,
        ),
        current =
          JSON.stringify(ordered(snapshot.owners)) ===
          JSON.stringify(ordered(owners(db, cam, snapshot.owners.scopeId)));
      cache.set(snapshotId, { geometry: snapshot.geometry, current });
    }
    return cache.get(snapshotId)!;
  };
}
function targetPose(g: DungeonGeometry, roomId: string): DungeonPose {
  const room = g.rooms.find((r) => r.id === roomId);
  if (!room) throw new Error('Zielraum nicht verfügbar.');
  return {
    ...centerInRoom(room),
    scopeId: room.scopeId,
    floorId: room.floorId,
    roomId: room.id,
    z: g.floors.find((f) => f.id === room.floorId)!.elevation,
  };
}
export function localJobPath(
  db: any,
  cam: string,
  a: AutonomyActor,
  j: AutonomyJob,
  basis: any,
  adapter: ReturnType<typeof dungeonAdapter>,
) {
  const p = npcPosition(db, cam, a.id),
    feature =
      j.kind === 'reset' && j.featureId
        ? db
            .prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND id=?')
            .get(cam, j.featureId)
        : null,
    f = feature ? parsed(feature) : null,
    other = j.kind === 'conflict' && j.targetActorId ? npcPosition(db, cam, j.targetActorId) : null;
  let roomId = f?.roomId ?? other?.dungeon?.roomId ?? j.roomId ?? null;
  if (!roomId) return null;
  if (j.kind === 'patrol' && j.patrolRoomId)
    roomId =
      a.dungeonTravel?.jobId === j.id
        ? a.dungeonTravel.destination.roomId
        : p.dungeon?.roomId === j.roomId
          ? j.patrolRoomId
          : j.roomId;
  if (!p.dungeon) throw new Error('NPC besitzt keine Dungeon-Raumposition.');
  const ref = basis.spatial?.find((r: any) => r.scopeId === p.dungeon!.scopeId);
  if (!ref) throw new Error('Für diesen bestätigten Zeitraum fehlt ein räumlicher Stand.');
  const spatial = adapter(ref.snapshotId);
  if (!spatial.current)
    throw new Error('Dungeonstand geändert. Ausstehenden Zeitraum als GM klären.');
  const g = spatial.geometry,
    source = g.rooms.find((r) => r.id === p.dungeon!.roomId);
  if (!source || !inside(p.dungeon, source.polygons))
    throw new Error('NPC steht außerhalb der begehbaren Kontur.');
  if (f && (f.archived || f.feature !== 'trap' || f.scopeId !== p.dungeon.scopeId))
    throw new Error('Falle ist nicht räumlich erreichbar.');
  const destination = other?.dungeon ?? targetPose(g, roomId);
  if (destination.scopeId !== p.dungeon.scopeId)
    throw new Error('Ziel liegt in einem anderen Dungeon.');
  if (a.dungeonTravel?.jobId === j.id) {
    if (
      a.dungeonTravel.jobRevision !== j.revision ||
      a.dungeonTravel.destination.roomId !== destination.roomId ||
      (other && a.dungeonTravel.targetRevision !== other.revision) ||
      !adapter(a.dungeonTravel.snapshotId).current
    )
      throw new Error('Laufender räumlicher Jobstand geändert.');
    return a.dungeonTravel;
  }
  const speed = j.speedMetersPerMinute ?? 18,
    route = planDungeon(g, p.dungeon, destination);
  let from = p.dungeon;
  const segmentSeconds = route.map((n) => {
    const seconds = Math.max(
      1,
      Math.ceil((Math.hypot(n.x - from.x, n.y - from.y, n.z - from.z) / speed) * 60),
    );
    from = n;
    return seconds;
  });
  if (route.length > 1024) throw new Error('NPC-Weg benötigt ein näheres Zwischenziel.');
  return {
    jobId: j.id,
    jobRevision: j.revision,
    snapshotId: ref.snapshotId,
    origin: p.dungeon,
    destination,
    route,
    segmentSeconds,
    nextIndex: 0,
    segmentElapsedSeconds: 0,
    totalSeconds: segmentSeconds.reduce((a, b) => a + b, 0),
    targetRevision: other?.revision ?? null,
  } as AutonomyDungeonTravel;
}
export function dungeonParties(
  db: any,
  cam: string,
  g: DungeonGeometry,
  at: DungeonPose,
  sightMeters = 20,
  darkvisionMeters = 0,
  hearingMeters = 18,
  passivePerception = 10,
  actorId: string | null = null,
  evaluation?: { epochId: string; instantMs: string },
) {
  const actual = actorId ? npcPosition(db, cam, actorId).dungeon : null;
  return db
    .prepare(
      'SELECT p.scene_id,p.payload,c.epoch_id,c.instant_ms FROM scene_position p JOIN scene_clock c ON c.campaign_id=p.campaign_id AND c.scene_id=p.scene_id WHERE p.campaign_id=? AND EXISTS(SELECT 1 FROM roster_member r WHERE r.campaign_id=p.campaign_id AND r.scene_id=p.scene_id AND r.active=1)',
    )
    .all(cam)
    .filter((r: any) => {
      const pose = JSON.parse(r.payload).dungeon,
        visible =
          !!pose &&
          pose.scopeId === at.scopeId &&
          seen3D(g, at, pose, sightMeters, darkvisionMeters, 'auto'),
        heard = npcHearsParty(
          db,
          cam,
          g,
          at,
          evaluation ? { ...r, epoch_id: evaluation.epochId, instant_ms: evaluation.instantMs } : r,
          hearingMeters,
          passivePerception,
        );
      if (
        actorId &&
        actual?.roomId === at.roomId &&
        Math.hypot(actual.x - at.x, actual.y - at.y) < 0.001
      )
        rememberNpcParty(db, cam, actorId, r.scene_id, visible, heard);
      return visible || heard;
    })
    .map((r: any) => r.scene_id);
}

export function progressDungeonTravel(
  db: any,
  cam: string,
  a: AutonomyActor,
  t: AutonomyDungeonTravel,
  seconds: number,
  interval: any,
  adapter: ReturnType<typeof dungeonAdapter>,
  senses: {
    sightMeters?: number;
    darkvisionMeters?: number;
    hearingMeters?: number;
    passivePerception?: number;
    traceRules?: DungeonTraceRules;
  },
) {
  const g = adapter(t.snapshotId).geometry;
  let consumed = 0,
    segments = 0,
    position = npcPosition(db, cam, a.id),
    at = position.dungeon!;
  const origin = at,
    traversed: DungeonPose[] = [],
    finish = (decision: any) => {
      if (consumed > 0 && Math.hypot(origin.x - at.x, origin.y - at.y, origin.z - at.z) >= 0.001) {
        const instantMs = (
          BigInt(interval.from_ms) +
          BigInt(a.offsetSeconds + consumed) * 1000n
        ).toString();
        recordDungeonTrace(
          db,
          cam,
          {
            actorId: a.id,
            sceneId: null,
            characterIds: [],
            from: origin,
            to: at,
            path: [origin, ...traversed],
            jobId: t.jobId,
            epochId: interval.epoch_id,
            instantMs,
            surface: at.movement === 'swim' ? 'water' : 'stone',
            movement: at.movement ?? 'walk',
          },
          senses.traceRules,
        );
      }
      return { consumed, decision };
    },
    danger = (next: DungeonPose) => {
      const party = [
        ...new Set([
          ...dungeonParties(
            db,
            cam,
            g,
            at,
            senses.sightMeters ?? 20,
            senses.darkvisionMeters ?? 0,
            senses.hearingMeters ?? 18,
            senses.passivePerception ?? 10,
            a.id,
            {
              epochId: interval.epoch_id,
              instantMs: (
                BigInt(interval.from_ms) +
                BigInt(a.offsetSeconds + consumed) * 1000n
              ).toString(),
            },
          ),
          ...dungeonParties(
            db,
            cam,
            g,
            next,
            senses.sightMeters ?? 20,
            senses.darkvisionMeters ?? 0,
            senses.hearingMeters ?? 18,
            senses.passivePerception ?? 10,
            a.id,
            {
              epochId: interval.epoch_id,
              instantMs: (
                BigInt(interval.from_ms) +
                BigInt(a.offsetSeconds + consumed) * 1000n
              ).toString(),
            },
          ),
        ]),
      ];
      if (party.length)
        return {
          reason: 'Party-Kontakt vor NPC-Bewegung. Begegnung als GM klären.',
          facts: { partySceneIds: party, roomId: next.roomId, jobId: t.jobId },
        };
      for (const e of g.drawing.elements.filter(
        (e) =>
          !e.archived && e.kind === 'feature' && e.feature === 'trap' && e.floorId === next.floorId,
      )) {
        const state = db
            .prepare('SELECT * FROM dungeon_feature_state WHERE campaign_id=? AND id=?')
            .get(cam, e.id),
          charges = state ? parsed(state).charges : e.maxCharges;
        if (
          charges > 0 &&
          trapEntry(at, next, e.points[0]!, e.triggerRadius, e.triggerHeight) !== null
        )
          return {
            reason: 'Geladene Falle vor NPC-Bewegung. Als GM klären.',
            facts: { featureId: e.id, roomId: next.roomId, jobId: t.jobId },
          };
      }
      return null;
    };
  while (t.nextIndex < t.route.length && consumed < seconds && segments < 24) {
    const destination = t.route[t.nextIndex]!,
      duration = t.segmentSeconds[t.nextIndex]!,
      spend = Math.min(seconds - consumed, duration - t.segmentElapsedSeconds),
      remaining = duration - t.segmentElapsedSeconds,
      fraction = spend / remaining,
      next: DungeonPose = {
        ...destination,
        x: at.x + (destination.x - at.x) * fraction,
        y: at.y + (destination.y - at.y) * fraction,
        z: at.z + (destination.z - at.z) * fraction,
      };
    // A floor/room crossing is committed at the portal end; partial time keeps its departure pose.
    const crossing = destination.roomId !== at.roomId;
    if (crossing && spend < remaining) {
      const stop = danger(destination);
      if (stop) return finish(stop);
      t.segmentElapsedSeconds += spend;
      consumed += spend;
      break;
    }
    const stop = danger(next);
    if (stop) return finish(stop);
    position = placeNpcDungeon(db, cam, a.id, next, position.revision, g);
    at = position.dungeon!;
    traversed.push(at);
    a.positionBasis = position;
    t.segmentElapsedSeconds += spend;
    consumed += spend;
    segments++;
    if (t.segmentElapsedSeconds >= duration) {
      t.nextIndex++;
      t.segmentElapsedSeconds = 0;
    }
  }
  return finish(null);
}
