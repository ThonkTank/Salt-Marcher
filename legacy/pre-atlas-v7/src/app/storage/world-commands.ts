import { checkedQuery, type SqliteDatabase } from './sqlite-connection';
import { checkedWorldReceipt } from './world-record-read';
import { terrainEnvironmentRevision } from './terrain-environment';
import { sourceCellLookup } from './atlas-source-cell';
import { applyTravelHistory, captureTravelEffects, recordTravelCheckpoint } from './travel-history';
import { hexPolygon } from '../atlas/atlas-landscape';
import { executeLandscape } from './atlas-landscape';
import { landscapeRegion, putLandscape } from './landscape-records';
import { atlasLocalJourney } from './atlas-travel';
import { checkedHexAccess, checkedTravelSupplies, hexAccessProblem } from '../runtime/hex-access';
import { checkedMarkerPresentation } from '../atlas/atlas-marker';
import { agendaOccurrence } from '../runtime/agenda-model';
import { rememberAtlasHex } from './atlas-knowledge';
import { canonicalJson } from '../campaign/generation/canonical-json';
import { randomUUID } from 'node:crypto';
import type { AtlasMap } from '../runtime/world-map-contracts';
import type { Hex } from '../runtime/world-cell-contracts';
import type { Journey, TravelPreview, TravelRequest } from '../runtime/world-travel-contracts';
import type {
  ScenePosition,
  SceneWorld,
  WorldAck,
  WorldCommand,
  WorldView,
} from '../runtime/world-contracts';
import {
  authoredCellAt,
  calendarDate,
  cellAt,
  checkedCalendarEvent,
  checkedWeather,
  findRoute,
  hexDistance,
  hexKey,
  hexPoint,
  terrainFactor,
  terrainNames,
  weatherAt,
} from '../runtime/world-model';
import { executeLive } from './live-commands';
import { readLiveScene, readRoster } from './live-read';
import { partyTravelPace } from '../runtime/travel-pace';
import { restockDue } from './items';
import { hash, readWorldCalendar } from './world-calendar-read';
import {
  json,
  journeyRow,
  map,
  scenePosition,
  readWorld,
  currentWeather,
  writeRecord,
  weatherOverride,
  savePosition,
  readSceneWorld,
  syncSceneWorld,
} from './world-state';
function hex(h: Hex) {
  if (!h || ![h.q, h.r].every((v) => Number.isSafeInteger(v) && Math.abs(v) <= 1000000000))
    throw new Error('Hexkoordinate ungültig.');
}

function finite(n: number, min = -1000000000, max = 1000000000) {
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error('Weltwert außerhalb des gültigen Bereichs.');
}

function instant(s: string, positive = false) {
  if (typeof s !== 'string' || !/^(0|[1-9][0-9]{0,29})$/.test(s) || (positive && BigInt(s) === 0n))
    throw new Error('Zeit benötigt nichtnegative Millisekunden seit Kampagnenbeginn.');
}

function history(
  db: SqliteDatabase,
  cam: string,
  sceneId: string | null,
  text: string,
  facts: unknown,
) {
  const id = randomUUID(),
    payload = json({ text, recordedAt: new Date().toISOString(), facts });
  db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)').run(
    cam,
    id,
    sceneId,
    payload,
    hash(payload),
  );
  return id;
}

function journey(db: SqliteDatabase, cam: string, id: string) {
  return journeyRow(
    checkedQuery(db, 'SELECT * FROM world_journey WHERE campaign_id=? AND id=?', {
      campaign_id: 'text',
      id: 'text',
      scene_id: 'text',
      revision: 'integer',
      status: 'text',
      payload: 'text',
      checksum: 'text',
    }).get(cam, id),
  );
}

