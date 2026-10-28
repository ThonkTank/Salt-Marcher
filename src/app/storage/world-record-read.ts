import type { Journey } from '../runtime/world-contracts';
import { hexDistance } from '../runtime/world-model';
import { checkedTravelSupplies } from '../runtime/hex-access';
import { checkedRow, type SqliteDatabase } from './sqlite-connection';
import { decodeStored } from './stored-payload';
import * as shape from './stored-shapes';
import { checkedHexAccess } from '../runtime/hex-access';
import { checkedMarkerPresentation } from '../atlas/atlas-marker';
import { terrainNames, checkedCalendarEvent, checkedWeather } from '../runtime/world-model';
import { checkedCalendar, checkedCalendarRow } from './world-calendar-read';
import { checkedCalendarEventRow } from './calendar-events';

export const validIdentity = (v: string) => !!v.trim() && v.length <= 1000;
export function storedInteger(v: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(v) || v < min || v > max)
    throw new Error('Gespeicherte Ganzzahl außerhalb des gültigen Bereichs.');
}
export function storedNumber(v: number, min: number, max: number) {
  if (!Number.isFinite(v) || v < min || v > max)
    throw new Error('Gespeicherte Zahl außerhalb des gültigen Bereichs.');
}
function instant(v: string, positive = false) {
  if (!(positive ? /^[1-9][0-9]{0,29}$/ : /^(0|[1-9][0-9]{0,29})$/).test(v))
    throw new Error('Gespeicherte Weltzeit ungültig.');
}
export function checkedMap(value: unknown) {
  const m = shape.world_record_map(value);
  storedInteger(m.revision);
  if (!validIdentity(m.id) || !m.name.trim() || !m.seed || m.cells.length > 1000000)
    throw new Error('Gespeicherte Karte hat ungültige Kennungen oder Zellen.');
  storedNumber(m.hexMeters, 1, 100000000);
  const seen = new Set<string>();
  for (const c of m.cells) {
    storedInteger(c.q, -1000000000, 1000000000);
    storedInteger(c.r, -1000000000, 1000000000);
    storedInteger(c.level, 0, 12);
    storedNumber(c.elevationM, -20000, 100000);
    checkedHexAccess(c.access);
    const key = `${c.level}:${c.q}:${c.r}`;
    if (!Object.hasOwn(terrainNames, c.terrain) || seen.has(key))
      throw new Error('Gespeicherte Kartenhex widersprüchlich.');
    seen.add(key);
  }
  return m;
}
export function checkedPhenomenon(value: unknown) {
  const p = shape.world_record_phenomenon(value);
  storedInteger(p.revision, 1);
  if (!validIdentity(p.id) || !validIdentity(p.mapId) || !p.name.trim())
    throw new Error('Wetterereignis ungültig.');
  storedInteger(p.center.q, -1000000000, 1000000000);
  storedInteger(p.center.r, -1000000000, 1000000000);
  storedNumber(p.movement.q, -100, 100);
  storedNumber(p.movement.r, -100, 100);
  storedNumber(p.radiusHexes, 0.1, 10000);
  storedNumber(p.intensity, 0, 1);
  instant(p.startMs);
  instant(p.durationMs, true);
  if (p.pausedAtMs !== null) instant(p.pausedAtMs);
  if (p.temperatureC !== null) storedNumber(p.temperatureC, -100, 100);
  if (p.travelFactor !== null) storedNumber(p.travelFactor, 0.1, 20);
  return p;
}
export function checkedPosition(value: unknown) {
  const p = shape.scene_position(value);
  storedInteger(p.revision);
  storedInteger(p.q, -1000000000, 1000000000);
  storedInteger(p.r, -1000000000, 1000000000);
  if ([p.mapId, p.locationId].some((v) => v !== null && !validIdentity(v)))
    throw new Error('Gespeicherte Position hat ungültige Bindungen.');
  if (
    p.city &&
    (!validIdentity(p.city.cityId) || ![p.city.x, p.city.y, p.city.z].every(Number.isFinite))
  )
    throw new Error('Gespeicherte Stadtposition ungültig.');
  if (p.outdoor && ![p.outdoor.x, p.outdoor.y].every(Number.isFinite))
    throw new Error('Gespeicherte Außenposition ungültig.');
  return p;
}
export function checkedPositionRow(value: unknown) {
  const row = checkedRow(value, { revision: 'integer' }),
    p = decodeStored(value, checkedPosition);
  if (p.revision !== row.revision) throw new Error('Positionsrevision widersprüchlich.');
  return p;
}
export function checkedWorldRecord(value: unknown) {
  const row = checkedRow(value, { kind: 'text', id: 'text', revision: 'integer' });
  if (row.kind === 'calendar') return checkedCalendarRow(value);
  if (row.kind === 'calendar-event') return checkedCalendarEventRow(value);
  if (row.kind === 'map' || row.kind === 'phenomenon') {
    const v =
      row.kind === 'map' ? decodeStored(value, checkedMap) : decodeStored(value, checkedPhenomenon);
    if (v.id !== row.id || v.revision !== row.revision || row.revision < 1)
      throw new Error('Weltrecordidentität widersprüchlich.');
    return v;
  }
  if (row.kind === 'place-presentation') {
    const v = decodeStored(value, shape.world_record_place_presentation);
    checkedMarkerPresentation(v);
    if (v.revision !== row.revision || row.revision < 1)
      throw new Error('Ortsdarstellungsrevision widersprüchlich.');
    return v;
  }
  if (row.kind === 'weather-state') {
    const v = decodeStored(value, shape.world_record_weather_state);
    if (v.revision !== row.revision || row.revision < 1)
      throw new Error('Wetterstandrevision widersprüchlich.');
    return v;
  }
  throw new Error('Unbekannte Weltrecordart. Originaldaten bleiben erhalten.');
}
/** Frozen receipts are checked against their own facts, never a later source revision. */
export function checkedWorldAck(value: unknown) {
  const ack = shape.world_receipt(value),
    w = ack.world;
  checkedCalendar(w.calendar);
  for (const m of w.maps) checkedMap(m);
  for (const p of w.phenomena) checkedPhenomenon(p);
  for (const e of w.events) checkedCalendarEvent(e, true);
  for (const p of w.places) {
    storedInteger(p.revision, 1);
    storedInteger(p.q, -1000000000, 1000000000);
    storedInteger(p.r, -1000000000, 1000000000);
    if (
      !validIdentity(p.mapId) ||
      !validIdentity(p.locationId) ||
      !w.maps.some((m) => m.id === p.mapId)
    )
      throw new Error('Gespeicherter Ortsmarker hat eine fremde Karte.');
    if (p.presentation) checkedMarkerPresentation(p.presentation);
  }
  if ('revision' in ack) throw new Error('Weltbestätigung hat eine fremde Revision.');
  for (const p of w.phenomena)
    if (!w.maps.some((m) => m.id === p.mapId))
      throw new Error('Wetterereignis gehört zu einer fremden Karte.');
  if (ack.scene) {
    const s = ack.scene.scene;
    if (
      !validIdentity(s.id) ||
      s.title.length > 1000 ||
      s.notes.length > 2000000 ||
      !validIdentity(s.clock.epochId) ||
      !/^(0|[1-9][0-9]{0,29})$/.test(s.clock.instantMs) ||
      s.members.some((id) => !validIdentity(id)) ||
      new Set(s.members).size !== s.members.length
    )
      throw new Error('Bestätigter Scenestand beschädigt.');
    for (const v of [s.revision, s.membershipRevision, s.clock.revision]) storedInteger(v);
    if (
      ack.scene.position.mapId !== null &&
      !w.maps.some((m) => m.id === ack.scene!.position.mapId)
    )
      throw new Error('Bestätigte Sceneposition gehört zu einer fremden Karte.');
    if (ack.scene.journey) checkedJourneyValue(ack.scene.journey);

    checkedPosition(ack.scene.position);
    if (ack.scene.weather) checkedWeather(ack.scene.weather);
    if (ack.scene.position.locationId !== ack.scene.scene.locationId)
      throw new Error('Weltbestätigung hat widersprüchliche Scenebindungen.');
    if (ack.scene.journey && ack.scene.journey.sceneId !== ack.scene.scene.id)
      throw new Error('Reisebestätigung hat eine fremde Scene.');
  }
  return ack;
}
export function checkedWorldReceipt(db: SqliteDatabase, value: unknown) {
  const row = checkedRow(value, { command_id: 'text', campaign_id: 'text', fingerprint: 'text' });
  if (
    !validIdentity(row.command_id) ||
    !/^[0-9a-f]{64}$/.test(row.fingerprint) ||
    !db.prepare('SELECT 1 FROM campaign WHERE id=?').get(row.campaign_id)
  )
    throw new Error('Weltbestätigung hat ungültige Kennungen.');
  return decodeStored(value, checkedWorldAck);
}

