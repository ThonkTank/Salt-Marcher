import { dungeonTraceRules } from './dungeon-senses';
import { targetOccupied, bookTarget, trimTargets } from './autonomy-resources';
import {
  sealDungeonBases,
  currentDungeonPreview,
  dungeonAdapter,
  localJobPath,
  progressDungeonTravel,
  dungeonParties,
  checkedAutonomyDungeonBasis,
} from './autonomy-dungeon';
import { resetDungeonFeatureByNpc, readDrawingElements } from './drawing';
import { createHash, randomUUID, randomInt } from 'node:crypto';
import type {
  AutonomyActor,
  AutonomyJob,
  AutonomyCommand,
  AutonomyView,
  AutonomyDecision,
  AutonomyDecisionCandidate,
} from '../runtime/autonomy-contracts';
import { standardNeeds, checkedAutonomyJob } from '../runtime/autonomy-contracts';
import { npcPosition, npcPositionReader, placeNpc, npcRoutes, saveNpcRoute } from './npc-world';
import { readLive } from './live';
import { readPreparedGroup, readWorldActor, writeWorldActorHealth } from './session';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
// Opaque IDs have one order across host languages, in both job and route ties.
const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function parsed<T = any>(r: any): T {
  if (!r || hash(r.payload) !== r.checksum)
    throw new Error('Autonomiedaten fehlen oder sind beschädigt.');
  return JSON.parse(r.payload);
}
export function installAutonomySchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS autonomy_actor(campaign_id TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS autonomy_job(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS autonomy_interval(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,ordinal INTEGER NOT NULL,scene_id TEXT NOT NULL,epoch_id TEXT NOT NULL,from_ms TEXT NOT NULL,to_ms TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),UNIQUE(campaign_id,ordinal)) STRICT;
CREATE TABLE IF NOT EXISTS autonomy_frontier(campaign_id TEXT NOT NULL REFERENCES campaign(id),epoch_id TEXT NOT NULL,instant_ms TEXT NOT NULL,PRIMARY KEY(campaign_id,epoch_id)) STRICT;
CREATE TABLE IF NOT EXISTS autonomy_reservation(campaign_id TEXT NOT NULL,job_id TEXT NOT NULL,actor_id TEXT NOT NULL,PRIMARY KEY(campaign_id,job_id),FOREIGN KEY(campaign_id,job_id) REFERENCES autonomy_job(campaign_id,id),FOREIGN KEY(campaign_id,actor_id) REFERENCES autonomy_actor(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS autonomy_booking(campaign_id TEXT NOT NULL,id TEXT NOT NULL,job_id TEXT NOT NULL,actor_id TEXT NOT NULL,epoch_id TEXT NOT NULL,from_ms TEXT NOT NULL,to_ms TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,job_id) REFERENCES autonomy_job(campaign_id,id),FOREIGN KEY(campaign_id,actor_id) REFERENCES autonomy_actor(campaign_id,id)) STRICT;
CREATE INDEX IF NOT EXISTS autonomy_booking_time ON autonomy_booking(campaign_id,job_id,epoch_id,from_ms,to_ms);
CREATE TABLE IF NOT EXISTS autonomy_log(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,actor_id TEXT NOT NULL,interval_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS autonomy_receipt(campaign_id TEXT NOT NULL REFERENCES campaign(id),command_id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;`);
}
function rows<T>(db: any, cam: string, table: string): T[] {
  return db
    .prepare('SELECT * FROM ' + table + ' WHERE campaign_id=? ORDER BY id')
    .all(cam)
    .map((r: any) => (table === 'autonomy_job' ? (checkedJobRow(r) as T) : parsed<T>(r)));
}
function checkedJobRow(row: any): AutonomyJob {
  const job = checkedAutonomyJob(parsed<AutonomyJob>(row));
  if (job.id !== row.id || job.revision !== row.revision)
    throw new Error('Autonomie-Jobidentität oder Revision widersprüchlich.');
  return job;
}
const autonomyId = (value: unknown) =>
    typeof value === 'string' && value.length > 0 && value.length <= 1000,
  plain = (value: unknown): value is Record<string, any> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
function checkedPose(value: any) {
  if (
    !plain(value) ||
    !autonomyId(value.scopeId) ||
    !autonomyId(value.floorId) ||
    !autonomyId(value.roomId) ||
    ![value.x, value.y, value.z].every((n) => Number.isFinite(n) && Math.abs(n) <= 1e9) ||
    (value.movement !== undefined &&
      !['walk', 'crawl', 'fly', 'swim', 'climb'].includes(value.movement))
  )
    throw new Error('Autonomie-Intervallposition ist ungültig.');
}
function checkedTraceRules(value: any) {
  if (
    !plain(value) ||
    typeof value.generate !== 'boolean' ||
    !['walk', 'sneak', 'run', 'crawl', 'swim', 'fly'].includes(value.movement) ||
    !['auto', 'stone', 'mud', 'sand', 'snow', 'water', 'vegetation'].includes(value.surface) ||
    !['dry', 'rain', 'wind', 'snow'].includes(value.environment) ||
    !Number.isFinite(value.strength) ||
    value.strength < 0 ||
    value.strength > 100 ||
    (value.dcOverride !== null &&
      (!Number.isFinite(value.dcOverride) || value.dcOverride < 0 || value.dcOverride > 100)) ||
    (value.lifetimeSeconds !== null &&
      (!Number.isSafeInteger(value.lifetimeSeconds) ||
        value.lifetimeSeconds < 1 ||
        value.lifetimeSeconds > 31536000)) ||
    (value.decayPerHour !== null &&
      (!Number.isFinite(value.decayPerHour) ||
        value.decayPerHour < 0 ||
        value.decayPerHour > 10000)) ||
    !['perception', 'survival'].includes(value.skill)
  )
    throw new Error('Autonomie-Intervallspurenprofil ist ungültig.');
}
function checkedIntervalActor(config: any) {
  if (
    !plain(config) ||
    !autonomyId(config.id) ||
    typeof config.role !== 'string' ||
    config.role.length > 1000 ||
    !Array.isArray(config.needs) ||
    config.needs.length > 1000 ||
    !plain(config.jobPriorities) ||
    Object.entries(config.jobPriorities).some(
      ([id, value]) => !autonomyId(id) || !Number.isFinite(value),
    ) ||
    (config.assignedJobId !== null && !autonomyId(config.assignedJobId)) ||
    typeof config.allowConflict !== 'boolean' ||
    ![config.defense, config.attackBonus].every(Number.isFinite) ||
    !Number.isFinite(config.maxHpLossPercent) ||
    config.maxHpLossPercent < 0 ||
    config.maxHpLossPercent > 25 ||
    ![config.sightMeters, config.darkvisionMeters, config.hearingMeters].every(
      (n) => Number.isFinite(n) && n >= 0 && n <= 1000,
    ) ||
    ![config.passivePerception, config.stealthDc].every(
      (n) => Number.isFinite(n) && n >= -100 && n <= 100,
    )
  )
    throw new Error('Autonomie-Intervall-Actorkonfiguration ist ungültig.');
  const needs = new Set<string>();
  for (const need of config.needs) {
    if (
      !plain(need) ||
      !autonomyId(need.id) ||
      needs.has(need.id) ||
      typeof need.enabled !== 'boolean' ||
      !Number.isFinite(need.ratePerHour) ||
      need.ratePerHour < 0 ||
      need.ratePerHour > 1000 ||
      !Number.isFinite(need.weight) ||
      need.weight < 0 ||
      need.weight > 100
    )
      throw new Error('Autonomie-Intervallbedürfnisse sind ungültig.');
    needs.add(need.id);
  }
  if (
    !plain(config.positionBasis) ||
    (config.positionBasis.locationId !== null && !autonomyId(config.positionBasis.locationId)) ||
    (config.positionBasis.revision !== null &&
      (!Number.isSafeInteger(config.positionBasis.revision) || config.positionBasis.revision < 1))
  )
    throw new Error('Autonomie-Intervallposition ist ungültig.');
  if (config.positionBasis.dungeon !== undefined && config.positionBasis.dungeon !== null)
    checkedPose(config.positionBasis.dungeon);
  checkedTraceRules(config.traceRules);
  return config;
}
function checkedIntervalRoute(route: any) {
  if (
    !plain(route) ||
    !autonomyId(route.id) ||
    !Number.isSafeInteger(route.revision) ||
    route.revision < 1 ||
    typeof route.name !== 'string' ||
    !route.name.trim() ||
    route.name.length > 1000 ||
    !autonomyId(route.fromLocationId) ||
    !autonomyId(route.toLocationId) ||
    route.fromLocationId === route.toLocationId ||
    !Number.isSafeInteger(route.durationSeconds) ||
    route.durationSeconds < 1 ||
    route.durationSeconds > 100000000 ||
    typeof route.enabled !== 'boolean'
  )
    throw new Error('Autonomie-Intervallroute ist ungültig.');
  return route;
}
function checkedIntervalRow(
  db: any,
  cam: string,
  row: any,
): ReturnType<typeof captureAutonomyBasis> {
  const basis = parsed<ReturnType<typeof captureAutonomyBasis>>(row),
    instant = (v: unknown) => typeof v === 'string' && /^(0|[1-9][0-9]{0,29})$/.test(v);
  if (
    row.campaign_id !== cam ||
    !autonomyId(row.id) ||
    !autonomyId(row.scene_id) ||
    !db.prepare('SELECT 1 FROM live_scene WHERE campaign_id=? AND id=?').get(cam, row.scene_id) ||
    !autonomyId(row.epoch_id) ||
    !Number.isSafeInteger(row.ordinal) ||
    row.ordinal < 1 ||
    !instant(row.from_ms) ||
    !instant(row.to_ms) ||
    BigInt(row.to_ms) <= BigInt(row.from_ms)
  )
    throw new Error('Autonomie-Intervallidentität oder Zeitgrenzen sind ungültig.');
  if (
    !plain(basis) ||
    !Array.isArray(basis.actors) ||
    !Array.isArray(basis.jobs) ||
    !Array.isArray(basis.routes) ||
    !Array.isArray(basis.features) ||
    !Array.isArray(basis.spatial) ||
    [basis.actors, basis.jobs, basis.routes, basis.features, basis.spatial].some(
      (values) => values.length > 100000,
    )
  )
    throw new Error('Autonomie-Intervallbasis ist ungültig.');
  const actors = new Set<string>(),
    jobs = new Set<string>(),
    routes = new Set<string>(),
    features = new Set<string>(),
    scopes = new Set<string>();
  for (const config of basis.actors) {
    checkedIntervalActor(config);
    if (actors.has(config.id))
      throw new Error('Autonomie-Intervall hat doppelte Actoridentitäten.');
    actors.add(config.id);
  }
  for (const job of basis.jobs) {
    checkedAutonomyJob(job);
    if (jobs.has(job.id)) throw new Error('Autonomie-Intervall hat doppelte Jobidentitäten.');
    jobs.add(job.id);
  }
  for (const route of basis.routes) {
    checkedIntervalRoute(route);
    if (routes.has(route.id))
      throw new Error('Autonomie-Intervall hat doppelte Routenidentitäten.');
    routes.add(route.id);
  }
  for (const feature of basis.features) {
    if (
      !plain(feature) ||
      !autonomyId(feature.id) ||
      !Number.isSafeInteger(feature.revision) ||
      feature.revision < 0 ||
      features.has(feature.id)
    )
      throw new Error('Autonomie-Intervallfeature ist ungültig oder doppelt.');
    features.add(feature.id);
  }
  for (const ref of basis.spatial) {
    if (
      !plain(ref) ||
      !autonomyId(ref.scopeId) ||
      !autonomyId(ref.snapshotId) ||
      scopes.has(ref.scopeId)
    )
      throw new Error('Autonomie-Intervall-Dungeonreferenz ist ungültig oder doppelt.');
    const snapshot = checkedAutonomyDungeonBasis(
      db
        .prepare('SELECT * FROM autonomy_dungeon_basis WHERE campaign_id=? AND id=?')
        .get(cam, ref.snapshotId),
      cam,
    );
    if (snapshot.owners.scopeId !== ref.scopeId)
      throw new Error('Autonomie-Intervall-Dungeonreferenz widerspricht ihrem Snapshot.');
    scopes.add(ref.scopeId);
  }
  return basis;
}
const bookedInstant = (value: unknown) => typeof value === 'string' && /^[0-9]{30}$/.test(value);
function checkedFrontier(db: any, cam: string, row: any) {
  if (
    !row ||
    row.campaign_id !== cam ||
    !autonomyId(row.epoch_id) ||
    typeof row.instant_ms !== 'string' ||
    !/^(0|[1-9][0-9]{0,29})$/.test(row.instant_ms) ||
    !db.prepare('SELECT 1 FROM campaign WHERE id=?').get(cam)
  )
    throw new Error('Autonomie-Zeitfront ist ungültig.');
  return row;
}
function checkedReceipt(row: any, cam: string) {
  const progress = parsed<{ progressed: number; pending: number }>(row);
  if (
    row.campaign_id !== cam ||
    !autonomyId(row.command_id) ||
    typeof row.fingerprint !== 'string' ||
    !/^[a-f0-9]{64}$/.test(row.fingerprint) ||
    !progress ||
    !Number.isSafeInteger(progress.progressed) ||
    progress.progressed < 0 ||
    !Number.isSafeInteger(progress.pending) ||
    progress.pending < 0
  )
    throw new Error('Autonomie-Receipt ist ungültig.');
  return progress;
}
function checkedLog(db: any, row: any) {
  const value = parsed<any>(row);
  if (
    !autonomyId(row.campaign_id) ||
    !autonomyId(row.id) ||
    !autonomyId(row.actor_id) ||
    !autonomyId(row.interval_id) ||
    !value ||
    value.id !== row.id ||
    value.actorId !== row.actor_id ||
    value.intervalId !== row.interval_id ||
    ![
      'cancel',
      'decision',
      'override',
      'wait',
      'interrupt',
      'job',
      'dungeon-move',
      'reset',
      'conflict',
      'move',
      'complete',
    ].includes(value.kind) ||
    typeof value.text !== 'string' ||
    !value.text ||
    !value.facts ||
    typeof value.facts !== 'object' ||
    Array.isArray(value.facts) ||
    !db
      .prepare('SELECT 1 FROM world_note WHERE campaign_id=? AND id=?')
      .get(row.campaign_id, row.actor_id) ||
    (row.interval_id !== 'manual' &&
      !db
        .prepare('SELECT 1 FROM autonomy_interval WHERE campaign_id=? AND id=?')
        .get(row.campaign_id, row.interval_id))
  )
    throw new Error('Autonomie-Log ist ungültig.');
  return value;
}
function checkedBooking(row: any, target = false) {
  if (
    !autonomyId(row.campaign_id) ||
    !autonomyId(row.id) ||
    !autonomyId(row.job_id) ||
    !autonomyId(row.actor_id) ||
    !autonomyId(row.epoch_id) ||
    !bookedInstant(row.from_ms) ||
    !bookedInstant(row.to_ms) ||
    row.from_ms >= row.to_ms ||
    (target &&
      (!['job', 'location', 'room', 'feature'].includes(row.resource_kind) ||
        !autonomyId(row.resource_id)))
  )
    throw new Error('Autonomie-Buchung ist ungültig.');
}
function validateRuntimeLinks(db: any, cam: string) {
  const reservations = db
      .prepare('SELECT * FROM autonomy_reservation WHERE campaign_id=?')
      .all(cam),
    actors = new Set<string>();
  for (const row of reservations) {
    if (actors.has(row.actor_id))
      throw new Error('Autonomie-Actor besitzt mehrere Reservierungen.');
    actors.add(row.actor_id);
    const a = actor(db, cam, row.actor_id);
    if (a.jobId !== row.job_id || !a.enabled || a.paused)
      throw new Error('Autonomie-Reservierung widerspricht dem Actorstand.');
    checkedJobRow(
      db.prepare('SELECT * FROM autonomy_job WHERE campaign_id=? AND id=?').get(cam, row.job_id),
    );
  }
  for (const table of ['autonomy_booking', 'autonomy_target_booking']) {
    if (
      db
        .prepare(
          `SELECT 1 FROM ${table} b WHERE b.campaign_id=? AND (NOT EXISTS(SELECT 1 FROM autonomy_actor a WHERE a.campaign_id=b.campaign_id AND a.id=b.actor_id) OR NOT EXISTS(SELECT 1 FROM autonomy_job j WHERE j.campaign_id=b.campaign_id AND j.id=b.job_id)) LIMIT 1`,
        )
        .get(cam)
    )
      throw new Error('Autonomie-Buchung hat einen fehlenden Campaignowner.');
    for (const row of db.prepare(`SELECT * FROM ${table} WHERE campaign_id=?`).all(cam)) {
      checkedBooking(row, table === 'autonomy_target_booking');
      const collision =
        table === 'autonomy_booking'
          ? db
              .prepare(
                'SELECT 1 FROM autonomy_booking WHERE campaign_id=? AND id<>? AND job_id=? AND epoch_id=? AND actor_id<>? AND from_ms<? AND to_ms>? LIMIT 1',
              )
              .get(cam, row.id, row.job_id, row.epoch_id, row.actor_id, row.to_ms, row.from_ms)
          : db
              .prepare(
                'SELECT 1 FROM autonomy_target_booking WHERE campaign_id=? AND id<>? AND resource_kind=? AND resource_id=? AND epoch_id=? AND actor_id<>? AND from_ms<? AND to_ms>? LIMIT 1',
              )
              .get(
                cam,
                row.id,
                row.resource_kind,
                row.resource_id,
                row.epoch_id,
                row.actor_id,
                row.to_ms,
                row.from_ms,
              );
      if (collision) throw new Error('Autonomie-Buchungen überlappen widersprüchlich.');
    }
  }
}
function actor(db: any, cam: string, id: string): AutonomyActor {
  const row = db.prepare('SELECT * FROM autonomy_actor WHERE campaign_id=? AND id=?').get(cam, id),
    a = parsed<AutonomyActor>(row);
  checkActor(a);
  if (a.id !== row.id || a.revision !== row.revision)
    throw new Error('Autonomieidentität widersprüchlich.');
  return a;
}
function save(db: any, cam: string, table: string, v: any) {
  const p = JSON.stringify(v);
  db.prepare(
    'INSERT INTO ' +
      table +
      ' VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, v.id, v.revision, p, hash(p));
}
function maxOrdinal(db: any, cam: string) {
  return db
    .prepare('SELECT coalesce(max(ordinal),0) n FROM autonomy_interval WHERE campaign_id=?')
    .get(cam).n as number;
}
function log(
  db: any,
  cam: string,
  a: string,
  intervalId: string,
  kind: string,
  text: string,
  facts: any,
) {
  const id = randomUUID(),
    p = JSON.stringify({ id, actorId: a, intervalId, kind, text, facts });
  db.prepare('INSERT INTO autonomy_log VALUES(?,?,?,?,?,?)').run(
    cam,
    id,
    a,
    intervalId,
    p,
    hash(p),
  );
  checkedLog(
    db,
    db.prepare('SELECT * FROM autonomy_log WHERE campaign_id=? AND id=?').get(cam, id),
  );
}
function available(db: any, cam: string, id: string) {
  return !!db
    .prepare(
      "SELECT 1 FROM world_note WHERE campaign_id=? AND id=? AND json_extract(payload,'$.kind')='npc' AND trashed=0",
    )
    .get(cam, id);
}
function defaultActor(db: any, cam: string, id: string): AutonomyActor {
  return {
    id,
    revision: 1,
    enabled: true,
    paused: false,
    role: '',
    needs: standardNeeds(),
    jobPriorities: {},
    assignedJobId: null,
    allowConflict: false,
    defense: 12,
    attackBonus: 0,
    maxHpLossPercent: 10,
    cursor: maxOrdinal(db, cam),
    offsetSeconds: 0,
    jobId: null,
    progressSeconds: 0,
    pending: null,
    positionBasis: npcPosition(db, cam, id),
  };
}
function checkActor(a: AutonomyActor) {
  if (
    !a.id ||
    typeof a.enabled !== 'boolean' ||
    typeof a.paused !== 'boolean' ||
    !Array.isArray(a.needs) ||
    new Set(a.needs.map((n) => n.id)).size !== a.needs.length ||
    !Number.isFinite(a.defense + a.attackBonus + a.maxHpLossPercent) ||
    a.maxHpLossPercent < 0 ||
    a.maxHpLossPercent > 25
  )
    throw new Error('NPC-Konfiguration prüfen.');
  for (const n of a.needs)
    if (
      !n.id ||
      typeof n.name !== 'string' ||
      typeof n.enabled !== 'boolean' ||
      !Number.isFinite(n.value + n.ratePerHour + n.weight) ||
      n.value < 0 ||
      n.value > 100 ||
      n.ratePerHour < 0 ||
      n.ratePerHour > 1000 ||
      n.weight < 0 ||
      n.weight > 100
    )
      throw new Error('Bedürfniswerte prüfen.');
  if (
    typeof a.role !== 'string' ||
    !a.jobPriorities ||
    typeof a.jobPriorities !== 'object' ||
    Array.isArray(a.jobPriorities) ||
    Object.values(a.jobPriorities).some((v) => !Number.isFinite(v)) ||
    (a.assignedJobId !== null && typeof a.assignedJobId !== 'string')
  )
    throw new Error('NPC-Rolle oder Prioritäten prüfen.');
  if (
    !Number.isSafeInteger(a.revision) ||
    a.revision < 1 ||
    !Number.isSafeInteger(a.cursor) ||
    a.cursor < 0 ||
    !Number.isSafeInteger(a.offsetSeconds) ||
    a.offsetSeconds < 0 ||
    !Number.isSafeInteger(a.progressSeconds) ||
    a.progressSeconds < 0 ||
    (a.jobId !== null && typeof a.jobId !== 'string') ||
    (a.pending !== null && (typeof a.pending !== 'string' || !a.paused))
  )
    throw new Error('Autonomielaufstand ist ungültig.');
  if (
    [a.hearingMeters ?? 18].some((n) => !Number.isFinite(n) || n < 0 || n > 1000) ||
    [a.passivePerception ?? 10, a.stealthDc ?? 10].some(
      (n) => !Number.isFinite(n) || n < -100 || n > 100,
    )
  )
    throw new Error('Hörweite, Wahrnehmung oder Heimlichkeit prüfen.');
  if (
    [a.sightMeters ?? 20, a.darkvisionMeters ?? 0].some(
      (n) => !Number.isFinite(n) || n < 0 || n > 1000,
    )
  )
    throw new Error('NPC-Sichtwerte prüfen.');
  if (
    a.positionBasis &&
    ((a.positionBasis.locationId !== null && typeof a.positionBasis.locationId !== 'string') ||
      (a.positionBasis.revision !== null &&
        (!Number.isSafeInteger(a.positionBasis.revision) || a.positionBasis.revision < 1)))
  )
    throw new Error('Worldpositionsbasis ist ungültig.');
}
export function captureAutonomyBasis(db: any, cam: string) {
  const actors = rows<AutonomyActor>(db, cam, 'autonomy_actor').filter((a) => a.enabled),
    jobs = rows<AutonomyJob>(db, cam, 'autonomy_job'),
    routes = npcRoutes(db, cam);
  const positions = new Map(actors.map((a) => [a.id, npcPosition(db, cam, a.id)])),
    spatial = sealDungeonBases(
      db,
      cam,
      [...positions.values()].flatMap((p) => (p.dungeon ? [p.dungeon.scopeId] : [])),
    );
  return {
    spatial,
    actors: actors.map((a) => ({
      id: a.id,
      positionBasis: positions.get(a.id),
      traceRules: dungeonTraceRules(db, cam, null, a.id),
      sightMeters: a.sightMeters ?? 20,
      darkvisionMeters: a.darkvisionMeters ?? 0,
      hearingMeters: a.hearingMeters ?? 18,
      passivePerception: a.passivePerception ?? 10,
      stealthDc: a.stealthDc ?? 10,
      role: a.role,
      needs: a.needs.map((n) => ({
        id: n.id,
        enabled: n.enabled,
        ratePerHour: n.ratePerHour,
        weight: n.weight,
      })),
      jobPriorities: a.jobPriorities,
      assignedJobId: a.assignedJobId,
      allowConflict: a.allowConflict,
      defense: a.defense,
      attackBonus: a.attackBonus,
      maxHpLossPercent: a.maxHpLossPercent,
    })),
    jobs,
    routes,
    features: db
      .prepare("SELECT id,revision FROM drawing_element WHERE campaign_id=? AND kind='feature'")
      .all(cam),
  };
}
export function recordAutonomyTime(
  db: any,
  cam: string,
  commandId: string,
  sceneId: string,
  epochId: string,
  fromMs: string,
  toMs: string,
  basis: ReturnType<typeof captureAutonomyBasis>,
) {
  const previousRow = db
      .prepare('SELECT * FROM autonomy_frontier WHERE campaign_id=? AND epoch_id=?')
      .get(cam, epochId),
    previous = previousRow ? checkedFrontier(db, cam, previousRow) : null,
    from = previous?.instant_ms ?? fromMs;
  if (BigInt(toMs) <= BigInt(from)) return;
  if (!basis.actors.length) {
    db.prepare(
      'INSERT INTO autonomy_frontier VALUES(?,?,?) ON CONFLICT(campaign_id,epoch_id) DO UPDATE SET instant_ms=excluded.instant_ms',
    ).run(cam, epochId, toMs);
    return;
  }
  const id = commandId + ':autonomy',
    ordinal = maxOrdinal(db, cam) + 1,
    p = JSON.stringify(basis);
  db.prepare('INSERT INTO autonomy_interval VALUES(?,?,?,?,?,?,?,?,?)').run(
    cam,
    id,
    ordinal,
    sceneId,
    epochId,
    from,
    toMs,
    p,
    hash(p),
  );
  checkedIntervalRow(
    db,
    cam,
    db.prepare('SELECT * FROM autonomy_interval WHERE campaign_id=? AND id=?').get(cam, id),
  );
  db.prepare(
    'INSERT INTO autonomy_frontier VALUES(?,?,?) ON CONFLICT(campaign_id,epoch_id) DO UPDATE SET instant_ms=excluded.instant_ms',
  ).run(cam, epochId, toMs);
}
function routePath(routes: any[], from: string | null, to: string | null) {
  if (from === to) return { seconds: 0, routes: [] as any[], places: [from] };
  if (!from || !to) return null;
  const queue = [{ id: from, seconds: 0, routes: [] as any[], places: [from] }],
    best = new Map<string, number>([[from, 0]]),
    settled = new Set<string>();
  while (queue.length) {
    queue.sort((a, b) => a.seconds - b.seconds || compareIds(a.id, b.id));
    const p = queue.shift()!;
    if (p.seconds !== best.get(p.id) || settled.has(p.id)) continue;
    settled.add(p.id);
    if (p.id === to) return p;
    for (const r of routes.filter((r) => r.enabled)) {
      const next =
          r.fromLocationId === p.id
            ? r.toLocationId
            : r.toLocationId === p.id
              ? r.fromLocationId
              : null,
        seconds = p.seconds + r.durationSeconds;
      if (next && seconds < (best.get(next) ?? Infinity)) {
        best.set(next, seconds);
        queue.push({ id: next, seconds, routes: [...p.routes, r], places: [...p.places, next] });
      }
    }
    if (settled.size > 1000) break;
  }
  return null;
}
function partyAt(db: any, cam: string, places: (string | null)[]) {
  const markers = places
    .filter(Boolean)
    .flatMap((id) =>
      db
        .prepare('SELECT map_id,q,r FROM atlas_place WHERE campaign_id=? AND location_id=?')
        .all(cam, id),
    );
  return db
    .prepare(
      'SELECT s.id,s.location_id FROM live_scene s JOIN scene_lifecycle l ON l.campaign_id=s.campaign_id AND l.id=s.id WHERE s.campaign_id=? AND l.retired=0 AND EXISTS(SELECT 1 FROM roster_member r WHERE r.campaign_id=s.campaign_id AND r.scene_id=s.id AND r.active=1)',
    )
    .all(cam)
    .filter((r: any) => {
      if (r.location_id && places.includes(r.location_id)) return true;
      const row = db
        .prepare('SELECT payload FROM scene_position WHERE campaign_id=? AND scene_id=?')
        .get(cam, r.id);
      if (!row) return false;
      const p = JSON.parse(row.payload);
      return markers.some((m: any) => m.map_id === p.mapId && m.q === p.q && m.r === p.r);
    })
    .map((r: any) => r.id);
}
function trimBookings(db: any, cam: string, id: string, epoch: string, instant: bigint) {
  trimTargets(db, cam, id, epoch, instant);
  const at = instant.toString().padStart(30, '0');
  db.prepare(
    'DELETE FROM autonomy_booking WHERE campaign_id=? AND actor_id=? AND epoch_id=? AND from_ms>=?',
  ).run(cam, id, epoch, at);
  db.prepare(
    'UPDATE autonomy_booking SET to_ms=? WHERE campaign_id=? AND actor_id=? AND epoch_id=? AND to_ms>?',
  ).run(at, cam, id, epoch, at);
}
function choose(
  db: any,
  cam: string,
  a: AutonomyActor,
  config: any,
  basis: any,
  interval: any,
  spatialAdapter: ReturnType<typeof dungeonAdapter>,
  diagnostic = false,
) {
  const current = npcPosition(db, cam, a.id),
    excluded: string[] = [],
    candidates: any[] = [],
    rejected: AutonomyDecisionCandidate[] = [];
  const reject = (j: AutonomyJob, reason: string) => {
    excluded.push(j.name + ': ' + reason);
    if (diagnostic)
      rejected.push({
        jobId: j.id,
        revision: j.revision,
        name: j.name,
        eligible: false,
        priority: null,
        reason,
        travelSeconds: null,
        remainingSeconds: null,
      });
  };
  for (const j of basis.jobs as AutonomyJob[]) {
    if (!j.enabled) {
      if (diagnostic) reject(j, 'Angebot ausgeschaltet');
      continue;
    }
    const present = db
      .prepare('SELECT revision FROM autonomy_job WHERE campaign_id=? AND id=?')
      .get(cam, j.id);
    if (!present || present.revision !== j.revision) {
      reject(j, 'Angebotsstand geändert');
      continue;
    }
    if (j.roles.length && !j.roles.includes(config.role)) {
      reject(j, 'Rolle ' + (config.role || 'nicht gesetzt') + ' ist nicht zugelassen');
      continue;
    }
    if (j.kind === 'reset') {
      const row = j.featureId
          ? db
              .prepare('SELECT * FROM drawing_element WHERE campaign_id=? AND id=?')
              .get(cam, j.featureId)
          : null,
        f = row ? parsed(row) : null,
        confirmed = basis.features?.find((f: any) => f.id === j.featureId);
      if (!f || !confirmed || f.revision !== confirmed.revision) {
        reject(j, 'Featurestand geändert');
        continue;
      }
      if (f.archived || f.kind !== 'feature' || f.feature !== 'trap' || !f.roomId) {
        reject(j, 'NPC muss im Fallenraum stehen');
        continue;
      }
      const state = db
        .prepare('SELECT * FROM dungeon_feature_state WHERE campaign_id=? AND id=?')
        .get(cam, f.id);
      if ((state ? parsed(state).charges : f.maxCharges) >= f.maxCharges) {
        reject(j, 'Falle bereits einsatzbereit');
        continue;
      }
    }
    if (j.exclusive) {
      const reservation = db
        .prepare('SELECT actor_id FROM autonomy_reservation WHERE campaign_id=? AND job_id=?')
        .get(cam, j.id);
      if (reservation && reservation.actor_id !== a.id) {
        reject(j, 'exklusiv reserviert');
        continue;
      }
    }
    let target = j.locationId;
    if (j.kind === 'conflict') {
      target = j.targetActorId ? npcPosition(db, cam, j.targetActorId).locationId : null;
      if (!target) {
        reject(j, 'Konfliktziel nicht räumlich erreichbar');
        continue;
      }
    }
    if (j.kind === 'patrol' && !j.roomId) {
      const r = basis.routes.find((r: any) => r.id === j.routeId);
      if (!r || !r.enabled) {
        reject(j, 'Patrouillenweg fehlt');
        continue;
      }
      target = current.locationId === r.toLocationId ? r.fromLocationId : r.toLocationId;
    }
    if (
      target &&
      !db
        .prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0')
        .get(cam, target)
    ) {
      reject(j, 'Ziel fehlt');
      continue;
    }
    if (j.kind === 'move' && target === current.locationId && !j.roomId) {
      reject(j, 'Ziel bereits erreicht');
      continue;
    }
    let local: ReturnType<typeof localJobPath> = null;
    try {
      local = localJobPath(db, cam, a, j, basis, spatialAdapter);
    } catch (e) {
      reject(j, '' + (e as Error).message);
      continue;
    }
    if (local && target && target !== current.locationId) {
      reject(j, 'Raumziel und World-Ort widersprechen sich');
      continue;
    }
    if (
      j.kind === 'move' &&
      local &&
      current.dungeon?.roomId === local.destination.roomId &&
      Math.hypot(current.dungeon.x - local.destination.x, current.dungeon.y - local.destination.y) <
        0.1
    ) {
      reject(j, 'Raumziel bereits erreicht');
      continue;
    }
    const path = local
      ? { seconds: local.totalSeconds, routes: [], places: [current.locationId], dungeon: local }
      : target
        ? routePath(basis.routes, current.locationId, target)
        : { seconds: 0, routes: [], places: [current.locationId] };
    if (
      !path ||
      path.routes.some(
        (r: any) =>
          db.prepare('SELECT revision FROM npc_route WHERE campaign_id=? AND id=?').get(cam, r.id)
            ?.revision !== r.revision,
      )
    ) {
      reject(j, 'Route fehlt oder wurde geändert');
      continue;
    }
    const at = BigInt(interval.from_ms) + BigInt(a.offsetSeconds) * 1000n,
      end =
        at +
        BigInt(
          Math.max(
            1,
            path.seconds + j.durationSeconds - (a.jobId === j.id ? a.progressSeconds : 0),
          ),
        ) *
          1000n;
    if (targetOccupied(db, cam, j, a.id, interval.epoch_id, at, end)) {
      reject(j, 'Ziel exklusiv belegt');
      continue;
    }
    if (
      j.exclusive &&
      db
        .prepare(
          'SELECT actor_id FROM autonomy_booking WHERE campaign_id=? AND job_id=? AND epoch_id=? AND actor_id<>? AND from_ms<? AND to_ms>? LIMIT 1',
        )
        .get(
          cam,
          j.id,
          interval.epoch_id,
          a.id,
          end.toString().padStart(30, '0'),
          at.toString().padStart(30, '0'),
        )
    ) {
      reject(j, 'Zeitraum exklusiv gebucht');
      continue;
    }
    if (
      j.kind === 'conflict' &&
      (!config.allowConflict ||
        !a.allowConflict ||
        !j.targetActorId ||
        !db.prepare('SELECT 1 FROM world_actor WHERE campaign_id=? AND id=?').get(cam, a.id) ||
        !db
          .prepare('SELECT 1 FROM world_actor WHERE campaign_id=? AND id=?')
          .get(cam, j.targetActorId) ||
        !db
          .prepare(
            "SELECT 1 FROM autonomy_actor WHERE campaign_id=? AND id=? AND json_extract(payload,'$.enabled')=1 AND json_extract(payload,'$.allowConflict')=1",
          )
          .get(cam, j.targetActorId))
    ) {
      reject(j, 'Konflikt-/HP-Owner nicht freigegeben');
      continue;
    }
    let priority = j.priority;
    const reasons = ['Grundpriorität ' + j.priority],
      bonus = config.jobPriorities[j.id] ?? 0;
    if (bonus) {
      priority += bonus;
      reasons.push('NPC-Bonus ' + bonus);
    }
    for (const n of a.needs) {
      const rule = config.needs.find((r: any) => r.id === n.id);
      if (rule?.enabled && j.needEffects[n.id]) {
        const add = n.value * rule.weight;
        priority += add;
        reasons.push(
          n.name +
            ' ' +
            Math.round(n.value * 100) / 100 +
            ' × ' +
            rule.weight +
            ' = ' +
            Math.round(add * 100) / 100,
        );
      }
    }
    if (config.assignedJobId === j.id) {
      priority += 1000;
      reasons.push('GM-Zuweisung 1000');
    }
    candidates.push({ job: j, target, path, priority, reason: reasons.join(' + ') });
  }
  candidates.sort((a, b) => b.priority - a.priority || compareIds(a.job.id, b.job.id));
  return {
    diagnostics: diagnostic
      ? [
          ...candidates.map((c) => ({
            jobId: c.job.id,
            revision: c.job.revision,
            name: c.job.name,
            eligible: true,
            priority: c.priority,
            reason: c.reason,
            travelSeconds: c.path.seconds,
            remainingSeconds: Math.max(
              1,
              c.path.seconds +
                c.job.durationSeconds -
                (a.jobId === c.job.id ? a.progressSeconds : 0),
            ),
          })),
          ...rejected,
        ]
      : [],
    candidate: candidates[0] ?? null,
    considered: candidates
      .slice(0, 6)
      .map((c) => ({ jobId: c.job.id, name: c.job.name, priority: c.priority, reason: c.reason })),
    consideredRemaining: Math.max(0, candidates.length - 6),
    excluded,
    excludedSummary: excluded.slice(0, 6),
    excludedRemaining: Math.max(0, excluded.length - 6),
  };
}
function samePosition(a: any, b: any) {
  return (
    !!a &&
    a.locationId === b.locationId &&
    a.revision === b.revision &&
    JSON.stringify(a.dungeon ?? null) === JSON.stringify(b.dungeon ?? null)
  );
}
function cancelJob(db: any, cam: string, a: AutonomyActor, reason: string) {
  const interval = db
    .prepare(
      'SELECT * FROM autonomy_interval WHERE campaign_id=? AND ordinal>? ORDER BY ordinal LIMIT 1',
    )
    .get(cam, a.cursor);
  releaseActorReservation(db, cam, a);
  if (a.jobId)
    log(db, cam, a.id, interval?.id ?? 'manual', 'cancel', reason, {
      jobId: a.jobId,
      progressSeconds: a.progressSeconds,
      position: a.positionBasis,
    });
  a.jobId = null;
  a.progressSeconds = 0;
  a.dungeonTravel = null;
}
function actorSettings(a: AutonomyActor) {
  return {
    enabled: a.enabled,
    paused: a.paused,
    role: a.role,
    needs: a.needs,
    jobPriorities: a.jobPriorities,
    assignedJobId: a.assignedJobId,
    allowConflict: a.allowConflict,
    defense: a.defense,
    attackBonus: a.attackBonus,
    maxHpLossPercent: a.maxHpLossPercent,
    sightMeters: a.sightMeters ?? 20,
    darkvisionMeters: a.darkvisionMeters ?? 0,
    hearingMeters: a.hearingMeters ?? 18,
    passivePerception: a.passivePerception ?? 10,
    stealthDc: a.stealthDc ?? 10,
  };
}
function pauseDecision(
  db: any,
  cam: string,
  a: AutonomyActor,
  interval: any,
  text: string,
  facts: any,
) {
  trimBookings(
    db,
    cam,
    a.id,
    interval.epoch_id,
    BigInt(interval.from_ms) + BigInt(a.offsetSeconds) * 1000n,
  );
  a.paused = true;
  a.pending = text;
  a.revision++;
  save(db, cam, 'autonomy_actor', a);
  db.prepare('DELETE FROM autonomy_reservation WHERE campaign_id=? AND actor_id=?').run(cam, a.id);
  log(db, cam, a.id, interval.id, 'decision', text, facts);
}
interface CatchUpBoundary {
  epochId: string;
  instantMs: string;
}
function actorConfirmedTime(db: any, cam: string, a: AutonomyActor) {
  const interval =
    a.offsetSeconds > 0
      ? db
          .prepare(
            'SELECT * FROM autonomy_interval WHERE campaign_id=? AND ordinal>? ORDER BY ordinal LIMIT 1',
          )
          .get(cam, a.cursor)
      : db
          .prepare(
            'SELECT * FROM autonomy_interval WHERE campaign_id=? AND ordinal<=? ORDER BY ordinal DESC LIMIT 1',
          )
          .get(cam, a.cursor);
  if (!interval) return null;
  checkedIntervalRow(db, cam, interval);
  return {
    epochId: interval.epoch_id,
    instantMs:
      a.offsetSeconds > 0
        ? BigInt(interval.from_ms) + BigInt(a.offsetSeconds) * 1000n
        : BigInt(interval.to_ms),
    intervalId: interval.id,
  };
}
// Release only predicted future occupancy; retain committed progress and elapsed bookings.
function releaseActorReservation(db: any, cam: string, a: AutonomyActor) {
  if (a.jobId) {
    const confirmed = actorConfirmedTime(db, cam, a);
    if (confirmed) trimBookings(db, cam, a.id, confirmed.epochId, confirmed.instantMs);
  }
  db.prepare('DELETE FROM autonomy_reservation WHERE campaign_id=? AND actor_id=?').run(cam, a.id);
}
export function catchUpAutonomy(
  db: any,
  cam: string,
  ids: string[],
  maxSteps = 12,
  boundary: CatchUpBoundary | null = null,
) {
  validateRuntimeLinks(db, cam);
  let progressed = 0;
  const spatialAdapter = dungeonAdapter(db, cam),
    limit = boundary ? BigInt(boundary.instantMs) : null;
  for (const id of [...new Set(ids)].sort()) {
    let a = actor(db, cam, id);
    if (!a.enabled || a.paused || !available(db, cam, id)) continue;
    if (boundary) {
      const confirmed = actorConfirmedTime(db, cam, a);
      if (confirmed?.epochId === boundary.epochId && confirmed.instantMs > limit!) {
        const text = 'NPC-Stand liegt zeitlich nach dieser Gruppe. Zeitkonflikt als GM klären.';
        a.paused = true;
        a.pending = text;
        a.revision++;
        save(db, cam, 'autonomy_actor', a);
        releaseActorReservation(db, cam, a);
        log(db, cam, a.id, confirmed.intervalId, 'decision', text, {
          epochId: boundary.epochId,
          actorInstantMs: confirmed.instantMs.toString(),
          sceneInstantMs: boundary.instantMs,
        });
        continue;
      }
    }
    let steps = 0;
    while (steps < maxSteps) {
      const interval = db
        .prepare(
          'SELECT * FROM autonomy_interval WHERE campaign_id=? AND ordinal>? ORDER BY ordinal LIMIT 1',
        )
        .get(cam, a.cursor);
      if (!interval) break;
      const basis = checkedIntervalRow(db, cam, interval);
      if (boundary && interval.epoch_id !== boundary.epochId) break;
      const from = BigInt(interval.from_ms),
        end = BigInt(interval.to_ms),
        allowedEnd = limit !== null && limit < end ? limit : end;
      if (allowedEnd <= from) break;
      const total = Number((end - from) / 1000n),
        allowed = Number((allowedEnd - from) / 1000n);
      if (allowed <= a.offsetSeconds) {
        if (a.offsetSeconds >= total) {
          a.cursor = interval.ordinal;
          a.offsetSeconds = 0;
          a.revision++;
          save(db, cam, 'autonomy_actor', a);
          continue;
        }
        break;
      }
      const config = basis.actors.find((x: any) => x.id === id);
      if (!config) {
        a.offsetSeconds = allowed;
        if (a.offsetSeconds >= total) {
          a.cursor = interval.ordinal;
          a.offsetSeconds = 0;
        }
        a.revision++;
        save(db, cam, 'autonomy_actor', a);
        if (a.cursor !== interval.ordinal) break;
        continue;
      }
      const position = npcPosition(db, cam, id);
      if (!samePosition(a.positionBasis, position)) {
        if (!samePosition(config.positionBasis, position)) {
          pauseDecision(
            db,
            cam,
            a,
            interval,
            'NPC-Position wurde außerhalb dieses ausstehenden Zeitraums geändert. Als GM klären.',
            {
              expectedPosition: a.positionBasis ?? null,
              confirmedPosition: config.positionBasis ?? null,
              currentPosition: position,
            },
          );
          break;
        }
        // A position already present when this interval was confirmed is an authorized new basis.
        if (a.positionBasis) {
          trimBookings(
            db,
            cam,
            id,
            interval.epoch_id,
            BigInt(interval.from_ms) + BigInt(a.offsetSeconds) * 1000n,
          );
          a.jobId = null;
          a.progressSeconds = 0;
          a.dungeonTravel = null;
          db.prepare('DELETE FROM autonomy_reservation WHERE campaign_id=? AND actor_id=?').run(
            cam,
            id,
          );
          log(
            db,
            cam,
            id,
            interval.id,
            'override',
            'Bestätigte neue Worldposition unterbricht den bisherigen Job.',
            { before: a.positionBasis, after: position },
          );
        }
        a.positionBasis = position;
      }
      const beforeStep = structuredClone(a),
        choice = choose(db, cam, a, config, basis, interval, spatialAdapter),
        c = choice.candidate;
      let seconds = Math.min(900, allowed - a.offsetSeconds);
      if (!c) {
        if (choice.excluded.some((x) => x.includes('geändert'))) {
          pauseDecision(
            db,
            cam,
            a,
            interval,
            'Ausstehender Zeitraum hat geänderte Angebots-/Weg-Owner. Als GM klären.',
            { excluded: choice.excludedSummary, excludedRemaining: choice.excludedRemaining },
          );
          break;
        }
        for (const n of a.needs) {
          const r = config.needs.find((x: any) => x.id === n.id);
          if (r?.enabled) n.value = Math.min(100, n.value + (r.ratePerHour * seconds) / 3600);
        }
        log(db, cam, a.id, interval.id, 'wait', 'Wartet: kein gültiger Job.', {
          excluded: choice.excludedSummary,
          excludedRemaining: choice.excludedRemaining,
          seconds,
        });
        a.jobId = null;
        a.progressSeconds = 0;
        a.dungeonTravel = null;
        db.prepare('DELETE FROM autonomy_reservation WHERE campaign_id=? AND actor_id=?').run(
          cam,
          id,
        );
      } else {
        const j = c.job;
        if (
          j.kind === 'conflict' &&
          (!available(db, cam, j.targetActorId) || !actor(db, cam, j.targetActorId).enabled)
        ) {
          log(db, cam, id, interval.id, 'wait', 'Konfliktziel nicht mehr verfügbar.', {});
          a.jobId = null;
          a.progressSeconds = 0;
          a.dungeonTravel = null;
        } else {
          const localTravel = 'dungeon' in c.path ? c.path.dungeon : null;
          const parties = localTravel
            ? []
            : j.kind === 'reset'
              ? db
                  .prepare(
                    "SELECT p.scene_id FROM scene_position p WHERE p.campaign_id=? AND json_extract(p.payload,'$.dungeon.roomId')=? AND EXISTS(SELECT 1 FROM roster_member r WHERE r.campaign_id=p.campaign_id AND r.scene_id=p.scene_id AND r.active=1)",
                  )
                  .all(cam, position.dungeon?.roomId)
                  .map((r: any) => r.scene_id)
              : partyAt(db, cam, c.path.places);
          if (
            (c.path.seconds > 0 || j.kind === 'conflict' || j.kind === 'reset') &&
            parties.length
          ) {
            pauseDecision(
              db,
              cam,
              a,
              interval,
              'Partygefahr vor ' + j.name + ' – Kontext öffnen und als GM entscheiden.',
              { partySceneIds: parties, jobId: j.id, route: c.path },
            );
            break;
          }
          if (j.kind === 'conflict') {
            const target = readWorldActor(db, cam, j.targetActorId!),
              source = readWorldActor(db, cam, id);
            if (source.hp <= 0 || target.hp <= 0 || target.concentrating) {
              pauseDecision(
                db,
                cam,
                a,
                interval,
                'Konfliktwirkung benötigt einen neuen GM-Stand: Kampfunfähigkeit oder Konzentration.',
                { jobId: j.id },
              );
              break;
            }
          }
          if (a.jobId !== j.id) {
            if (a.jobId)
              log(
                db,
                cam,
                id,
                interval.id,
                'interrupt',
                'Unterbricht bisherigen Job für ' + j.name + '.',
                {
                  previousJobId: a.jobId,
                  progressSeconds: a.progressSeconds,
                  position: a.positionBasis,
                },
              );
            if (a.jobId)
              trimBookings(
                db,
                cam,
                id,
                interval.epoch_id,
                BigInt(interval.from_ms) + BigInt(a.offsetSeconds) * 1000n,
              );
            db.prepare('DELETE FROM autonomy_reservation WHERE campaign_id=? AND actor_id=?').run(
              cam,
              id,
            );
            a.jobId = j.id;
            a.progressSeconds = 0;
            a.dungeonTravel = localTravel ?? null;
            log(db, cam, id, interval.id, 'job', 'Wählt ' + j.name + ': ' + c.reason, {
              jobId: j.id,
              priority: c.priority,
              considered: choice.considered,
              consideredRemaining: choice.consideredRemaining,
              excluded: choice.excludedSummary,
              excludedRemaining: choice.excludedRemaining,
              tieBreak: 'Priorität absteigend, bei Gleichstand Job-ID aufsteigend',
            });
          }
          if (j.exclusive)
            db.prepare(
              'INSERT INTO autonomy_reservation VALUES(?,?,?) ON CONFLICT(campaign_id,job_id) DO NOTHING',
            ).run(cam, j.id, id);
          const duration = Math.max(1, c.path.seconds + j.durationSeconds);
          const bookingStart = BigInt(interval.from_ms) + BigInt(a.offsetSeconds) * 1000n;
          bookTarget(
            db,
            cam,
            j,
            id,
            interval.epoch_id,
            bookingStart,
            bookingStart + BigInt(Math.max(1, duration - a.progressSeconds)) * 1000n,
          );
          seconds = Math.min(seconds, duration - a.progressSeconds);
          if (localTravel) {
            a.dungeonTravel ??= localTravel;
            const travelLeft =
              localTravel.segmentSeconds
                .slice(localTravel.nextIndex)
                .reduce((sum: number, n: number) => sum + n, 0) - localTravel.segmentElapsedSeconds;
            if (travelLeft > 0) {
              const moved = progressDungeonTravel(
                db,
                cam,
                a,
                localTravel,
                Math.min(seconds, travelLeft),
                interval,
                spatialAdapter,
                config,
              );
              const remainingTravel = localTravel.nextIndex < localTravel.route.length;
              seconds = moved.consumed + (remainingTravel ? 0 : Math.max(0, seconds - travelLeft));
              if (moved.consumed > 0)
                log(db, cam, id, interval.id, 'dungeon-move', 'Geht zum Raumjob ' + j.name + '.', {
                  jobId: j.id,
                  seconds: moved.consumed,
                  position: a.positionBasis?.dungeon,
                  waypoint: localTravel.nextIndex,
                });
              if (moved.decision) {
                a.progressSeconds += seconds;
                for (const n of a.needs) {
                  const r = config.needs.find((x: any) => x.id === n.id);
                  if (r?.enabled)
                    n.value = Math.min(100, n.value + (r.ratePerHour * seconds) / 3600);
                }
                a.offsetSeconds += seconds;
                pauseDecision(db, cam, a, interval, moved.decision.reason, moved.decision.facts);
                break;
              }
            }
            if (
              localTravel.nextIndex >= localTravel.route.length &&
              (j.kind === 'reset' || j.kind === 'conflict')
            ) {
              const parties = dungeonParties(
                db,
                cam,
                spatialAdapter(localTravel.snapshotId).geometry,
                npcPosition(db, cam, id).dungeon!,
                config.sightMeters,
                config.darkvisionMeters,
                config.hearingMeters,
                config.passivePerception,
                id,
              );
              if (parties.length) {
                pauseDecision(
                  db,
                  cam,
                  a,
                  interval,
                  'Party-Kontakt vor ' + j.name + '. Als GM klären.',
                  { partySceneIds: parties, jobId: j.id },
                );
                break;
              }
            }
          }
          a.progressSeconds += seconds;
          for (const n of a.needs) {
            const r = config.needs.find((x: any) => x.id === n.id);
            if (r?.enabled) n.value = Math.min(100, n.value + (r.ratePerHour * seconds) / 3600);
          }
          if (a.progressSeconds >= duration) {
            if (j.kind === 'reset') {
              resetDungeonFeatureByNpc(db, cam, j.featureId!);
              log(
                db,
                cam,
                id,
                interval.id,
                'reset',
                'Stellt Falle ' + j.name + ' im eigenen Raum wieder her.',
                { featureId: j.featureId, roomId: npcPosition(db, cam, id).dungeon?.roomId },
              );
            } else if (j.kind === 'conflict') {
              const defender = actor(db, cam, j.targetActorId),
                target = readWorldActor(db, cam, j.targetActorId),
                source = readWorldActor(db, cam, id);
              if (source.hp <= 0 || target.hp <= 0) {
                a = beforeStep;
                pauseDecision(
                  db,
                  cam,
                  a,
                  interval,
                  'Konflikt benötigt einen neuen GM-Stand: beteiligter NPC ist kampfunfähig.',
                  { jobId: j.id },
                );
                break;
              }
              if (target.concentrating) {
                a = beforeStep;
                pauseDecision(
                  db,
                  cam,
                  a,
                  interval,
                  'Konzentrationsfolge vor Konfliktwirkung vom GM klären.',
                  { jobId: j.id },
                );
                break;
              }
              if (c.target && c.target !== npcPosition(db, cam, id).locationId) {
                const p = npcPosition(db, cam, id);
                placeNpc(db, cam, id, c.target, p.revision);
                a.positionBasis = npcPosition(db, cam, id);
                log(db, cam, id, interval.id, 'move', 'Erreicht den Konfliktort.', {
                  locationId: c.target,
                });
              }
              const roll = randomInt(1, 21),
                hit = roll + config.attackBonus >= defender.defense,
                limit = Math.floor(
                  (target.maxHp *
                    Math.min(
                      config.maxHpLossPercent,
                      a.maxHpLossPercent,
                      defender.maxHpLossPercent,
                    )) /
                    100,
                ),
                damage = hit ? Math.max(0, Math.min(j.maxDamage, limit, target.hp - 1)) : 0,
                absorbed = Math.min(target.tempHp, damage);
              writeWorldActorHealth(db, cam, target.id, target.revision, {
                hp: target.hp - (damage - absorbed),
                maxHp: target.maxHp,
                tempHp: target.tempHp - absorbed,
                conditions: target.conditions,
                concentrating: target.concentrating,
              });
              log(
                db,
                cam,
                id,
                interval.id,
                'conflict',
                'Begrenzter NPC-Konflikt: Wurf ' +
                  roll +
                  ' + ' +
                  config.attackBonus +
                  ' gegen ' +
                  defender.defense +
                  ', Schaden ' +
                  damage +
                  '.',
                {
                  jobId: j.id,
                  targetActorId: target.id,
                  roll,
                  bonus: config.attackBonus,
                  defense: defender.defense,
                  damage,
                  beforeHp: target.hp,
                  afterHp: target.hp - (damage - absorbed),
                },
              );
            } else if (c.target && c.target !== npcPosition(db, cam, id).locationId) {
              const p = npcPosition(db, cam, id);
              placeNpc(db, cam, id, c.target, p.revision);
              a.positionBasis = npcPosition(db, cam, id);
              log(db, cam, id, interval.id, 'move', 'Erreicht den Jobort für ' + j.name + '.', {
                locationId: c.target,
                routeIds: c.path.routes.map((r: any) => r.id),
              });
            }
            for (const n of a.needs)
              n.value = Math.max(0, Math.min(100, n.value - (j.needEffects[n.id] ?? 0)));
            log(db, cam, id, interval.id, 'complete', j.name + ' abgeschlossen.', {
              jobId: j.id,
              seconds: duration,
              needEffects: j.needEffects,
            });
            a.jobId = null;
            a.progressSeconds = 0;
            a.dungeonTravel = null;
            db.prepare('DELETE FROM autonomy_reservation WHERE campaign_id=? AND actor_id=?').run(
              cam,
              id,
            );
          }
        }
      }
      a.offsetSeconds += seconds;
      if (a.offsetSeconds >= total) {
        a.cursor = interval.ordinal;
        a.offsetSeconds = 0;
      }
      a.revision++;
      save(db, cam, 'autonomy_actor', a);
      progressed++;
      steps++;
    }
  }
  return {
    progressed,
    pending: rows<AutonomyActor>(db, cam, 'autonomy_actor').filter(
      (a) => a.enabled && a.cursor < maxOrdinal(db, cam),
    ).length,
  };
}
export function autonomyDecision(db: any, cam: string, id: string): AutonomyDecision {
  return db.transaction(() => {
    const a = actor(db, cam, id),
      position = npcPosition(db, cam, id),
      live = readLive(db, cam),
      stored = db
        .prepare(
          'SELECT * FROM autonomy_interval WHERE campaign_id=? AND ordinal>? ORDER BY ordinal LIMIT 1',
        )
        .get(cam, a.cursor);
    const preview = currentDungeonPreview(db, cam, position.dungeon?.scopeId ?? null),
      instant = live.scene?.clock.instantMs ?? '0',
      epoch = live.scene?.clock.epochId ?? 'preview';
    const interval = stored ?? { from_ms: instant, to_ms: instant, epoch_id: epoch },
      basis = stored
        ? checkedIntervalRow(db, cam, stored)
        : {
            actors: [{ ...a, positionBasis: position }],
            jobs: rows<AutonomyJob>(db, cam, 'autonomy_job'),
            routes: npcRoutes(db, cam),
            spatial: preview.spatial,
            features: db
              .prepare(
                "SELECT id,revision FROM drawing_element WHERE campaign_id=? AND kind='feature'",
              )
              .all(cam),
          },
      config = basis.actors.find((x: any) => x.id === id),
      blockers: string[] = [];
    if (!available(db, cam, id)) blockers.push('NPC nicht verfügbar.');
    if (!a.enabled) blockers.push('Autonomie ausgeschaltet.');
    if (a.paused) blockers.push(a.pending ?? 'Vom GM pausiert.');
    if (!stored)
      blockers.push(
        'Keine bestätigte Zeit offen; dies ist eine Vorschau mit der aktuellen Konfiguration.',
      );
    if (!config) blockers.push('Dieser NPC war im nächsten bestätigten Zeitraum nicht aktiviert.');
    const inspected = structuredClone(a);
    if (stored && !samePosition(a.positionBasis, position)) {
      if (!samePosition(config?.positionBasis, position))
        blockers.push(
          'Worldposition außerhalb des ausstehenden Zeitraums geändert; GM-Entscheidung nötig.',
        );
      else {
        inspected.jobId = null;
        inspected.progressSeconds = 0;
        inspected.dungeonTravel = null;
      }
    }
    const choice = choose(
        db,
        cam,
        inspected,
        config ?? a,
        basis,
        interval,
        stored ? dungeonAdapter(db, cam) : preview.adapter,
        true,
      ),
      selected = choice.candidate;
    if (selected) {
      const j = selected.job,
        local = selected.path.dungeon;
      if (local && position.dungeon) {
        const parties = dungeonParties(
          db,
          cam,
          (stored ? dungeonAdapter(db, cam) : preview.adapter)(local.snapshotId).geometry,
          position.dungeon,
          config?.sightMeters ?? a.sightMeters ?? 20,
          config?.darkvisionMeters ?? a.darkvisionMeters ?? 0,
          config?.hearingMeters ?? a.hearingMeters ?? 18,
          config?.passivePerception ?? a.passivePerception ?? 10,
          null,
          {
            epochId: interval.epoch_id,
            instantMs: String(
              BigInt(interval.from_ms) + (stored ? BigInt(a.offsetSeconds) * 1000n : 0n),
            ),
          },
        );
        if (parties.length)
          blockers.push(
            'Party-Kontakt im Dungeon: vor Annäherung oder Wirkung als GM entscheiden.',
          );
      } else if (
        (selected.path.seconds > 0 || j.kind === 'conflict' || j.kind === 'reset') &&
        partyAt(db, cam, selected.path.places).length
      )
        blockers.push(
          'Partygefahr auf dem gewählten Weg oder am Ziel: Ausführung hält für den GM an.',
        );
    }
    return {
      actorId: a.id,
      actorRevision: a.revision,
      basis: stored ? 'confirmed' : 'current',
      instantMs: String(BigInt(interval.from_ms) + (stored ? BigInt(a.offsetSeconds) * 1000n : 0n)),
      throughMs: stored ? interval.to_ms : null,
      needs: a.needs.map((n) => ({
        ...n,
        enabled: config?.needs.find((r: any) => r.id === n.id)?.enabled ?? n.enabled,
        weight: config?.needs.find((r: any) => r.id === n.id)?.weight ?? n.weight,
        ratePerHour: config?.needs.find((r: any) => r.id === n.id)?.ratePerHour ?? n.ratePerHour,
      })),
      selectedJobId: selected?.job.id ?? null,
      runningJobId: a.jobId,
      blockers,
      candidates: choice.diagnostics,
      tieBreak: 'Priorität absteigend, bei Gleichstand Job-ID aufsteigend',
    };
  })();
}
export function autonomyView(db: any, cam: string): AutonomyView {
  const positionFor = npcPositionReader(db, cam),
    nameFor = db.prepare(
      "SELECT json_extract(payload,'$.title') name FROM world_note WHERE campaign_id=? AND id=?",
    ),
    locations = db
      .prepare(
        "SELECT id,json_extract(payload,'$.name') name FROM location WHERE campaign_id=? AND trashed=0 ORDER BY name",
      )
      .all(cam),
    latest = maxOrdinal(db, cam),
    names = new Map<string, string>(locations.map((l: any) => [l.id, l.name])),
    actors = rows<AutonomyActor>(db, cam, 'autonomy_actor').map((a) => {
      const n = nameFor.get(cam, a.id),
        p = positionFor(a.id);
      return {
        ...a,
        name: n?.name ?? 'Fehlender NPC',
        locationId: p.locationId,
        positionRevision: p.revision,
        dungeonPosition: p.dungeon ?? null,
        locationName: names.get(p.locationId ?? '') ?? 'Unplatziert',
        remaining: latest - a.cursor,
      };
    });
  return {
    actors,
    available: db
      .prepare(
        "SELECT id,json_extract(payload,'$.title') name FROM world_note WHERE campaign_id=? AND json_extract(payload,'$.kind')='npc' AND trashed=0 ORDER BY name LIMIT 2000",
      )
      .all(cam)
      .map((r: any) => ({ ...r, locationId: positionFor(r.id).locationId })),
    groups: db
      .prepare('SELECT id FROM prepared_group WHERE campaign_id=? AND draft_plan_id IS NULL')
      .all(cam)
      .map((r: any) => {
        const g = readPreparedGroup(db, cam, r.id);
        return {
          id: g.id,
          revision: g.revision,
          name: g.title,
          actorIds: g.actors.map((a) => a.id),
        };
      }),
    locations,
    routes: npcRoutes(db, cam),
    rooms: db
      .prepare(
        "SELECT r.id,r.number||'. '||r.name name,r.scope_id scopeId,r.floor_id floorId,l.location_id locationId FROM room r LEFT JOIN location_map l ON l.campaign_id=r.campaign_id AND l.scope_id=r.scope_id WHERE r.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1) ORDER BY r.number",
      )
      .all(cam),
    features: readDrawingElements(db, cam)
      .filter(
        (e) => !e.archived && e.kind === 'feature' && e.feature === 'trap' && e.roomId !== null,
      )
      .map((e) => ({ id: e.id, name: e.name || 'Falle' })),
    jobs: rows(db, cam, 'autonomy_job'),
    logs: db
      .prepare('SELECT * FROM autonomy_log WHERE campaign_id=? ORDER BY rowid DESC LIMIT 100')
      .all(cam)
      .map((r: any) => checkedLog(db, r)),
    confirmed: ((row) => (row ? checkedFrontier(db, cam, row).instant_ms : '0'))(
      db
        .prepare('SELECT * FROM autonomy_frontier WHERE campaign_id=? ORDER BY rowid DESC LIMIT 1')
        .get(cam),
    ),
    pendingActors: actors.filter((a) => a.enabled && a.remaining > 0).length,
  };
}
export function executeAutonomy(db: any, c: AutonomyCommand, guard: () => void) {
  return db
    .transaction(() => {
      guard();
      const a = c.action;
      if (
        !a ||
        typeof a !== 'object' ||
        ![
          'actor',
          'group-enable',
          'route',
          'job',
          'catch-up',
          'place',
          'pause',
          'assign',
          'accept-pending',
        ].includes(a.kind)
      )
        throw new Error('Unbekannte Autonomieaktion.');
      const fp = hash(JSON.stringify({ ...c, token: undefined })),
        receipt = db.prepare('SELECT * FROM autonomy_receipt WHERE command_id=?').get(c.commandId);
      if (receipt) {
        if (receipt.fingerprint !== fp)
          throw new Error('Autonomieänderungskennung anders verwendet.');
        const progress = checkedReceipt(receipt, c.campaignId);
        return { view: autonomyView(db, c.campaignId), ...progress };
      }
      const cam = c.campaignId;
      let progress = { progressed: 0, pending: 0 };
      if (a.kind === 'actor') {
        if (!available(db, cam, a.actor.id)) throw new Error('Bestehenden NPC wählen.');
        const old = db
          .prepare('SELECT * FROM autonomy_actor WHERE campaign_id=? AND id=?')
          .get(cam, a.actor.id);
        if ((old?.revision ?? null) !== a.expectedRevision)
          throw new Error('NPC-Konfiguration geändert.');
        const n = {
          ...(old ? parsed<AutonomyActor>(old) : defaultActor(db, cam, a.actor.id)),
          ...actorSettings(a.actor),
          revision: (old?.revision ?? 0) + 1,
        };
        checkActor(n);
        if (!old && a.initialLocationId)
          placeNpc(db, cam, n.id, a.initialLocationId, npcPosition(db, cam, n.id).revision);
        if (!old) n.positionBasis = npcPosition(db, cam, n.id);
        save(db, cam, 'autonomy_actor', n);
        if (!n.enabled || n.paused) releaseActorReservation(db, cam, n);
      } else if (a.kind === 'group-enable') {
        const g = readPreparedGroup(db, cam, a.groupId);
        if (g.revision !== a.expectedRevision)
          throw new Error('Vorbereitete Gruppe geändert. Erneut ansehen.');
        for (const member of g.actors) {
          if (!available(db, cam, member.id)) continue;
          const old = db
              .prepare('SELECT * FROM autonomy_actor WHERE campaign_id=? AND id=?')
              .get(cam, member.id),
            n = old ? parsed<AutonomyActor>(old) : defaultActor(db, cam, member.id);
          n.enabled = a.enabled;
          n.paused = !!n.pending;
          if (old) n.revision++;
          checkActor(n);
          save(db, cam, 'autonomy_actor', n);
          if (!n.enabled || n.paused) releaseActorReservation(db, cam, n);
          log(
            db,
            cam,
            n.id,
            'manual',
            'override',
            (a.enabled ? 'Aktiviert' : 'Deaktiviert') + ' Autonomie über Gruppe ' + g.title + '.',
            { groupId: g.id, groupRevision: g.revision, enabled: a.enabled },
          );
        }
      } else if (a.kind === 'route') {
        saveNpcRoute(db, cam, a.route, a.expectedRevision);
      } else if (a.kind === 'job') {
        const j = a.job,
          old = db
            .prepare('SELECT revision FROM autonomy_job WHERE campaign_id=? AND id=?')
            .get(cam, j.id);
        if ((old?.revision ?? null) !== a.expectedRevision) throw new Error('Angebot geändert.');
        checkedAutonomyJob({ ...j, revision: (old?.revision ?? 0) + 1 });
        if (
          (j.roomId &&
            !db.prepare('SELECT 1 FROM room WHERE campaign_id=? AND id=?').get(cam, j.roomId)) ||
          (j.patrolRoomId &&
            !db
              .prepare('SELECT 1 FROM room WHERE campaign_id=? AND id=?')
              .get(cam, j.patrolRoomId)) ||
          (j.speedMetersPerMinute !== undefined &&
            (!Number.isFinite(j.speedMetersPerMinute) ||
              j.speedMetersPerMinute < 0.1 ||
              j.speedMetersPerMinute > 1000))
        )
          throw new Error('Jobraum und metrisches Tempo prüfen.');
        if (
          j.kind === 'reset' &&
          (!j.featureId ||
            !db
              .prepare(
                "SELECT 1 FROM drawing_element WHERE campaign_id=? AND id=? AND kind='feature'",
              )
              .get(cam, j.featureId))
        )
          throw new Error('Falle für Reset-Job auswählen.');
        save(db, cam, 'autonomy_job', { ...j, revision: (old?.revision ?? 0) + 1 });
      } else if (a.kind === 'catch-up') {
        if (!Number.isSafeInteger(a.maxSteps) || a.maxSteps < 1 || a.maxSteps > 24)
          throw new Error('Schrittbudget prüfen.');
        progress = catchUpAutonomy(db, cam, a.actorIds, a.maxSteps);
      } else if (a.kind === 'place') {
        placeNpc(db, cam, a.actorId, a.locationId, a.expectedPositionRevision);
        log(db, cam, a.actorId, 'manual', 'override', 'GM setzt NPC-Ort: ' + a.reason, {
          locationId: a.locationId,
        });
      } else {
        const n = actor(db, cam, a.actorId);
        if (n.revision !== a.expectedRevision) throw new Error('NPC-Stand geändert.');
        if (a.kind === 'pause') {
          if (!a.paused && n.pending)
            throw new Error('Ausstehende GM-Entscheidung begründet klären.');
          n.paused = a.paused;
          if (a.paused) releaseActorReservation(db, cam, n);
        }
        if (a.kind === 'assign') {
          cancelJob(
            db,
            cam,
            n,
            a.jobId ? 'GM weist einen anderen Job zu.' : 'GM bricht den zugewiesenen Job ab.',
          );
          n.assignedJobId = a.jobId;
          n.jobId = null;
          n.progressSeconds = 0;
          n.dungeonTravel = null;
        }
        if (a.kind === 'accept-pending') {
          if (!n.pending) throw new Error('Keine ausstehende GM-Entscheidung.');
          if (!['resume', 'skip'].includes(a.resolution))
            throw new Error('GM-Entscheidung prüfen.');
          if (typeof a.reason !== 'string' || !a.reason.trim() || a.reason.length > 1000)
            throw new Error('GM-Entscheidung begründen.');
          if (a.resolution === 'skip') {
            const interval = db
              .prepare(
                'SELECT ordinal,id FROM autonomy_interval WHERE campaign_id=? AND ordinal>? ORDER BY ordinal LIMIT 1',
              )
              .get(cam, n.cursor);
            if (interval) {
              n.cursor = interval.ordinal;
              n.offsetSeconds = 0;
            }
            log(
              db,
              cam,
              n.id,
              interval?.id ?? 'manual',
              'override',
              'GM lässt diesen ausstehenden Zeitraum aus: ' + a.reason,
              {},
            );
          }
          const currentPosition = npcPosition(db, cam, n.id),
            jobRestarted =
              a.resolution === 'skip' || !samePosition(n.positionBasis, currentPosition);
          log(
            db,
            cam,
            n.id,
            'manual',
            'override',
            'GM klärt ausstehende Autonomie: ' +
              a.resolution +
              ' – ' +
              a.reason +
              (jobRestarted && n.jobId
                ? ' · Job wird neu gewählt (' + n.progressSeconds + ' s bisheriger Fortschritt).'
                : ''),
            {
              beforePosition: n.positionBasis ?? null,
              currentPosition,
              cursor: n.cursor,
              offsetSeconds: n.offsetSeconds,
              jobId: n.jobId,
              progressSeconds: n.progressSeconds,
              jobRestarted,
            },
          );
          n.positionBasis = currentPosition;
          n.paused = false;
          n.pending = null;
          if (jobRestarted) {
            n.jobId = null;
            n.progressSeconds = 0;
            n.dungeonTravel = null;
          }
        }
        n.revision++;
        checkActor(n);
        save(db, cam, 'autonomy_actor', n);
        db.prepare('DELETE FROM autonomy_reservation WHERE campaign_id=? AND actor_id=?').run(
          cam,
          n.id,
        );
      }
      const live = readLive(db, cam);
      if (live.scene)
        db.prepare('INSERT OR IGNORE INTO autonomy_frontier VALUES(?,?,?)').run(
          cam,
          live.scene.clock.epochId,
          live.scene.clock.instantMs,
        );
      const p = JSON.stringify(progress);
      db.prepare('INSERT INTO autonomy_receipt VALUES(?,?,?,?,?)').run(
        cam,
        c.commandId,
        fp,
        p,
        hash(p),
      );
      checkedReceipt(
        db.prepare('SELECT * FROM autonomy_receipt WHERE command_id=?').get(c.commandId),
        cam,
      );
      return { view: autonomyView(db, cam), ...progress };
    })
    .immediate();
}
export function validateAutonomy(db: any) {
  for (const row of db.prepare('SELECT * FROM autonomy_job').iterate()) checkedJobRow(row);
  for (const row of db.prepare('SELECT * FROM autonomy_actor').iterate()) {
    const a = parsed<AutonomyActor>(row);
    checkActor(a);
    if (a.id !== row.id || a.revision !== row.revision)
      throw new Error('Autonomieidentität widersprüchlich.');
  }
  for (const row of db.prepare('SELECT * FROM autonomy_dungeon_basis').iterate())
    checkedAutonomyDungeonBasis(row, row.campaign_id);
  for (const row of db.prepare('SELECT * FROM autonomy_interval').iterate())
    checkedIntervalRow(db, row.campaign_id, row);
  for (const row of db.prepare('SELECT * FROM autonomy_frontier').iterate())
    checkedFrontier(db, row.campaign_id, row);
  for (const row of db.prepare('SELECT * FROM autonomy_log').iterate()) checkedLog(db, row);
  for (const row of db.prepare('SELECT * FROM autonomy_receipt').iterate())
    checkedReceipt(row, row.campaign_id);
  for (const row of db
    .prepare(
      'SELECT DISTINCT campaign_id FROM autonomy_actor UNION SELECT DISTINCT campaign_id FROM autonomy_booking UNION SELECT DISTINCT campaign_id FROM autonomy_target_booking',
    )
    .iterate())
    validateRuntimeLinks(db, row.campaign_id);
}
