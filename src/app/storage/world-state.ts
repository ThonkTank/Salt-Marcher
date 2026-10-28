import { checkedQuery, checkedRow, type SqliteDatabase } from './sqlite-connection';
import { travelHistory } from './travel-history';
import { checkedCalendarEventRow } from './calendar-events';
import { landscapeRegion } from './landscape-records';
import { checkedMarkerPresentation, defaultMarkerPresentation } from '../atlas/atlas-marker';
import { randomUUID } from 'node:crypto';
import type { Hex } from '../runtime/world-cell-contracts';
import type { ScenePosition, SceneWorld, WorldView } from '../runtime/world-contracts';
import type { Weather } from '../runtime/weather-contracts';
import {
  calendarDate,
  checkedWeather,
  hexPoint,
  relevantEvent,
  weatherAt,
} from '../runtime/world-model';
import { readLiveScene } from './live-read';
import type { LiveScene } from '../runtime/live-scene-contracts';
import { hash, readWorldCalendar } from './world-calendar-read';
import {
  checkedJourneyRow as journeyRow,
  checkedWorldHistoryRow,
  checkedMap,
  checkedPhenomenon,
  checkedPositionRow,
} from './world-record-read';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { decodeStored, storedPayload } from './stored-payload';
import * as shape from './stored-shapes';
export const json = (v: unknown) => JSON.stringify(v);