function saveJourney(db: SqliteDatabase, cam: string, j: Journey) {
  const payload = json(j);
  db.prepare(
    'INSERT INTO world_journey VALUES(?,?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,status=excluded.status,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, j.id, j.sceneId, j.revision, j.status, payload, hash(payload));
}

function reveal(db: SqliteDatabase, cam: string, sceneId: string, mapId: string, h: Hex) {
  const current = map(db, cam, mapId, h);
  for (const member of readLiveScene(db, cam, sceneId).members)
    rememberAtlasHex(db, cam, member, current, h);
}

export function travelEnvironmentBasis(
  db: SqliteDatabase,
  cam: string,
  sceneId: string,
  mapId: string,
  w: WorldView,
  usePartyPace = false,
) {
  const override = checkedQuery(
    db,
    "SELECT revision FROM world_record WHERE campaign_id=? AND kind='weather-override' AND id=?",
    { revision: 'integer' },
  ).get(cam, sceneId);
  const pace = usePartyPace
    ? partyTravelPace(readRoster(db, cam).filter((c) => c.active && c.sceneId === sceneId))
    : null;
  const terrainRevision = terrainEnvironmentRevision(db, cam, mapId);
  return hash(
    canonicalJson({
      ...(terrainRevision === null ? {} : { terrainRevision }),
      ...(pace ? { partyPace: pace.basis } : {}),
      model: 'hex-travel-v1/seasonal-fields-v1',
      calendarRevision: w.calendar.revision,
      overrideRevision: override?.revision ?? null,
      phenomena: w.phenomena
        .filter((p) => p.mapId === mapId)
        .map((p) => ({ id: p.id, revision: p.revision }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }),
  );
}

function hexTravelContext(db: SqliteDatabase, cam: string, sceneId: string, p: ScenePosition) {
  if (p.dungeon) throw new Error('Dungeon zuerst über einen verbundenen Eingang verlassen.');
  const local = atlasLocalJourney(db, cam, sceneId);
  if (local && ['active', 'paused'].includes(local.status))
    throw new Error('Lokale Reise zuerst abschließen oder beenden.');
}

export function previewTravel(db: SqliteDatabase, cam: string, r: TravelRequest): TravelPreview {
  const supplies = checkedTravelSupplies(r.supplies);
  const s = readLiveScene(db, cam, r.sceneId),
    p = scenePosition(db, cam, s),
    w = readWorld(db, cam, false),
    m = w.maps.find((m) => m.id === r.mapId);
  if (!m || p.mapId !== m.id || s.retired || !s.members.length)
    throw new Error('Platziere die aktive Gruppe zuerst auf dieser Karte.');
  hexTravelContext(db, cam, s.id, p);
  const stops = [p, ...r.waypoints, r.destination].map((h) => hexPoint(h, m.hexMeters)),
    minX = Math.min(...stops.map((p) => p.x)) - m.hexMeters * 10,
    minY = Math.min(...stops.map((p) => p.y)) - m.hexMeters * 10;
  m.landscape = landscapeRegion(db, cam, {
    x: minX,
    y: minY,
    width: Math.max(...stops.map((p) => p.x)) - minX + m.hexMeters * 10,
    height: Math.max(...stops.map((p) => p.y)) - minY + m.hexMeters * 10,
  });
  if (r.usePartyPace !== undefined && typeof r.usePartyPace !== 'boolean')
    throw new Error('Tempoquelle ist ungültig.');
  const partyPace = r.usePartyPace
    ? partyTravelPace(readRoster(db, cam).filter((c) => c.active && c.sceneId === s.id))
    : null;
  if (partyPace) {
    if (partyPace.feet <= 0)
      throw new Error(
        'Mindestens eine Figur hat Bewegung 0. Transport klären und bei Bedarf ein manuelles Reisetempo vorgeben.',
      );
    r = { ...r, paceKmh: partyPace.kmh };
  }
  hex(r.destination);
  finite(r.paceKmh, 0.1, 10000);
  finite(r.factor, 0.01, 100);
  if (!Array.isArray(r.waypoints) || r.waypoints.length > 20)
    throw new Error('Reise benötigt höchstens 20 Wegpunkte.');
  if (r.destinationLocationId) {
    const place = w.places.find((a) => a.locationId === r.destinationLocationId);
    if (!place || place.trashed || place.mapId !== m.id || hexKey(place) !== hexKey(r.destination))
      throw new Error('Reiseziel oder Ortsmarker geändert.');
  }
  let route: Hex[], continuation: TravelPreview['continuation'];
  if (r.continuation) {
    const j = journey(db, cam, r.continuation.journeyId);
    if (
      j.sceneId !== s.id ||
      j.mapId !== m.id ||
      j.revision !== r.continuation.expectedRevision ||
      !['active', 'paused', 'interrupted'].includes(j.status) ||
      !Number.isSafeInteger(j.nextIndex) ||
      j.nextIndex < 1 ||
      j.nextIndex >= j.route.length
    )
      throw new Error('Reise geändert oder kein Restweg vorhanden. Reise neu öffnen.');
    if (
      hexKey(p) !== hexKey(j.route[j.nextIndex - 1]!) ||
      hexKey(r.destination) !== hexKey(j.route.at(-1)!) ||
      r.destinationLocationId !== j.destinationLocationId ||
      r.waypoints.length
    )
      throw new Error(
        'Start, Ziel oder Restweg geändert. Neue Route am aktuellen Standort wählen.',
      );
    route = j.route.slice(j.nextIndex - 1).map((h) => ({ ...h }));
    for (const [i, h] of route.entries()) {
      hex(h);
      if (i && hexDistance(route[i - 1]!, h) !== 1)
        throw new Error('Restweg enthält eine nicht benachbarte Station. Neue Route wählen.');
    }
    continuation = {
      journeyId: j.id,
      revision: j.revision,
      completedSteps: j.nextIndex - 1,
      previousRemainingSeconds: j.segmentSeconds
        .slice(j.nextIndex - 1)
        .reduce((sum, n) => sum + n, 0),
    };
  } else {
    route = [{ q: p.q, r: p.r }];
    for (const target of [...r.waypoints, r.destination]) {
      hex(target);
      const leg = findRoute(m, route.at(-1)!, target, supplies);
      route.push(...leg.slice(1));
    }
  }
  if (route.length < 2 || route.length > 1001)
    throw new Error('Wähle ein anderes Ziel; die Route benötigt 1 bis 1000 Abschnitte.');
  let time = BigInt(s.clock.instantMs),
    total = 0,
    terrainCost = 0;
  const weather = currentWeather(db, cam, s, p, w).weather,
    seconds: number[] = [],
    warnings: string[] = [];
  for (const h of route.slice(1)) {
    const c = cellAt(m, h),
      problem = hexAccessProblem(c, supplies);
    if (problem)
      throw new Error(problem + ' bei ' + hexKey(h) + '. Restweg oder Voraussetzungen prüfen.');
    const cost = terrainFactor(c),
      localWeather = weatherAt(m, h, time.toString(), w.calendar, w.phenomena),
      duration = Math.max(
        1,
        Math.ceil(
          (m.hexMeters / (r.paceKmh * 1000)) *
            3600 *
            cost *
            (weather?.source === 'GM-Override'
              ? weather.effects.travelFactor
              : localWeather.effects.travelFactor) *
            r.factor,
        ),
      );
    terrainCost += cost;
    seconds.push(duration);
    total += duration;
    time += BigInt(duration) * 1000n;
    if (
      c.terrain === 'water' &&
      !warnings.includes('Route enthält Wasser: Boot, Schwimmen und Dauer als GM beurteilen.')
    )
      warnings.push('Route enthält Wasser: Boot, Schwimmen und Dauer als GM beurteilen.');
    if (c.interrupt) warnings.push('Unterbrechung bei ' + hexKey(h) + ': ' + c.interrupt);
  }
  if (r.finalSeconds !== null) {
    if (
      !Number.isSafeInteger(r.finalSeconds) ||
      r.finalSeconds < seconds.length ||
      r.finalSeconds > 1000000000
    )
      throw new Error('Enddauer benötigt mindestens eine Sekunde je Abschnitt.');
    const extra = r.finalSeconds - seconds.length,
      weighted = seconds.map((s) => Math.floor((extra * s) / total) + 1);
    let remainder = r.finalSeconds - weighted.reduce((s, v) => s + v, 0);
    for (let i = 0; remainder > 0; i = (i + 1) % weighted.length) {
      weighted[i]!++;
      remainder--;
    }
    seconds.splice(0, seconds.length, ...weighted);
    total = r.finalSeconds;
  }
  if (supplies.length)
    warnings.unshift('Für diese Reise als vorhanden angegeben: ' + supplies.join(', '));
  if (partyPace?.missing.length)
    warnings.unshift(
      'Bewegung fehlt bei ' +
        partyPace.missing.join(', ') +
        ': jeweils 30 ft angenommen. Prüfe die Profilwerte oder gib ein manuelles Tempo vor.',
    );
  const routeKeys = new Set(route.map(hexKey)),
    places = new Map(
      w.places
        .filter((a) => a.mapId === m.id && !a.trashed && routeKeys.has(hexKey(a)))
        .map((a) => [hexKey(a), a]),
    ),
    locationIds = new Set([...places.values()].map((a) => a.locationId));
  if (s.locationId) locationIds.add(s.locationId);
  const stages: TravelPreview['stages'] = [];
  time = BigInt(s.clock.instantMs);
  for (const [i, h] of route.slice(1).entries()) {
    const departure = String(time),
      duration = seconds[i]!;
    time += BigInt(duration) * 1000n;
    if (i < 40) {
      const cell = cellAt(m, h);
      stages.push({
        index: i + 1,
        hex: h,
        seconds: duration,
        arrival: calendarDate(w.calendar, String(time)),
        placeName: places.get(hexKey(h))?.name ?? cell.label,
        terrain: cell.terrain,
        weather:
          weather?.source === 'GM-Override'
            ? weather
            : weatherAt(m, h, departure, w.calendar, w.phenomena),
        interrupt: cell.interrupt,
      });
    }
  }
  const upcoming: {
    event: WorldView['events'][number];
    occurrence: ReturnType<typeof agendaOccurrence>;
  }[] = [];
  for (const event of w.events) {
    if (event.trashed || (event.locationId && !locationIds.has(event.locationId))) continue;
    const occurrence = agendaOccurrence(event, s.clock.instantMs);
    if (occurrence.state === 'past' || BigInt(occurrence.startMs) > time) continue;
    upcoming.push({ event, occurrence });
    upcoming.sort((a, b) =>
      BigInt(a.occurrence.startMs) < BigInt(b.occurrence.startMs)
        ? -1
        : BigInt(a.occurrence.startMs) > BigInt(b.occurrence.startMs)
          ? 1
          : a.event.name.localeCompare(b.event.name),
    );
    if (upcoming.length > 12) upcoming.pop();
  }
  const events = upcoming.map(({ event, occurrence: o }) => ({
    name: event.name,
    date: calendarDate(w.calendar, o.startMs),
    state: o.state as 'active' | 'upcoming',
  }));
  if (continuation)
    warnings.unshift(
      'Bereits gereiste Abschnitte bleiben abgeschlossen. Restweg, Zeit und Wetter wurden am aktuellen Gruppenstand neu bewertet. Eine frühere Enddauer wird nicht automatisch wieder verwendet.',
    );
  return {
    environmentBasis: travelEnvironmentBasis(db, cam, s.id, m.id, w, r.usePartyPace),
    request: r,
    route,
    distanceMeters: (route.length - 1) * m.hexMeters,
    durationSeconds: total,
    terrainCost,
    segmentSeconds: seconds,
    calendarRevision: w.calendar.revision,
    mapRevision: m.revision,
    clockRevision: s.clock.revision,
    positionRevision: p.revision,
    membershipRevision: s.membershipRevision,
    actorIds: s.members,
    weather,
    departure: calendarDate(w.calendar, s.clock.instantMs),
    arrival: calendarDate(w.calendar, String(time)),
    warnings: [...new Set(warnings)],
    stages,
    events,
    ...(continuation ? { continuation } : {}),
  };
}

function noCombat(db: SqliteDatabase, cam: string, id: string) {
  if (
    checkedQuery(
      db,
      "SELECT 1 FROM combat WHERE campaign_id=? AND scene_id=? AND phase IN('preparing','running')",
      { '1': 'integer' },
    ).get(cam, id)
  )
    throw new Error('Begegnung dieser Gruppe vor der Reise abschließen.');
}

function scenePlace(
  db: SqliteDatabase,
  c: WorldCommand,
  sceneId: string,
  locationId: string | null,
  suffix: string,
) {
  const s = readLiveScene(db, c.campaignId, sceneId);
  if (s.locationId === locationId) return;
  executeLive(
    db,
    {
      commandId: c.commandId + suffix,
      campaignId: c.campaignId,
      token: c.token,
      action: {
        kind: 'scene-content',
        sceneId,
        expectedRevision: s.revision,
        title: s.title,
        notes: s.notes,
        readAloud: s.readAloud ?? '',
        locationId,
      },
    },
    () => {},
  );
}

function journeyBasis(db: SqliteDatabase, cam: string, j: Journey) {
  const scene = readLiveScene(db, cam, j.sceneId),
    p = scenePosition(db, cam, scene),
    w = readWorld(db, cam, false);
  hexTravelContext(db, cam, j.sceneId, p);
  if (scene.membershipRevision !== j.membershipRevision || json(scene.members) !== json(j.actorIds))
    throw new Error('Reisegruppe geändert. Route für die neue Gruppe planen.');
  if (
    scene.clock.revision !== j.clockRevision ||
    p.revision !== j.positionRevision ||
    p.mapId !== j.mapId ||
    hexKey(p) !== hexKey(j.route[j.nextIndex - 1]!)
  )
    throw new Error('Zeit oder Position außerhalb der Reise geändert. Route neu planen.');
  if (
    map(db, cam, j.mapId).revision !== j.mapRevision ||
    travelEnvironmentBasis(db, cam, j.sceneId, j.mapId, w, j.usePartyPace) !== j.environmentBasis
  )
    throw new Error(
      'Reisebasis aus Karte, Kalender, Wetter oder Gruppentempo geändert. Route neu planen.',
    );
  if (j.destinationLocationId) {
    const place = w.places.find((p) => p.locationId === j.destinationLocationId);
    if (
      !place ||
      place.trashed ||
      place.mapId !== j.mapId ||
      hexKey(place) !== hexKey(j.route.at(-1)!)
    )
      throw new Error('Reiseziel geändert. Route neu planen.');
  }
  return w;
}

export interface WorldTimePort<T> {
  capture(sceneId: string): T;
  confirm(commandId: string, before: SceneWorld, after: SceneWorld, basis: T): void;
  validateHistory?(sceneId: string, tables: string[]): void;
}

function cellLandscape(
  db: SqliteDatabase,
  cam: string,
  mapId: string,
  cell: import('../runtime/world-cell-contracts').AtlasCell,
) {
  return checkedQuery(db, sourceCellLookup, { id: 'text', revision: 'integer' }).get(
    cam,
    mapId,
    cell.level,
    cell.q,
    cell.r,
  );
}

function writeCellLandscape(
  db: SqliteDatabase,
  cam: string,
  m: AtlasMap,
  cell: import('../runtime/world-cell-contracts').AtlasCell,
) {
  const { q, r, level } = cell,
    old = cellLandscape(db, cam, m.id, cell),
    id = old?.id ?? randomUUID(),
    revision = old?.revision ?? null;
  const size = m.hexMeters * 3 ** level;
  putLandscape(
    db,
    cam,
    {
      id,
      revision: revision ?? 0,
      kind: 'patch',
      name: 'Gelände',
      points: [],
      polygons: [hexPolygon(q, r, size)],
      resolution: size,
      width: 0,
      values: { terrain: cell.terrain },
      sourceCell: { mapId: m.id, q, r, level },
    },
    revision,
  );
}

export function executeWorld<T = never>(
  db: SqliteDatabase,
  c: WorldCommand,
  guard: () => void,
  timePort?: WorldTimePort<T>,
): WorldAck {
  return db
    .transaction(() => {
      guard();
      if (typeof c.commandId !== 'string' || !c.commandId)
        throw new Error('Weltänderungskennung fehlt.');
      const cam = c.campaignId,
        fp = hash(json({ campaignId: cam, action: c.action })),
        receipt = checkedQuery(db, 'SELECT * FROM world_receipt WHERE command_id=?', {
          command_id: 'text',
          campaign_id: 'text',
          fingerprint: 'text',
          payload: 'text',
          checksum: 'text',
        }).get(c.commandId);
      if (receipt) {
        if (receipt.campaign_id !== cam || receipt.fingerprint !== fp)
          throw new Error('Weltänderungskennung anders verwendet.');
        return checkedWorldReceipt(db, receipt);
      }
      const a = c.action;
      let sceneId: string | null = 'sceneId' in a ? a.sceneId : null;
      if (a.kind === 'calendar') {
        const v = a.calendar;
        if (
          !v.name.trim() ||
          !Number.isSafeInteger(v.startYear) ||
          !Number.isSafeInteger(v.daySeconds) ||
          v.daySeconds < 3600 ||
          v.daySeconds > 604800 ||
          !v.months.length ||
          v.months.length > 100 ||
          v.months.some(
            (m) => !m.name.trim() || !Number.isSafeInteger(m.days) || m.days < 1 || m.days > 10000,
          ) ||
          !v.weekdays.length ||
          v.weekdays.length > 100 ||
          v.weekdays.some((s) => !s.trim())
        )
          throw new Error('Kalender benötigt gültige Monate, Tage und Wochentage.');
        const old = checkedQuery(
          db,
          "SELECT revision FROM world_record WHERE campaign_id=? AND kind='calendar' AND id='main'",
          { revision: 'integer' },
        ).get(cam);
        if ((old?.revision ?? 0) !== a.expectedRevision) throw new Error('Kalender geändert.');
        const before = readWorld(db, cam).calendar;
        writeRecord(db, cam, 'calendar', 'main', v, old?.revision ?? null);
        history(db, cam, null, 'Kalender geändert: ' + v.name, { before, after: v });
      } else if (a.kind === 'map') {
        const m = a.map;
        if (
          !m.id ||
          !m.name.trim() ||
          !['temperate', 'cold', 'arid', 'tropical'].includes(m.climate) ||
          !m.seed ||
          !Array.isArray(m.cells) ||
          m.cells.length > 1000000
        )
          throw new Error('Karte benötigt Name, Klima und Seed.');
        finite(m.hexMeters, 1, 100000000);
        for (const cell of m.cells) {
          checkedHexAccess(cell.access);
          hex(cell);
          finite(cell.elevationM, -20000, 100000);
          if (
            !Number.isSafeInteger(cell.level) ||
            cell.level < 0 ||
            cell.level > 12 ||
            !Object.hasOwn(terrainNames, cell.terrain)
          )
            throw new Error('Kartenhex ungültig.');
        }
        const prior = checkedQuery(
            db,
            "SELECT * FROM world_record WHERE campaign_id=? AND kind='map' AND id=?",
            { payload: 'text' },
          ).get(cam, m.id),
          old = prior ? map(db, cam, m.id) : null;
        const previous = new Map(
          (old?.cells ?? []).map((c: import('../runtime/world-cell-contracts').AtlasCell) => [
            `${c.level}:${c.q}:${c.r}`,
            c.terrain,
          ]),
        );
        const retained = new Set(m.cells.map((c) => `${c.level}:${c.q}:${c.r}`));
        for (const cell of old?.cells ?? [])
          if (
            old!.hexMeters !== m.hexMeters ||
            !retained.has(`${cell.level}:${cell.q}:${cell.r}`)
          ) {
            const row = cellLandscape(db, cam, m.id, cell);
            if (row)
              executeLandscape(db, cam, {
                kind: 'landscape-remove',
                id: row.id,
                expectedRevision: row.revision,
              });
          }
        for (const cell of m.cells)
          if (
            !old ||
            old.hexMeters !== m.hexMeters ||
            previous.get(`${cell.level}:${cell.q}:${cell.r}`) !== cell.terrain
          )
            writeCellLandscape(db, cam, m, cell);
        writeRecord(db, cam, 'map', m.id, m, a.expectedRevision);
        history(db, cam, null, 'Hexkarte gespeichert: ' + m.name, { mapId: m.id });
      } else if (a.kind === 'cell') {
        const m = map(db, cam, a.mapId);
        if (m.revision !== a.expectedRevision) throw new Error('Hexkarte geändert.');
        checkedHexAccess(a.cell.access);
        hex(a.cell);
        finite(a.cell.elevationM, -20000, 100000);
        if (
          !Object.hasOwn(terrainNames, a.cell.terrain) ||
          !Number.isSafeInteger(a.cell.level) ||
          a.cell.level < 0 ||
          a.cell.level > 12
        )
          throw new Error('Hex benötigt gültiges Gelände und Maßstab.');
        m.cells = m.cells.filter(
          (h) => !(h.level === a.cell.level && hexKey(h) === hexKey(a.cell)),
        );
        m.cells.push(a.cell);
        writeCellLandscape(db, cam, m, a.cell);
        writeRecord(db, cam, 'map', m.id, m, a.expectedRevision);
      } else if (a.kind === 'place') {
        hex(a.hex);
        map(db, cam, a.mapId);
        const loc = checkedQuery(
            db,
            'SELECT trashed,revision FROM location WHERE campaign_id=? AND id=?',
            {
              trashed: 'integer',
              revision: 'integer',
            },
          ).get(cam, a.locationId),
          old = checkedQuery(
            db,
            'SELECT revision FROM atlas_place WHERE campaign_id=? AND location_id=?',
            { revision: 'integer' },
          ).get(cam, a.locationId);
        if (
          !loc ||
          loc.trashed ||
          (old?.revision ?? null) !== a.expectedRevision ||
          (a.expectedLocationRevision !== undefined && a.expectedLocationRevision !== loc.revision)
        )
          throw new Error('Ort oder Marker geändert.');
        db.prepare(
          'INSERT INTO atlas_place VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,location_id) DO UPDATE SET map_id=excluded.map_id,revision=excluded.revision,q=excluded.q,r=excluded.r',
        ).run(cam, a.locationId, a.mapId, (a.expectedRevision ?? 0) + 1, a.hex.q, a.hex.r);
        history(db, cam, null, 'Ort auf Hexkarte platziert', {
          locationId: a.locationId,
          mapId: a.mapId,
          hex: a.hex,
        });
      } else if (a.kind === 'place-presentation') {
        const loc = checkedQuery(
            db,
            'SELECT trashed,revision FROM location WHERE campaign_id=? AND id=?',
            {
              trashed: 'integer',
              revision: 'integer',
            },
          ).get(cam, a.locationId),
          anchor = checkedQuery(
            db,
            'SELECT 1 FROM atlas_place WHERE campaign_id=? AND location_id=?',
            { '1': 'integer' },
          ).get(cam, a.locationId);
        if (!loc || loc.trashed || !anchor)
          throw new Error('Ort ist nicht mehr auf der Karte verfügbar.');
        const presentation = checkedMarkerPresentation(a.presentation);
        writeRecord(
          db,
          cam,
          'place-presentation',
          a.locationId,
          { id: a.locationId, ...presentation },
          a.expectedRevision,
        );
        history(db, cam, null, 'Ortsmarke gestaltet', { locationId: a.locationId, presentation });
      } else if (a.kind === 'calendar-event') {
        if (a.basis) {
          if (a.basis.calendarRevision !== readWorldCalendar(db, cam).revision)
            throw new Error('Kalender geändert. Ereignisvorschau aktualisieren.');
          if (a.basis.sceneId) {
            const scene = readLiveScene(db, cam, a.basis.sceneId);
            if (
              scene.retired ||
              scene.clock.revision !== a.basis.clockRevision ||
              scene.clock.instantMs !== a.basis.instantMs
            )
              throw new Error('Gruppenzeit geändert. Relative Frist neu prüfen.');
          }
        }
        const e = checkedCalendarEvent(a.event);
        if (
          e.locationId &&
          !checkedQuery(db, 'SELECT id FROM location WHERE campaign_id=? AND id=?', {
            id: 'text',
          }).get(cam, e.locationId)
        )
          throw new Error('Ereignisort fehlt.');
        writeRecord(db, cam, 'calendar-event', e.id, e, a.expectedRevision);
      } else if (a.kind === 'phenomenon') {
        const p = a.phenomenon;
        map(db, cam, p.mapId);
        hex(p.center);
        finite(p.movement.q, -100, 100);
        finite(p.movement.r, -100, 100);
        finite(p.radiusHexes, 0.1, 10000);
        finite(p.intensity, 0, 1);
        instant(p.startMs);
        instant(p.durationMs, true);
        if (
          !p.id ||
          !p.name.trim() ||
          !['clear', 'clouds', 'rain', 'snow', 'fog', 'storm'].includes(p.kind) ||
          !['active', 'paused', 'ended'].includes(p.state)
        )
          throw new Error('Wetterereignis ungültig.');
        if (p.temperatureC !== null) finite(p.temperatureC, -100, 100);
        if (p.travelFactor !== null) finite(p.travelFactor, 0.1, 20);
        if (p.state === 'paused' && p.pausedAtMs !== null) instant(p.pausedAtMs);
        writeRecord(db, cam, 'phenomenon', p.id, p, a.expectedRevision);
        history(db, cam, null, 'Wetterereignis: ' + p.name, { phenomenon: p });
      } else if (a.kind === 'weather-override') {
        if (
          a.expectedOverrideRevision !== null &&
          (!Number.isSafeInteger(a.expectedOverrideRevision) || a.expectedOverrideRevision < 1)
        )
          throw new Error('Wetterstand für diese Änderung fehlt oder ist ungültig.');
        const s = readLiveScene(db, cam, a.sceneId);
        if (s.clock.revision !== a.expectedClockRevision) throw new Error('Gruppenuhr geändert.');
        if (a.weather !== null) checkedWeather(a.weather);
        const old = checkedQuery(
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
        ).get(cam, a.sceneId);
        if (old) weatherOverride(old);
        if ((old?.revision ?? null) !== a.expectedOverrideRevision)
          throw new Error(
            'Wetter inzwischen geändert. Stand erneut lesen und eigene Eingabe prüfen.',
          );
        writeRecord(
          db,
          cam,
          'weather-override',
          a.sceneId,
          { weather: a.weather },
          old?.revision ?? null,
        );
        history(
          db,
          cam,
          a.sceneId,
          a.weather ? 'Wetter als GM gesetzt' : 'Wetterautomatik wieder freigegeben',
          { weather: a.weather },
        );
      } else if (a.kind === 'notice-dismiss') {
        db.prepare(
          'UPDATE world_notice SET dismissed=1 WHERE campaign_id=? AND scene_id=? AND id=?',
        ).run(cam, a.sceneId, a.id);
      } else if (a.kind === 'reveal') {
        const s = readLiveScene(db, cam, a.sceneId);
        if (s.membershipRevision !== a.expectedMembershipRevision)
          throw new Error('Gruppe geändert.');
        map(db, cam, a.mapId);
        hex(a.hex);
        reveal(db, cam, a.sceneId, a.mapId, a.hex);
      } else if (a.kind === 'place-scene') {
        const s = readLiveScene(db, cam, a.sceneId),
          p = scenePosition(db, cam, s);
        if (s.revision !== a.expectedSceneRevision || p.revision !== a.expectedPositionRevision)
          throw new Error('Gruppenposition geändert.');
        noCombat(db, cam, s.id);
        hex(a.position);
        if (a.position.mapId) map(db, cam, a.position.mapId);
        if (a.placementBasis) {
          const b = a.placementBasis,
            m = a.position.mapId ? map(db, cam, a.position.mapId) : null;
          if (
            !Number.isSafeInteger(b.mapRevision) ||
            !Number.isSafeInteger(b.membershipRevision) ||
            typeof b.requireAuthored !== 'boolean' ||
            !m ||
            m.revision !== b.mapRevision ||
            s.membershipRevision !== b.membershipRevision
          )
            throw new Error(
              'Karte oder Reisegruppe inzwischen geändert. Platzierung erneut wählen.',
            );
          if (b.requireAuthored && !authoredCellAt(m, a.position))
            throw new Error('Token kann nur auf einem beschriebenen Hex platziert werden.');
        }
        if (a.position.locationId) {
          const anchor = checkedQuery(
            db,
            'SELECT * FROM atlas_place WHERE campaign_id=? AND location_id=?',
            {
              campaign_id: 'text',
              location_id: 'text',
              map_id: 'text',
              revision: 'integer',
              q: 'integer',
              r: 'integer',
            },
          ).get(cam, a.position.locationId);
          if (
            anchor &&
            (anchor.map_id !== a.position.mapId ||
              anchor.q !== a.position.q ||
              anchor.r !== a.position.r)
          )
            throw new Error('Position stimmt nicht mit dem Ortsmarker überein.');
        }
        scenePlace(db, c, s.id, a.position.locationId, ':place');
        savePosition(db, cam, s.id, { ...a.position, revision: p.revision + 1 });
        if (a.position.mapId) reveal(db, cam, s.id, a.position.mapId, a.position);
        history(db, cam, s.id, 'Gruppe administrativ platziert; keine Reisezeit', {
          before: p,
          after: a.position,
        });
      } else if (a.kind === 'journey') {
        if (a.presentationSpeed !== undefined && ![1, 2, 5, 10].includes(a.presentationSpeed))
          throw new Error('Wiedergabe benötigt 1×, 2×, 5× oder 10×.');
        const preview = a.preview,
          current = previewTravel(db, cam, preview.request);
        if (canonicalJson(current) !== canonicalJson(preview))
          throw new Error('Reisebasis geändert. Neue Vorschau erstellen.');
        sceneId = current.request.sceneId;
        noCombat(db, cam, sceneId);
        for (const old of checkedQuery(
          db,
          "SELECT * FROM world_journey WHERE campaign_id=? AND scene_id=? AND status IN('active','paused','interrupted')",
          {
            campaign_id: 'text',
            id: 'text',
            scene_id: 'text',
            revision: 'integer',
            status: 'text',
            payload: 'text',
            checksum: 'text',
          },
        ).all(cam, sceneId)) {
          const j = journeyRow(old);
          j.status = 'ended';
          j.revision++;
          saveJourney(db, cam, j);
        }
        const j: Journey = {
          id: randomUUID(),
          revision: 1,
          sceneId,
          mapId: current.request.mapId,
          mapRevision: current.mapRevision,
          clockRevision: current.clockRevision,
          positionRevision: current.positionRevision,
          environmentBasis: current.environmentBasis,
          actorIds: current.actorIds,
          membershipRevision: current.membershipRevision,
          status: 'active',
          presentationSpeed: a.presentationSpeed ?? 1,
          route: current.route,
          nextIndex: 1,
          paceKmh: current.request.paceKmh,
          ...(current.request.supplies ? { supplies: [...current.request.supplies] } : {}),
          ...(current.request.usePartyPace ? { usePartyPace: true } : {}),
          factor: current.request.factor,
          finalSeconds: current.request.finalSeconds,
          plannedSeconds: current.durationSeconds,
          segmentSeconds: current.segmentSeconds,
          destinationLocationId: current.request.destinationLocationId,
          reason: '',
          createdAt: new Date().toISOString(),
          ...(current.continuation
            ? {
                continuedFrom: {
                  id: current.continuation.journeyId,
                  revision: current.continuation.revision,
                  completedSteps: current.continuation.completedSteps,
                },
              }
            : {}),
        };
        saveJourney(db, cam, j);
        history(
          db,
          cam,
          sceneId,
          (current.continuation ? 'Restreise neu angenommen: ' : 'Reise angenommen: ') +
            (j.route.length - 1) +
            ' Abschnitte',
          { preview: current, journeyId: j.id },
        );
      } else if (a.kind === 'journey-state') {
        const j = journey(db, cam, a.id);
        sceneId = j.sceneId;
        if (
          j.revision !== a.expectedRevision ||
          ['ended', 'arrived'].includes(j.status) ||
          !['active', 'paused', 'ended'].includes(a.state)
        )
          throw new Error('Reise geändert oder abgeschlossen.');
        if (a.state === 'active') {
          noCombat(db, cam, j.sceneId);
          journeyBasis(db, cam, j);
        }
        j.status = a.state === 'active' && j.nextIndex >= j.route.length ? 'arrived' : a.state;
        j.reason = '';
        j.revision++;
        saveJourney(db, cam, j);
        history(
          db,
          cam,
          j.sceneId,
          'Reise ' + { active: 'fortgesetzt', paused: 'pausiert', ended: 'beendet' }[a.state],
          { journeyId: j.id },
        );
      } else if (a.kind === 'travel-history') {
        if (!['undo', 'redo'].includes(a.direction))
          throw Error('Rücknahme oder Wiederholung wählen.');
        sceneId = a.sceneId;
        noCombat(db, cam, sceneId);
        const current = readSceneWorld(db, cam, sceneId);
        if (!current.journey) throw Error('Kein Reisecheckpoint vorhanden.');
        journeyBasis(db, cam, current.journey);
        const result = applyTravelHistory(db, cam, c.commandId, current, a);
        timePort?.validateHistory?.(sceneId, result.tables);
        history(
          db,
          cam,
          sceneId,
          (a.direction === 'undo' ? 'Reiseschritt zurückgenommen' : 'Reiseschritt wiederholt') +
            (result.retainedShared ? ' · spätere gemeinsame Weltfakten erhalten' : ''),
          result,
        );
      } else if (a.kind === 'journey-step') {
        const j = journey(db, cam, a.id);
        sceneId = j.sceneId;
        if (
          j.revision !== a.expectedRevision ||
          j.status !== 'active' ||
          !Number.isSafeInteger(a.maxSteps) ||
          a.maxSteps < 1 ||
          a.maxSteps > 12
        )
          throw new Error('Aktive Reise benötigt 1 bis 12 nächste Abschnitte.');
        noCombat(db, cam, j.sceneId);
        const w = journeyBasis(db, cam, j);
        for (let step = 0; step < a.maxSteps && j.nextIndex < j.route.length; step++) {
          const before = readSceneWorld(db, cam, j.sceneId),
            from = j.route[j.nextIndex - 1]!,
            to = j.route[j.nextIndex]!;
          if (
            before.scene.clock.revision !== j.clockRevision ||
            before.position.revision !== j.positionRevision ||
            before.position.mapId !== j.mapId ||
            hexKey(before.position) !== hexKey(from)
          )
            throw new Error('Zeit oder Position außerhalb der Reise geändert. Route neu planen.');
          const blocked = hexAccessProblem(cellAt(map(db, cam, j.mapId, to), to), j.supplies);
          if (blocked) throw new Error(blocked + ' bei ' + hexKey(to) + '. Restweg neu bewerten.');
          const capture = captureTravelEffects(db, cam);
          try {
            const seconds = j.segmentSeconds[j.nextIndex - 1]!,
              timeBasis = timePort?.capture(j.sceneId),
              clockCommandId = c.commandId + ':clock:' + step;
            executeLive(
              db,
              {
                commandId: clockCommandId,
                campaignId: cam,
                token: c.token,
                action: {
                  kind: 'advance-clock',
                  sceneId: j.sceneId,
                  expectedRevision: before.scene.clock.revision,
                  amount: seconds,
                  unit: 'seconds',
                  calendarVersion: 'relative-v1',
                  reason: 'Reise ' + j.id + ' · ' + hexKey(from) + ' → ' + hexKey(to),
                },
              },
              () => {},
            );
            const place =
              j.nextIndex === j.route.length - 1
                ? j.destinationLocationId
                : (w.places.find(
                    (p) => p.mapId === j.mapId && !p.trashed && hexKey(p) === hexKey(to),
                  )?.locationId ?? null);
            scenePlace(db, c, j.sceneId, place, ':arrival:' + step);
            savePosition(db, cam, j.sceneId, {
              ...to,
              mapId: j.mapId,
              locationId: place,
              revision: before.position.revision + 1,
            });
            reveal(db, cam, j.sceneId, j.mapId, to);
            const moved = readLiveScene(db, cam, j.sceneId);
            restockDue(db, cam, moved.clock.instantMs);
            syncSceneWorld(db, cam, readLiveScene(db, cam, j.sceneId));
            const after = readSceneWorld(db, cam, j.sceneId);
            if (timePort) timePort.confirm(clockCommandId, before, after, timeBasis as T);
            history(
              db,
              cam,
              j.sceneId,
              'Reise: ' +
                hexKey(from) +
                ' → ' +
                hexKey(to) +
                ' · ' +
                Math.round(seconds / 60) +
                ' Minuten',
              {
                journeyId: j.id,
                ordinal: j.nextIndex,
                actorIds: j.actorIds,
                before: {
                  position: before.position,
                  clock: before.scene.clock,
                  weather: before.weather,
                },
                after: {
                  position: after.position,
                  clock: after.scene.clock,
                  weather: after.weather,
                },
                seconds,
              },
            );
            j.clockRevision = after.scene.clock.revision;
            j.positionRevision = after.position.revision;
            j.nextIndex++;
            const cell = cellAt(map(db, cam, j.mapId, to), to);
            if (cell.interrupt) {
              j.status = 'interrupted';
              j.reason = cell.interrupt;
              history(db, cam, j.sceneId, 'Reise angehalten: ' + cell.interrupt, {
                journeyId: j.id,
                hex: to,
              });
            } else if (j.nextIndex >= j.route.length) j.status = 'arrived';
            j.revision++;
            saveJourney(db, cam, j);
            syncSceneWorld(db, cam, readLiveScene(db, cam, j.sceneId));
            recordTravelCheckpoint(
              db,
              cam,
              clockCommandId,
              before,
              readSceneWorld(db, cam, j.sceneId),
              capture.finish(),
            );
          } finally {
            capture.cancel();
          }
          if (j.status !== 'active') break;
        }
      } else throw new Error('Unbekannte Weltaktion.');
      if (sceneId) syncSceneWorld(db, cam, readLiveScene(db, cam, sceneId));
      else
        for (const row of checkedQuery(
          db,
          'SELECT s.id FROM live_scene s JOIN scene_lifecycle l ON l.campaign_id=s.campaign_id AND l.id=s.id WHERE s.campaign_id=? AND l.retired=0',
          { id: 'text' },
        ).all(cam))
          syncSceneWorld(db, cam, readLiveScene(db, cam, row.id));
      const result: WorldAck = {
          world: readWorld(db, cam),
          scene: sceneId ? readSceneWorld(db, cam, sceneId) : null,
        },
        payload = json(result);
      db.prepare('INSERT INTO world_receipt VALUES(?,?,?,?,?)').run(
        c.commandId,
        cam,
        fp,
        payload,
        hash(payload),
      );
      return result;
    })
    .immediate();
}