export function checkedJourneyValue(value: unknown): Journey {
  const j = shape.world_journey(value);
  checkedTravelSupplies(j?.supplies);
  const identity = (v: string) => !!v.trim() && v.length <= 1000;
  if (
    !identity(j.id) ||
    !identity(j.sceneId) ||
    !identity(j.mapId) ||
    ![j.mapRevision, j.clockRevision, j.positionRevision, j.membershipRevision].every(
      (v) => Number.isSafeInteger(v) && v >= 0,
    ) ||
    j.mapRevision < 1 ||
    !Number.isSafeInteger(j.plannedSeconds) ||
    j.actorIds.some((v) => !identity(v)) ||
    new Set(j.actorIds).size !== j.actorIds.length ||
    j.paceKmh < 0.1 ||
    j.paceKmh > 10000 ||
    j.factor < 0.01 ||
    j.factor > 100 ||
    (j.finalSeconds !== null && (!Number.isSafeInteger(j.finalSeconds) || j.finalSeconds < 1)) ||
    (j.destinationLocationId !== null && !identity(j.destinationLocationId))
  )
    throw new Error('Gespeicherte Reisegrundlage beschädigt.');
  if (
    j.continuedFrom &&
    (!identity(j.continuedFrom.id) ||
      !Number.isSafeInteger(j.continuedFrom.revision) ||
      j.continuedFrom.revision < 1 ||
      !Number.isSafeInteger(j.continuedFrom.completedSteps) ||
      j.continuedFrom.completedSteps < 0)
  )
    throw new Error('Gespeicherte Reisefortsetzung beschädigt.');

  if (j?.presentationSpeed !== undefined && ![1, 2, 5, 10].includes(j.presentationSpeed))
    throw new Error('Gespeicherte Wiedergabegeschwindigkeit ungültig.');
  if (j && j.usePartyPace !== undefined && typeof j.usePartyPace !== 'boolean')
    throw new Error('Gespeicherte Tempoquelle ist ungültig.');
  if (
    !j ||
    typeof j !== 'object' ||
    Array.isArray(j) ||
    !['active', 'paused', 'interrupted', 'arrived', 'ended'].includes(j.status) ||
    !Number.isSafeInteger(j.revision) ||
    j.revision < 1
  )
    throw new Error(
      'Reiseidentität, Gruppe oder Status widersprüchlich. Originaldaten bleiben erhalten.',
    );
  if (
    !Array.isArray(j.route) ||
    j.route.length < 2 ||
    j.route.length > 1001 ||
    j.route.some(
      (h, i) =>
        !h ||
        ![h.q, h.r].every((v) => Number.isSafeInteger(v) && Math.abs(v) <= 1000000000) ||
        (i > 0 && hexDistance(j.route[i - 1]!, h) !== 1),
    )
  )
    throw new Error('Gespeicherte Reiseroute ist ungültig. Originaldaten bleiben erhalten.');
  if (
    !Array.isArray(j.segmentSeconds) ||
    j.segmentSeconds.length !== j.route.length - 1 ||
    j.segmentSeconds.some((n) => !Number.isSafeInteger(n) || n < 1) ||
    !Number.isInteger(j.plannedSeconds) ||
    BigInt(j.plannedSeconds) !== j.segmentSeconds.reduce((sum, n) => sum + BigInt(n), 0n)
  )
    throw new Error(
      'Gespeicherte Reisezeiten sind widersprüchlich. Originaldaten bleiben erhalten.',
    );
  if (
    !Number.isSafeInteger(j.nextIndex) ||
    j.nextIndex < 1 ||
    j.nextIndex > j.route.length ||
    (j.status === 'arrived' && j.nextIndex !== j.route.length) ||
    (j.status === 'active' && j.nextIndex === j.route.length)
  )
    throw new Error(
      'Gespeicherter Reisecheckpoint widerspricht Route oder Status. Originaldaten bleiben erhalten.',
    );
  return j;
}
export function checkedJourneyRow(value: unknown): Journey {
  const row = checkedRow(value, {
      id: 'text',
      scene_id: 'text',
      status: 'text',
      revision: 'integer',
    }),
    j = decodeStored(value, checkedJourneyValue);
  if (
    j.id !== row.id ||
    j.sceneId !== row.scene_id ||
    j.status !== row.status ||
    j.revision !== row.revision
  )
    throw new Error('Reiseidentität oder Revision widersprüchlich.');
  return j;
}

export function checkedWorldHistoryRow(value: unknown) {
  const history = decodeStored(value, shape.world_history);
  if ('revision' in history || !Number.isFinite(Date.parse(history.recordedAt)))
    throw new Error('Gespeicherter Weltverlauf beschädigt.');
  return history;
}