function calendarEvents(db: SqliteDatabase, cam: string) {
  return checkedQuery(
    db,
    "SELECT * FROM world_record WHERE campaign_id=? AND kind='calendar-event' ORDER BY rowid",
    {
      campaign_id: 'text',
      kind: 'text',
      id: 'text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    },
  )
    .all(cam)
    .map(checkedCalendarEventRow);
}

export function writeRecord<T extends object>(
  db: SqliteDatabase,
  cam: string,
  kind: string,
  id: string,
  v: T,
  expected: number | null,
) {
  const old = checkedQuery(
    db,
    'SELECT revision FROM world_record WHERE campaign_id=? AND kind=? AND id=?',
    { revision: 'integer' },
  ).get(cam, kind, id);
  if ((old?.revision ?? null) !== expected)
    throw new Error('Weltinhalt geändert. Bitte aktualisieren.');
  const next = { ...v, revision: (expected ?? 0) + 1 };
  if (kind === 'map') Reflect.deleteProperty(next, 'landscape');
  const payload = json(next);
  db.prepare(
    'INSERT INTO world_record VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,kind,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, kind, id, next.revision, payload, hash(payload));
  return next;
}

export function readWorld(db: SqliteDatabase, cam: string, withLandscape = true): WorldView {
  const styles = new Map(
    checkedQuery(
      db,
      "SELECT * FROM world_record WHERE campaign_id=? AND kind='place-presentation'",
      {
        campaign_id: 'text',
        kind: 'text',
        id: 'text',
        revision: 'integer',
        payload: 'text',
        checksum: 'text',
      },
    )
      .all(cam)
      .map((r) => {
        const value = decodeStored(r, shape.world_record_place_presentation);
        if (value.revision !== r.revision || r.revision < 1)
          throw new Error('Ortsdarstellungsrevision widersprüchlich.');
        return [r.id, value] as const;
      }),
  );
  return {
    calendar: readWorldCalendar(db, cam),
    maps: checkedQuery(
      db,
      "SELECT * FROM world_record WHERE campaign_id=? AND kind='map' ORDER BY rowid",
      {
        campaign_id: 'text',
        kind: 'text',
        id: 'text',
        revision: 'integer',
        payload: 'text',
        checksum: 'text',
      },
    )
      .all(cam)
      .map((r) => {
        const row = checkedRow(r, { id: 'text', revision: 'integer' }),
          m = decodeStored(r, checkedMap);
        if (m.id !== row.id || m.revision !== row.revision)
          throw new Error('Kartenidentität widersprüchlich.');
        return m;
      })
      .map((m) => (withLandscape ? { ...m, landscape: landscapeRegion(db, cam) } : m)),
    events: calendarEvents(db, cam),
    phenomena: checkedQuery(
      db,
      "SELECT * FROM world_record WHERE campaign_id=? AND kind='phenomenon' ORDER BY rowid",
      {
        campaign_id: 'text',
        kind: 'text',
        id: 'text',
        revision: 'integer',
        payload: 'text',
        checksum: 'text',
      },
    )
      .all(cam)
      .map((r) => {
        const row = checkedRow(r, { id: 'text', revision: 'integer' }),
          p = decodeStored(r, checkedPhenomenon);
        if (p.id !== row.id || p.revision !== row.revision)
          throw new Error('Wetterereignisidentität widersprüchlich.');
        return p;
      }),
    places: checkedQuery(
      db,
      'SELECT a.*,l.payload,l.checksum,l.trashed FROM atlas_place a JOIN location l ON l.campaign_id=a.campaign_id AND l.id=a.location_id WHERE a.campaign_id=?',
      {
        campaign_id: 'text',
        location_id: 'text',
        map_id: 'text',
        revision: 'integer',
        q: 'integer',
        r: 'integer',
        payload: 'text',
        checksum: 'text',
        trashed: 'integer',
      },
    )
      .all(cam)
      .map((r) => ({
        mapId: r.map_id,
        locationId: r.location_id,
        revision: r.revision,
        q: r.q,
        r: r.r,
        name: checkedLocationDocument(storedPayload(r)).name,
        trashed: !!r.trashed,
        presentation: styles.has(r.location_id)
          ? checkedMarkerPresentation(styles.get(r.location_id))
          : structuredClone(defaultMarkerPresentation),
        presentationRevision: styles.get(r.location_id)?.revision ?? 0,
      })),
  };
}

export function map(db: SqliteDatabase, cam: string, id: string, at?: Hex) {
  const row = checkedQuery(
      db,
      "SELECT * FROM world_record WHERE campaign_id=? AND kind='map' AND id=?",
      {
        campaign_id: 'text',
        kind: 'text',
        id: 'text',
        revision: 'integer',
        payload: 'text',
        checksum: 'text',
      },
    ).get(cam, id),
    r = checkedRow(row, { id: 'text', revision: 'integer' }),
    m = decodeStored(row, checkedMap);
  if (m.id !== r.id || m.revision !== r.revision)
    throw new Error('Kartenidentität widersprüchlich.');
  if (at) {
    const p = hexPoint(at, m.hexMeters);
    m.landscape = landscapeRegion(db, cam, {
      x: p.x - m.hexMeters,
      y: p.y - m.hexMeters,
      width: 2 * m.hexMeters,
      height: 2 * m.hexMeters,
    });
  }
  return m;
}

/** Derive position from the caller's already validated scene, within the same read/write. */
export function scenePosition(db: SqliteDatabase, cam: string, scene: LiveScene): ScenePosition {
  const sceneId = scene.id,
    row = checkedQuery(db, 'SELECT * FROM scene_position WHERE campaign_id=? AND scene_id=?', {
      campaign_id: 'text',
      scene_id: 'text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    }).get(cam, sceneId),
    p = row ? checkedPositionRow(row) : null;
  if (p && p.locationId === scene.locationId) return p;
  const anchor = scene.locationId
    ? checkedQuery(db, 'SELECT * FROM atlas_place WHERE campaign_id=? AND location_id=?', {
        campaign_id: 'text',
        location_id: 'text',
        map_id: 'text',
        revision: 'integer',
        q: 'integer',
        r: 'integer',
      }).get(cam, scene.locationId)
    : null;
  return {
    revision: p?.revision ?? 0,
    mapId: anchor?.map_id ?? null,
    q: anchor?.q ?? 0,
    r: anchor?.r ?? 0,
    locationId: scene.locationId,
  };
}

export function savePosition(db: SqliteDatabase, cam: string, sceneId: string, p: ScenePosition) {
  const payload = json(p);
  db.prepare(
    'INSERT INTO scene_position VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,scene_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, sceneId, p.revision, payload, hash(payload));
}

export { checkedJourneyRow as journeyRow } from './world-record-read';

export function weatherOverride(value: unknown): Weather | null {
  const row = checkedRow(value, { revision: 'integer', payload: 'text', checksum: 'text' });
  const v = decodeStored(row, (v) => {
    const o = checkedRow(v, { revision: 'integer' });
    if (!v || typeof v !== 'object' || !('weather' in v)) throw new Error('Wetteroverride fehlt.');
    return { weather: v.weather, revision: o.revision };
  });
  if (
    !v ||
    typeof v !== 'object' ||
    !Object.hasOwn(v, 'weather') ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    v.revision !== row.revision
  )
    throw new Error('Gespeichertes manuelles Wetter ist beschädigt.');
  return v.weather === null ? null : checkedWeather(v.weather);
}

export function currentWeather(
  db: SqliteDatabase,
  cam: string,
  scene: LiveScene,
  p: ScenePosition,
  w: WorldView,
) {
  const sceneId = scene.id,
    override = checkedQuery(
      db,
      "SELECT * FROM world_record WHERE campaign_id=? AND kind='weather-override' AND id=?",
      {
        campaign_id: 'text',
        kind: 'text',
        id: 'text',
        revision: 'integer',
        payload: 'text',
        checksum: 'text',
      },
    ).get(cam, sceneId);
  const overrideRevision = override?.revision ?? null;
  if (override) {
    const weather = weatherOverride(override);
    if (weather) return { weather: { ...weather, source: 'GM-Override' }, overrideRevision };
  }
  const m = w.maps.find((m) => m.id === p.mapId);
  return {
    weather: m
      ? weatherAt(map(db, cam, m.id, p), p, scene.clock.instantMs, w.calendar, w.phenomena)
      : null,
    overrideRevision,
  };
}

export function readSceneWorld(db: SqliteDatabase, cam: string, id: string): SceneWorld {
  const world = readWorld(db, cam, false),
    scene = readLiveScene(db, cam, id),
    p = scenePosition(db, cam, scene),
    j = checkedQuery(
      db,
      'SELECT * FROM world_journey WHERE campaign_id=? AND scene_id=? ORDER BY rowid DESC LIMIT 1',
      {
        campaign_id: 'text',
        id: 'text',
        scene_id: 'text',
        revision: 'integer',
        status: 'text',
        payload: 'text',
        checksum: 'text',
      },
    ).get(cam, id),
    weather = currentWeather(db, cam, scene, p, world);
  return {
    travelHistory: travelHistory(db, cam, id, j?.id),
    scene,
    position: p,
    date: calendarDate(world.calendar, scene.clock.instantMs),
    weather: weather.weather,
    weatherOverrideRevision: weather.overrideRevision,
    events: world.events.filter((e) => relevantEvent(e, scene.clock.instantMs, scene.locationId)),
    journey: j ? journeyRow(j) : null,
    notices: checkedQuery(
      db,
      'SELECT id,text FROM world_notice WHERE campaign_id=? AND scene_id=? AND active=1 AND dismissed=0 ORDER BY rowid DESC',
      { id: 'text', text: 'text' },
    ).all(cam, id),
    knowledge: checkedQuery(
      db,
      'SELECT DISTINCT map_id AS mapId,q,r FROM atlas_knowledge WHERE campaign_id=? AND character_id IN(SELECT id FROM roster_member WHERE campaign_id=? AND active=1 AND scene_id=?)',
      { mapId: 'text', q: 'integer', r: 'integer' },
    ).all(cam, cam, id),
    history: checkedQuery(
      db,
      'SELECT * FROM world_history WHERE campaign_id=? AND (scene_id=? OR scene_id IS NULL) ORDER BY rowid DESC LIMIT 50',
      {
        campaign_id: 'text',
        id: 'text',
        scene_id: 'nullable-text',
        payload: 'text',
        checksum: 'text',
      },
    )
      .all(cam, id)
      .map((r) => ({ id: r.id, text: checkedWorldHistoryRow(r).text })),
  };
}

export function syncSceneWorld(db: SqliteDatabase, cam: string, scene: LiveScene) {
  const id = scene.id,
    raw = checkedQuery(db, 'SELECT * FROM scene_position WHERE campaign_id=? AND scene_id=?', {
      campaign_id: 'text',
      scene_id: 'text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    }).get(cam, id),
    p = scenePosition(db, cam, scene);
  if (raw && checkedPositionRow(raw).locationId !== scene.locationId)
    savePosition(db, cam, id, { ...p, revision: p.revision + 1 });
  const w = readWorld(db, cam, false),
    weather = currentWeather(db, cam, scene, p, w).weather,
    signature = weather
      ? json([
          weather.kind,
          Math.round(weather.intensity * 4),
          Math.round(weather.effects.travelFactor * 4),
          Math.round(weather.effects.visibilityMeters / 100),
          weather.effects.combatNote,
          weather.effects.temperatureC < -10
            ? 'cold'
            : weather.effects.temperatureC > 35
              ? 'hot'
              : 'normal',
        ])
      : 'none',
    old = checkedQuery(
      db,
      "SELECT * FROM world_record WHERE campaign_id=? AND kind='weather-state' AND id=?",
      {
        campaign_id: 'text',
        kind: 'text',
        id: 'text',
        revision: 'integer',
        payload: 'text',
        checksum: 'text',
      },
    ).get(cam, id);
  const oldState = old ? decodeStored(old, shape.world_record_weather_state) : null;
  if (oldState && oldState.revision !== old!.revision)
    throw new Error('Wetterstandrevision widersprüchlich.');
  if (oldState?.signature === signature) return;
  writeRecord(db, cam, 'weather-state', id, { signature }, old?.revision ?? null);
  db.prepare('UPDATE world_notice SET active=0 WHERE campaign_id=? AND scene_id=?').run(cam, id);
  if (
    weather &&
    (weather.effects.travelFactor > 1 || weather.effects.combatNote || weather.kind === 'fog')
  )
    db.prepare('INSERT INTO world_notice VALUES(?,?,?,?,1,0)').run(
      cam,
      id,
      randomUUID(),
      'Wetter: ' +
        weather.label +
        ' · Sicht ' +
        weather.effects.visibilityMeters +
        ' m · Reisefaktor ' +
        weather.effects.travelFactor.toFixed(2) +
        (weather.effects.combatNote ? ' · ' + weather.effects.combatNote : ''),
    );
}
