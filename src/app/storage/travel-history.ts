import { createHash, randomUUID } from 'node:crypto';
import { canonicalJson } from '../campaign/generation/canonical-json';
import type { SceneWorld, TravelHistoryView } from '../runtime/world-contracts';

type Row = Record<string, string | number | null>;
interface Effect {
  table: string;
  before: Row | null;
  after: Row | null;
}
interface Checkpoint {
  version: 1;
  id: string;
  sceneId: string;
  journeyId: string;
  commandId: string;
  ordinal: number;
  actorIds: string[];
  membershipRevision: number;
  epochId: string;
  from: string;
  to: string;
  fromHex: { q: number; r: number };
  toHex: { q: number; r: number };
  effects: Effect[];
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
const literal = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const equal = (a: unknown, b: unknown) =>
  a === undefined || b === undefined ? a === b : canonicalJson(a) === canonicalJson(b);
// These are runtime projections changed by checkpoint/time consumers. Authored
// definitions and opaque capabilities are deliberately not writable by history.
const mutable = new Set([
  'scene_clock',
  'scene_position',
  'live_scene',
  'live_scene_extra',
  'world_journey',
  'world_notice',
  'world_record',
  'atlas_knowledge',
  'player_hex_memory',
  'shop',
  'shop_event',
  'dungeon_feature_state',
  'autonomy_actor',
  'autonomy_interval',
  'autonomy_frontier',
  'autonomy_reservation',
  'autonomy_booking',
  'autonomy_log',
  'autonomy_target_booking',
  'npc_position',
  'npc_dungeon_position',
  'dungeon_track',
  'world_actor',
  'dungeon_trace',
  'dungeon_signal',
  'dungeon_perception',
  'dungeon_slice_memory',
  'dungeon_npc_knowledge',
  'dungeon_perception_log',
]);
const audit = (table: string) =>
  table === 'receipt' ||
  table.endsWith('_receipt') ||
  table === 'world_history' ||
  table === 'scene_time_step' ||
  table === 'travel_checkpoint' ||
  table === 'autonomy_dungeon_basis';
interface Table {
  columns: string[];
  keys: string[];
}
const tablesByDb = new WeakMap<object, Map<string, Table>>();
function tables(db: any) {
  let value = tablesByDb.get(db);
  if (value) return value;
  value = new Map();
  for (const row of db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE '%VIRTUAL%'",
    )
    .all()) {
    const columns = db.pragma('table_info(' + quote(row.name) + ')');
    if (!columns.some((c: any) => c.name === 'campaign_id')) continue;
    value.set(row.name, {
      columns: columns.map((c: any) => c.name),
      keys: columns
        .filter((c: any) => c.pk)
        .sort((a: any, b: any) => a.pk - b.pk)
        .map((c: any) => c.name),
    });
  }
  tablesByDb.set(db, value);
  return value;
}
export function installTravelHistory(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS travel_checkpoint(
 campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,id TEXT NOT NULL,ordinal INTEGER NOT NULL,
 applied INTEGER NOT NULL CHECK(applied IN(0,1)),abandoned INTEGER NOT NULL CHECK(abandoned IN(0,1)),retained INTEGER NOT NULL CHECK(retained IN(0,1)),
 revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,
 PRIMARY KEY(campaign_id,id),UNIQUE(campaign_id,scene_id,ordinal),
 FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;`);
}

const recorders = new WeakSet<object>();
/** SQLite records only rows actually written inside the checkpoint transaction.
 * The temporary buffer is connection-local; no campaign snapshot or second store. */
export function captureTravelEffects(db: any, cam: string) {
  if (
    !recorders.has(db) ||
    !db.prepare("SELECT 1 FROM sqlite_temp_master WHERE name='travel_capture'").get()
  ) {
    db.exec(
      'CREATE TEMP TABLE travel_capture(campaign_id TEXT); CREATE TEMP TABLE travel_delta(table_name TEXT,before_json TEXT,after_json TEXT);',
    );
    for (const [name, t] of tables(db)) {
      if (audit(name)) continue;
      const object = (side: string) =>
        'json_object(' +
        t.columns.flatMap((c) => [literal(c), side + '.' + quote(c)]).join(',') +
        ')';
      for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
        const side = operation === 'DELETE' ? 'OLD' : 'NEW';
        db.exec(`CREATE TEMP TRIGGER ${quote('travel_capture_' + name + '_' + operation)} AFTER ${operation} ON main.${quote(name)}
     WHEN ${side}.campaign_id=(SELECT campaign_id FROM travel_capture LIMIT 1)
     BEGIN INSERT INTO travel_delta VALUES(${literal(name)},${operation === 'INSERT' ? 'NULL' : object('OLD')},${operation === 'DELETE' ? 'NULL' : object('NEW')}); END;`);
      }
    }
    recorders.add(db);
  }
  if (db.prepare('SELECT 1 FROM travel_capture').get())
    throw Error('Verschachtelter Reisecheckpoint ist nicht zulässig.');
  db.exec('DELETE FROM travel_delta');
  db.prepare('INSERT INTO travel_capture VALUES(?)').run(cam);
  let finished = false;
  const cancel = () => {
    db.exec('DELETE FROM travel_capture; DELETE FROM travel_delta');
    finished = true;
  };
  return {
    cancel,
    finish: () => {
      if (finished) throw Error('Reisecheckpoint bereits abgeschlossen.');
      const changes = new Map<string, Effect>();
      try {
        for (const row of db.prepare('SELECT * FROM travel_delta ORDER BY rowid').iterate()) {
          if (!mutable.has(row.table_name))
            throw Error(
              'Zeitfolge ohne geprüfte Reise-Rücknahme: ' +
                row.table_name +
                '. Reise bleibt unverändert.',
            );
          const before: Row | null = row.before_json ? JSON.parse(row.before_json) : null,
            after: Row | null = row.after_json ? JSON.parse(row.after_json) : null;
          const t = tables(db).get(row.table_name)!;
          if (!t.keys.length) throw Error('Zeitfolge besitzt keine stabile Identität.');
          const key = canonicalJson([row.table_name, ...t.keys.map((k) => (before ?? after)![k])]),
            previous = changes.get(key);
          changes.set(key, {
            table: row.table_name,
            before: previous ? previous.before : before,
            after,
          });
        }
        return [...changes.values()].filter((e) => !equal(e.before, e.after));
      } finally {
        cancel();
      }
    },
  };
}
function checked(db: any, row: any): Checkpoint {
  if (!row || hash(row.payload) !== row.checksum)
    throw Error('Reisecheckpoint fehlt oder ist beschädigt.');
  const p = JSON.parse(row.payload) as Checkpoint;
  if (
    p.version !== 1 ||
    p.id !== row.id ||
    p.sceneId !== row.scene_id ||
    p.ordinal !== row.ordinal ||
    !Number.isSafeInteger(p.ordinal) ||
    p.ordinal < 1 ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    ![0, 1].includes(row.applied) ||
    ![0, 1].includes(row.abandoned) ||
    ![0, 1].includes(row.retained) ||
    !Array.isArray(p.effects) ||
    !Array.isArray(p.actorIds) ||
    !p.actorIds.every((id) => typeof id === 'string') ||
    !Number.isSafeInteger(p.membershipRevision) ||
    !/^(0|[1-9][0-9]{0,29})$/.test(p.from) ||
    !/^(0|[1-9][0-9]{0,29})$/.test(p.to) ||
    BigInt(p.to) <= BigInt(p.from)
  )
    throw Error('Reisecheckpoint hat ein ungültiges Format.');
  if (
    [p.id, p.sceneId, p.journeyId, p.commandId, p.epochId].some(
      (id) => typeof id !== 'string' || !id || id.length > 2000,
    ) ||
    !p.actorIds.length ||
    new Set(p.actorIds).size !== p.actorIds.length ||
    p.membershipRevision < 0 ||
    [p.fromHex, p.toHex].some(
      (h) => !h || ![h.q, h.r].every((n) => Number.isSafeInteger(n) && Math.abs(n) <= 1e9),
    )
  )
    throw Error('Reisecheckpoint besitzt keine gültige Ursache oder Gruppe.');
  const identities = new Set<string>();
  for (const e of p.effects) {
    const t = tables(db).get(e.table);
    if (!mutable.has(e.table) || !t || !t.keys.length || (!e.before && !e.after))
      throw Error('Unbekannte oder ungebundene Reisezeitfolge.');
    for (const v of [e.before, e.after])
      if (v) {
        if (
          v.campaign_id !== row.campaign_id ||
          (e.table === 'world_record' && v.kind !== 'weather-state') ||
          Object.keys(v).some((k) => !t.columns.includes(k)) ||
          t.columns.some((k) => !Object.hasOwn(v, k)) ||
          Object.values(v).some(
            (x) =>
              (x !== null && typeof x !== 'string' && typeof x !== 'number') ||
              (typeof x === 'number' && !Number.isFinite(x)),
          )
        )
          throw Error('Reisezeitfolge gehört nicht zur Kampagne oder zum Speicherformat.');
        if (
          (['scene_clock', 'scene_position', 'live_scene_extra'].includes(e.table) &&
            v.scene_id !== p.sceneId) ||
          (e.table === 'live_scene' && v.id !== p.sceneId) ||
          (e.table === 'world_journey' && (v.id !== p.journeyId || v.scene_id !== p.sceneId)) ||
          (e.table === 'world_record' && v.id !== p.sceneId)
        )
          throw Error('Reisezeitfolge besitzt einen fremden Gruppenowner.');
        if (typeof v.payload === 'string') {
          if (typeof v.checksum === 'string' && hash(v.payload) !== v.checksum)
            throw Error('Reisezeitfolge hat eine ungültige Prüfsumme.');
          const body = JSON.parse(v.payload);
          if (
            (Object.hasOwn(body, 'id') && v.id !== undefined && body.id !== v.id) ||
            (Object.hasOwn(body, 'revision') &&
              v.revision !== undefined &&
              body.revision !== v.revision)
          )
            throw Error('Reisezeitfolge widerspricht ihrer Speicheridentität.');
          if (
            e.table === 'dungeon_feature_state' &&
            (!Number.isSafeInteger(body.charges) || body.charges < 0)
          )
            throw Error('Reisezeitfolge enthält eine ungültige Fallenladung.');
        }
      }
    const identity = canonicalJson([e.table, ...t.keys.map((k) => (e.before ?? e.after)![k])]);
    if (identities.has(identity)) throw Error('Reisezeitfolge enthält doppelte Identitäten.');
    identities.add(identity);
    if (e.before && e.after && t.keys.some((k) => e.before![k] !== e.after![k]))
      throw Error('Reisezeitfolge ändert ihre Identität.');
  }
  const clock = p.effects.find((e) => e.table === 'scene_clock'),
    journey = p.effects.find((e) => e.table === 'world_journey'),
    position = p.effects.find((e) => e.table === 'scene_position');
  if (
    !clock?.before ||
    !clock.after ||
    clock.before.instant_ms !== p.from ||
    clock.after.instant_ms !== p.to ||
    clock.before.epoch_id !== p.epochId ||
    clock.after.epoch_id !== p.epochId ||
    !journey?.before ||
    !journey.after ||
    !position?.before ||
    !position.after
  )
    throw Error('Reisecheckpoint besitzt keine vollständige Positions- und Zeitwirkung.');
  const fromJourney = JSON.parse(journey.before.payload as string),
    toJourney = JSON.parse(journey.after.payload as string),
    fromPosition = JSON.parse(position.before.payload as string),
    toPosition = JSON.parse(position.after.payload as string);
  if (
    toJourney.nextIndex !== fromJourney.nextIndex + 1 ||
    !equal(fromJourney.route, toJourney.route) ||
    !equal(fromJourney.route[fromJourney.nextIndex - 1], p.fromHex) ||
    !equal(toJourney.route[toJourney.nextIndex - 1], p.toHex) ||
    fromPosition.q !== p.fromHex.q ||
    fromPosition.r !== p.fromHex.r ||
    toPosition.q !== p.toHex.q ||
    toPosition.r !== p.toHex.r
  )
    throw Error('Reisecheckpoint widerspricht seinem Wegabschnitt.');
  const cause = db
    .prepare('SELECT * FROM scene_time_step WHERE campaign_id=? AND scene_id=? AND command_id=?')
    .get(row.campaign_id, p.sceneId, p.commandId);
  if (!cause || hash(cause.payload) !== cause.checksum)
    throw Error('Ursprünglicher Reisezeitbeleg fehlt oder ist beschädigt.');
  const time = JSON.parse(cause.payload);
  if (
    time.calendarVersion !== 'relative-v1' ||
    time.epochId !== p.epochId ||
    time.from !== p.from ||
    time.to !== p.to
  )
    throw Error('Reisecheckpoint widerspricht seinem ursprünglichen Zeitbeleg.');
  return p;
}
export function recordTravelCheckpoint(
  db: any,
  cam: string,
  commandId: string,
  before: SceneWorld,
  after: SceneWorld,
  effects: Effect[],
) {
  const j = after.journey!;
  const ordinal = db
    .prepare(
      'SELECT coalesce(max(ordinal),0)+1 n FROM travel_checkpoint WHERE campaign_id=? AND scene_id=?',
    )
    .get(cam, before.scene.id).n;
  const p: Checkpoint = {
    version: 1,
    id: randomUUID(),
    sceneId: before.scene.id,
    journeyId: j.id,
    commandId,
    ordinal,
    actorIds: [...before.scene.members],
    membershipRevision: before.scene.membershipRevision,
    epochId: before.scene.clock.epochId,
    from: before.scene.clock.instantMs,
    to: after.scene.clock.instantMs,
    fromHex: { q: before.position.q, r: before.position.r },
    toHex: { q: after.position.q, r: after.position.r },
    effects,
  };
  db.prepare(
    'UPDATE travel_checkpoint SET abandoned=1 WHERE campaign_id=? AND scene_id=? AND applied=0',
  ).run(cam, p.sceneId);
  const payload = JSON.stringify(p);
  checked(db, {
    campaign_id: cam,
    scene_id: p.sceneId,
    id: p.id,
    ordinal,
    revision: 1,
    applied: 1,
    abandoned: 0,
    retained: 0,
    payload,
    checksum: hash(payload),
  });
  db.prepare('INSERT INTO travel_checkpoint VALUES(?,?,?,?,1,0,0,1,?,?)').run(
    cam,
    p.sceneId,
    p.id,
    ordinal,
    payload,
    hash(payload),
  );
}
function candidate(db: any, cam: string, sceneId: string, direction: 'undo' | 'redo') {
  return db
    .prepare(
      'SELECT * FROM travel_checkpoint WHERE campaign_id=? AND scene_id=? AND applied=? AND abandoned=0 ORDER BY ordinal ' +
        (direction === 'undo' ? 'DESC' : 'ASC') +
        ' LIMIT 1',
    )
    .get(cam, sceneId, direction === 'undo' ? 1 : 0);
}
export function travelHistory(
  db: any,
  cam: string,
  sceneId: string,
  journeyId?: string,
): TravelHistoryView {
  const item = (direction: 'undo' | 'redo') => {
    const row = candidate(db, cam, sceneId, direction);
    if (!row) return null;
    const p = checked(db, row);
    if (journeyId && p.journeyId !== journeyId) return null;
    return {
      id: p.id,
      revision: row.revision,
      journeyId: p.journeyId,
      retainedShared: !!row.retained,
      label: `Hex ${p.fromHex.q},${p.fromHex.r} → ${p.toHex.q},${p.toHex.r} · ${(Number(BigInt(p.to) - BigInt(p.from)) / 3600000).toFixed(2)} Stunden`,
    };
  };
  return { undo: item('undo'), redo: item('redo') };
}
const absent = Symbol('absent');
type Value = any;
function plain(v: Value) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function normalized(row: Row | null, table: string): Value {
  if (!row) return null;
  const value: Value = { ...row };
  delete value.revision;
  delete value.checksum;
  if (table === 'world_journey') delete value.status;
  if (typeof value.payload === 'string') {
    value.payload = JSON.parse(value.payload);
    delete value.payload.revision;
    if (table === 'world_journey')
      for (const key of ['clockRevision', 'positionRevision', 'status', 'reason'])
        delete value.payload[key];
  }
  return value;
}
/** Invert only changed fields. An unrelated later title/prose edit is retained. */
function patch(current: Value, from: Value, to: Value): Value {
  if (equal(from === absent ? undefined : from, to === absent ? undefined : to)) return current;
  if (plain(from) && plain(to) && plain(current)) {
    const result = { ...current };
    for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
      const value = patch(
        Object.hasOwn(current, key) ? current[key] : absent,
        Object.hasOwn(from, key) ? from[key] : absent,
        Object.hasOwn(to, key) ? to[key] : absent,
      );
      if (value === absent) delete result[key];
      else result[key] = value;
    }
    return result;
  }
  if (!equal(current === absent ? undefined : current, from === absent ? undefined : from))
    throw Error(
      'Eine betroffene Reisezeitfolge wurde später geändert. Rücknahme würde bestätigte Fakten überschreiben.',
    );
  return to === absent ? absent : structuredClone(to);
}
function own(e: Effect, p: Checkpoint) {
  const r = (e.after ?? e.before)!;
  return (
    (['scene_clock', 'scene_position', 'live_scene_extra', 'world_notice'].includes(e.table) &&
      r.scene_id === p.sceneId) ||
    (['live_scene', 'world_record'].includes(e.table) && r.id === p.sceneId) ||
    (e.table === 'world_journey' && r.id === p.journeyId) ||
    ([
      'atlas_knowledge',
      'player_hex_memory',
      'dungeon_perception',
      'dungeon_slice_memory',
    ].includes(e.table) &&
      p.actorIds.includes(r.character_id as string))
  );
}
function currentRow(db: any, e: Effect) {
  const t = tables(db).get(e.table)!,
    key = e.before ?? e.after!;
  return (
    db
      .prepare(
        'SELECT * FROM ' +
          quote(e.table) +
          ' WHERE ' +
          t.keys.map((k) => quote(k) + '=?').join(' AND '),
      )
      .get(...t.keys.map((k) => key[k])) ?? null
  );
}
export function applyTravelHistory(
  db: any,
  cam: string,
  commandId: string,
  scene: SceneWorld,
  input: {
    id: string;
    revision: number;
    direction: 'undo' | 'redo';
    expectedClockRevision: number;
    expectedPositionRevision: number;
    expectedJourneyRevision: number;
  },
) {
  const row = candidate(db, cam, scene.scene.id, input.direction),
    p = checked(db, row),
    j = scene.journey;
  if (
    row.id !== input.id ||
    row.revision !== input.revision ||
    !j ||
    j.id !== p.journeyId ||
    j.revision !== input.expectedJourneyRevision ||
    scene.scene.clock.revision !== input.expectedClockRevision ||
    scene.position.revision !== input.expectedPositionRevision ||
    scene.scene.clock.epochId !== p.epochId ||
    scene.scene.membershipRevision !== p.membershipRevision ||
    !equal(scene.scene.members, p.actorIds)
  )
    throw Error('Reise, Gruppe oder Rücknahmeziel geändert. Reisestand neu laden.');
  const expected = input.direction === 'undo' ? p.to : p.from;
  if (scene.scene.clock.instantMs !== expected)
    throw Error('Gruppenzeit wurde nach dem Reisecheckpoint geändert.');
  const later =
    !!row.retained ||
    db
      .prepare(
        'SELECT scene_id,instant_ms FROM scene_clock WHERE campaign_id=? AND epoch_id=? AND scene_id<>?',
      )
      .all(cam, p.epochId, p.sceneId)
      .some((c: any) => BigInt(c.instant_ms) >= BigInt(p.to));
  const sequence = input.direction === 'undo' ? [...p.effects].reverse() : p.effects;
  const changes = sequence
    .filter((e) => !later || own(e, p))
    .map((e) => {
      const current = currentRow(db, e),
        from = input.direction === 'undo' ? e.after : e.before,
        to = input.direction === 'undo' ? e.before : e.after;
      try {
        return {
          e,
          current,
          next: patch(
            normalized(current, e.table),
            normalized(from, e.table),
            normalized(to, e.table),
          ),
        };
      } catch (error) {
        throw Error(e.table + ': ' + (error as Error).message);
      }
    });
  db.pragma('defer_foreign_keys=ON');
  for (const { e, current, next } of changes) {
    const t = tables(db).get(e.table)!,
      key = (e.before ?? e.after)!;
    if (next === null) {
      db.prepare(
        'DELETE FROM ' +
          quote(e.table) +
          ' WHERE ' +
          t.keys.map((k) => quote(k) + '=?').join(' AND '),
      ).run(...t.keys.map((k) => key[k]));
      continue;
    }
    const result: Row = { ...next };
    const original = input.direction === 'undo' ? e.before : e.after;
    if (e.table === 'world_journey') result.status = current?.status ?? original!.status;
    const revision = current
      ? Number(
          current.revision ??
            (typeof current.payload === 'string' ? JSON.parse(current.payload).revision : 0) ??
            0,
        ) + 1
      : Number(original?.revision ?? 0) + row.revision + 1;
    if (t.columns.includes('revision')) result.revision = revision;
    if (plain(next.payload)) {
      if (
        original &&
        typeof original.payload === 'string' &&
        Object.hasOwn(JSON.parse(original.payload), 'revision')
      )
        next.payload.revision = revision;
      result.payload = JSON.stringify(next.payload);
      if (t.columns.includes('checksum')) result.checksum = hash(result.payload);
    }
    const updated = t.columns.filter((k) => !t.keys.includes(k));
    db.prepare(
      'INSERT INTO ' +
        quote(e.table) +
        '(' +
        t.columns.map(quote).join(',') +
        ') VALUES(' +
        t.columns.map(() => '?').join(',') +
        ') ON CONFLICT(' +
        t.keys.map(quote).join(',') +
        ') DO ' +
        (updated.length
          ? 'UPDATE SET ' + updated.map((k) => quote(k) + '=excluded.' + quote(k)).join(',')
          : 'NOTHING'),
    ).run(...t.columns.map((k) => result[k]));
  }
  // Revisions never move backwards. A restored active segment requires explicit play.
  const clock = db
      .prepare('SELECT revision FROM scene_clock WHERE campaign_id=? AND scene_id=?')
      .get(cam, p.sceneId),
    position = db
      .prepare('SELECT revision FROM scene_position WHERE campaign_id=? AND scene_id=?')
      .get(cam, p.sceneId),
    jr = db
      .prepare('SELECT * FROM world_journey WHERE campaign_id=? AND id=?')
      .get(cam, p.journeyId),
    journey = JSON.parse(jr.payload);
  const source = p.effects.find(
      (e) => e.table === 'world_journey' && (e.after ?? e.before)!.id === p.journeyId,
    ),
    target = input.direction === 'undo' ? source?.before : source?.after;
  if (!target) throw Error('Reisecheckpoint besitzt keinen Reisestand.');
  const intended = JSON.parse(target.payload as string);
  journey.clockRevision = clock.revision;
  journey.positionRevision = position.revision;
  journey.status = intended.status === 'active' ? 'paused' : intended.status;
  journey.reason = intended.reason;
  journey.revision = jr.revision;
  const payload = JSON.stringify(journey);
  db.prepare(
    'UPDATE world_journey SET status=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
  ).run(journey.status, payload, hash(payload), cam, journey.id);
  const clockId = commandId + ':history-clock',
    afterClock = db
      .prepare('SELECT * FROM scene_clock WHERE campaign_id=? AND scene_id=?')
      .get(cam, p.sceneId);
  const time = {
    epochId: p.epochId,
    from: scene.scene.clock.instantMs,
    to: afterClock.instant_ms,
    beforeRevision: scene.scene.clock.revision,
    afterRevision: afterClock.revision,
    calendarVersion: 'travel-history-v1',
    checkpointId: p.id,
    direction: input.direction,
    reason: 'Reise ' + (input.direction === 'undo' ? 'zurückgenommen' : 'wiederholt'),
    recordedAt: new Date().toISOString(),
  };
  const timePayload = JSON.stringify(time),
    ordinal = db
      .prepare(
        'SELECT coalesce(max(ordinal),-1)+1 n FROM scene_time_step WHERE campaign_id=? AND scene_id=?',
      )
      .get(cam, p.sceneId).n;
  db.prepare('INSERT INTO receipt VALUES(?,?,?,?,?)').run(
    clockId,
    hash(JSON.stringify({ commandId, input })),
    cam,
    p.sceneId,
    afterClock.revision,
  );
  db.prepare('INSERT INTO scene_time_step VALUES(?,?,?,?,?,?,?)').run(
    cam,
    randomUUID(),
    p.sceneId,
    clockId,
    ordinal,
    timePayload,
    hash(timePayload),
  );
  db.prepare(
    'UPDATE travel_checkpoint SET applied=?,retained=?,revision=revision+1 WHERE campaign_id=? AND id=?',
  ).run(input.direction === 'undo' ? 0 : 1, later ? 1 : 0, cam, p.id);
  return {
    checkpointId: p.id,
    retainedShared: later,
    from: p.from,
    to: p.to,
    tables: [...new Set(changes.map((c) => c.e.table))],
  };
}
export function prepareTravelHistoryValidation(db: any) {
  tables(db);
}
/** Backward clock transitions are valid only with their original causal checkpoint. */
export function validTravelHistoryTimeStep(db: any, cam: string, sceneId: string, time: any) {
  if (
    time.calendarVersion !== 'travel-history-v1' ||
    !['undo', 'redo'].includes(time.direction) ||
    typeof time.checkpointId !== 'string'
  )
    return false;
  const row = db
    .prepare('SELECT * FROM travel_checkpoint WHERE campaign_id=? AND scene_id=? AND id=?')
    .get(cam, sceneId, time.checkpointId);
  if (!row) return false;
  const p = checked(db, row);
  return (
    time.epochId === p.epochId &&
    time.from === (time.direction === 'undo' ? p.to : p.from) &&
    time.to === (time.direction === 'undo' ? p.from : p.to)
  );
}
export function validateTravelHistory(db: any) {
  if (
    !db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='travel_checkpoint'").get()
  ) {
    if (db.pragma('user_version', { simple: true }) >= 53)
      throw Error('Reisecheckpoint-Speicher fehlt.');
    return;
  }
  tables(db);
  for (const row of db.prepare('SELECT * FROM travel_checkpoint').iterate()) checked(db, row);
}
