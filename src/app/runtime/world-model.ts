import { effectiveLandscape } from '../atlas/atlas-landscape';
import { hexAccessProblem, checkedTravelSupplies } from './hex-access';
import type {
  Hex,
  AtlasMap,
  AtlasCell,
  FantasyCalendar,
  Climate,
  Weather,
  WeatherPhenomenon,
  CalendarEvent,
  Terrain,
} from './world-contracts';
export const terrainNames: Record<Terrain, string> = {
  plains: 'Ebene',
  forest: 'Wald',
  hills: 'Hügel',
  mountains: 'Gebirge',
  water: 'Wasser',
  marsh: 'Sumpf',
  desert: 'Wüste',
  snow: 'Schnee / Eis',
};
export const terrainColors: Record<Terrain, string> = {
  plains: '#b8c896',
  forest: '#668b69',
  hills: '#b9ad88',
  mountains: '#90969a',
  water: '#7fa8bd',
  marsh: '#7e9b8a',
  desert: '#d5bd89',
  snow: '#dbe4e5',
};
export const climateNames: Record<Climate, string> = {
  temperate: 'Gemäßigt',
  cold: 'Kalt',
  arid: 'Trocken',
  tropical: 'Tropisch',
};
export const hexKey = (h: Hex) => h.q + ',' + h.r;
export function hexPoint(h: Hex, diameter = 1) {
  return { x: diameter * (h.q + h.r / 2), y: ((diameter * Math.sqrt(3)) / 2) * h.r };
}
export function pointHex(x: number, y: number, diameter = 1): Hex {
  const r = y / ((diameter * Math.sqrt(3)) / 2),
    q = x / diameter - r / 2;
  let a = Math.round(q),
    b = Math.round(r),
    c = Math.round(-q - r);
  const da = Math.abs(a - q),
    db = Math.abs(b - r),
    dc = Math.abs(c + q + r);
  if (da > db && da > dc) a = -b - c;
  else if (db > dc) b = -a - c;
  else c = -a - b;
  return { q: a, r: b };
}
export const hexDistance = (a: Hex, b: Hex) =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
export const neighbors = (h: Hex) =>
  [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ].map(([q, r]) => ({ q: h.q + q!, r: h.r + r! }));
export function checkedCalendarEvent(value: unknown, persisted = false): CalendarEvent {
  const event = value as CalendarEvent,
    id = (v: unknown) => typeof v === 'string' && !!v,
    instant = (v: unknown, positive = false) =>
      typeof v === 'string' && /^(0|[1-9][0-9]{0,29})$/.test(v) && (!positive || v !== '0');
  if (
    !event ||
    !id(event.id) ||
    !Number.isSafeInteger(event.revision) ||
    event.revision < (persisted ? 1 : 0) ||
    typeof event.name !== 'string' ||
    !event.name.trim() ||
    !instant(event.startMs) ||
    !instant(event.durationMs, true) ||
    (event.repeatMs !== null && !instant(event.repeatMs, true)) ||
    (event.locationId !== null && !id(event.locationId)) ||
    typeof event.notes !== 'string' ||
    typeof event.trashed !== 'boolean'
  )
    throw new Error('Kalenderereignis ist beschädigt.');
  return event;
}
const indices = new WeakMap<AtlasMap, { cells: AtlasCell[]; index: Map<string, AtlasCell> }>();
function cellIndex(map: AtlasMap) {
  let cached = indices.get(map);
  if (!cached || cached.cells !== map.cells) {
    cached = {
      cells: map.cells,
      index: new Map(map.cells.map((c) => [c.level + ':' + hexKey(c), c])),
    };
    indices.set(map, cached);
  }
  return cached.index;
}
export function authoredCellAt(map: AtlasMap, h: Hex, level = 0): AtlasCell | null {
  for (let l = level; l <= 12; l++) {
    const p = hexPoint(h, 3 ** level),
      parent = pointHex(p.x, p.y, 3 ** l),
      cell = cellIndex(map).get(l + ':' + hexKey(parent));
    if (cell) return { ...cell, ...h, level };
  }
  return null;
}
export function cellAt(map: AtlasMap, h: Hex, level = 0): AtlasCell {
  const base = authoredCellAt(map, h, level) ?? {
    ...h,
    level,
    terrain: 'water' as const,
    elevationM: 0,
    climate: null,
    road: false,
    river: false,
    label: '',
    faction: '',
    interrupt: '',
  };
  return {
    ...base,
    ...effectiveLandscape(map.landscape ?? [], hexPoint(h, map.hexMeters * 3 ** level), base),
  };
}
export function calendarDate(c: FantasyCalendar, ms: string) {
  const dayMs = BigInt(c.daySeconds) * 1000n,
    days = BigInt(ms) / dayMs,
    yearDays = c.months.reduce((s, m) => s + m.days, 0),
    year = BigInt(c.startYear) + days / BigInt(yearDays);
  let day = Number(days % BigInt(yearDays)),
    month = c.months[0]!;
  for (const m of c.months) {
    if (day < m.days) {
      month = m;
      break;
    }
    day -= m.days;
  }
  const within = BigInt(ms) % dayMs,
    seconds = within / 1000n,
    hours = seconds / 3600n,
    minutes = (seconds / 60n) % 60n;
  return (
    (c.weekdays.length ? c.weekdays[Number(days % BigInt(c.weekdays.length))] + ', ' : '') +
    (day + 1) +
    '. ' +
    month.name +
    ' ' +
    year +
    ' · ' +
    hours.toString().padStart(2, '0') +
    ':' +
    minutes.toString().padStart(2, '0')
  );
}
export function relevantEvent(e: CalendarEvent, instant: string, locationId: string | null) {
  if (e.trashed || (e.locationId !== null && e.locationId !== locationId)) return false;
  const delta = BigInt(instant) - BigInt(e.startMs);
  return delta >= 0n && (e.repeatMs ? delta % BigInt(e.repeatMs) : delta) < BigInt(e.durationMs);
}
export function weatherEffects(kind: Weather['kind'], intensity: number, temperature: number) {
  const severe = intensity >= 0.65;
  return {
    visibilityMeters:
      kind === 'fog'
        ? Math.round(800 - 750 * intensity)
        : kind === 'storm'
          ? Math.round(2000 - 1800 * intensity)
          : kind === 'rain' || kind === 'snow'
            ? Math.round(6000 - 5000 * intensity)
            : 20000,
    travelFactor:
      kind === 'storm'
        ? 1 + intensity
        : kind === 'snow'
          ? 1 + intensity * 0.8
          : kind === 'rain'
            ? 1 + intensity * 0.35
            : 1,
    perception:
      kind === 'fog' || kind === 'storm'
        ? 'Sicht erschwert; Wahrnehmung als GM beurteilen.'
        : kind === 'rain' || kind === 'snow'
          ? 'Niederschlag beeinflusst Sicht und Geräusche.'
          : 'Keine wetterbedingte Einschränkung.',
    temperatureC: Math.round(temperature * 10) / 10,
    ambience:
      kind === 'storm'
        ? ['Wind', 'Starkregen', 'Donner']
        : kind === 'rain'
          ? ['Regen']
          : kind === 'snow'
            ? ['Wind', 'Schnee']
            : kind === 'fog'
              ? ['Gedämpfte Umgebung']
              : [],
    combatNote:
      severe && kind === 'storm'
        ? 'Starker Wind und Niederschlag: Fernangriffe und Konzentration als GM beurteilen.'
        : temperature < -10
          ? 'Extreme Kälte: Schutz und Erschöpfung beurteilen.'
          : temperature > 35
            ? 'Extreme Hitze: Wasser und Erschöpfung beurteilen.'
            : '',
  };
}
const weatherNames: Record<Weather['kind'], string> = {
  clear: 'Klar',
  clouds: 'Bewölkt',
  rain: 'Regen',
  snow: 'Schnee',
  fog: 'Nebel',
  storm: 'Sturm',
};
export function checkedWeather(value: unknown): Weather {
  const v = value as Weather,
    e = v?.effects;
  const numeric = (n: unknown, min: number, max = Infinity) =>
    typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (
    !v ||
    typeof v !== 'object' ||
    typeof v.kind !== 'string' ||
    !Object.hasOwn(weatherNames, v.kind) ||
    typeof v.label !== 'string' ||
    typeof v.source !== 'string' ||
    !numeric(v.intensity, 0, 1) ||
    !numeric(v.windKmh, 0) ||
    !e ||
    typeof e !== 'object' ||
    !numeric(e.travelFactor, 0.1, 20) ||
    !numeric(e.visibilityMeters, 0, 1000000) ||
    !numeric(e.temperatureC, -100, 100) ||
    typeof e.perception !== 'string' ||
    typeof e.combatNote !== 'string' ||
    !Array.isArray(e.ambience) ||
    e.ambience.some((a) => typeof a !== 'string')
  )
    throw new Error('Wetterart, Werte und Texte prüfen.');
  return v;
}
export function weatherAt(
  map: AtlasMap,
  h: Hex,
  ms: string,
  calendar: FantasyCalendar,
  phenomena: WeatherPhenomenon[],
): Weather {
  const dayMs = BigInt(calendar.daySeconds) * 1000n,
    day = Number((BigInt(ms) / dayMs) % 1000000n) + Number(BigInt(ms) % dayMs) / Number(dayMs),
    point = hexPoint(h, map.hexMeters / 1000),
    cell = cellAt(map, h),
    climate = cell.climate ?? map.climate,
    phase =
      ([...map.seed].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 10007, 0) / 10007) * Math.PI * 2,
    yearDays = calendar.months.reduce((s, m) => s + m.days, 0),
    season = (Number((BigInt(ms) / dayMs) % BigInt(yearDays)) / yearDays) * Math.PI * 2;
  const base = { temperate: 13, cold: -3, arid: 26, tropical: 27 }[climate],
    swing = { temperate: 12, cold: 16, arid: 7, tropical: 3 }[climate],
    wet =
      (Math.sin(day / 2.7 + point.x / 65 + point.y / 110 + phase) +
        Math.sin(day / 6.3 - point.x / 170 + phase * 0.7) +
        2) /
      4,
    humidity =
      climate === 'arid' ? wet * 0.55 : climate === 'tropical' ? Math.min(1, wet + 0.12) : wet;
  const temperature =
    base -
    swing * Math.cos(season) +
    3 * Math.sin(day * Math.PI * 2 - Math.PI / 2) -
    cell.elevationM * 0.0065;
  let kind: Weather['kind'] =
      humidity > 0.86
        ? 'storm'
        : humidity > 0.61
          ? temperature < 0
            ? 'snow'
            : 'rain'
          : humidity > 0.38
            ? 'clouds'
            : 'clear',
    intensity = Math.max(0, Math.min(1, (humidity - 0.35) / 0.65)),
    source = 'Saison und wandernde Wetterfelder';
  let selected: WeatherPhenomenon | undefined;
  for (const p of phenomena) {
    if (p.mapId !== map.id || p.state === 'ended') continue;
    const effective = p.state === 'paused' ? BigInt(p.pausedAtMs ?? ms) : BigInt(ms),
      delta = effective - BigInt(p.startMs);
    if (delta < 0n || delta >= BigInt(p.durationMs)) continue;
    const days = Number(delta) / Number(dayMs),
      center = { q: p.center.q + p.movement.q * days, r: p.center.r + p.movement.r * days };
    if (hexDistance(h, center) <= p.radiusHexes) selected = p;
  }
  if (selected) {
    kind = selected.kind;
    intensity = selected.intensity;
    source = selected.name;
  }
  const effects = weatherEffects(kind, intensity, selected?.temperatureC ?? temperature);
  if (selected?.travelFactor !== null && selected?.travelFactor !== undefined)
    effects.travelFactor = selected.travelFactor;
  if (selected?.notes)
    effects.combatNote = [effects.combatNote, selected.notes].filter(Boolean).join(' ');
  return {
    label: weatherNames[kind],
    kind,
    intensity: Math.round(intensity * 100) / 100,
    windKmh: Math.round(
      10 +
        (12 * (1 + Math.sin(day / 3.8 + point.x / 90 + phase))) / 2 +
        (kind === 'storm' ? 25 * intensity : 0),
    ),
    effects,
    source,
  };
}
export function terrainFactor(cell: AtlasCell) {
  return cell.road
    ? 1
    : {
        plains: 1,
        forest: 1.5,
        hills: 1.5,
        mountains: 2.5,
        water: 1.2,
        marsh: 2,
        desert: 1.5,
        snow: 2,
      }[cell.terrain];
}
export function findRoute(map: AtlasMap, start: Hex, end: Hex, supplies: string[] = []): Hex[] {
  checkedTravelSupplies(supplies);
  if (hexKey(start) === hexKey(end)) return [start];
  const problem = hexAccessProblem(cellAt(map, end), supplies);
  if (problem)
    throw new Error(problem + ' bei ' + hexKey(end) + '. Ziel oder Voraussetzungen prüfen.');
  if (hexDistance(start, end) > 500)
    throw new Error('Plane diese Reise in Abschnitten von höchstens 500 Hexes.');
  const costs = new Map<string, number>([[hexKey(start), 0]]),
    previous = new Map<string, Hex>(),
    open: [Hex, number][] = [[start, 0]],
    margin = 8;
  let visited = 0;
  while (open.length) {
    open.sort((a, b) => b[1] - a[1]);
    const [h, score] = open.pop()!,
      key = hexKey(h);
    // A cheaper entry has already expanded this Hex; discard the obsolete work.
    if (score > costs.get(key)! + hexDistance(h, end)) continue;
    if (key === hexKey(end)) {
      const result = [end];
      let p = end;
      while (hexKey(p) !== hexKey(start)) {
        p = previous.get(hexKey(p))!;
        result.push(p);
      }
      return result.reverse();
    }
    if (++visited > 25000)
      throw new Error('Route zu umfangreich. Füge einen näheren Wegpunkt hinzu.');
    for (const n of neighbors(h)) {
      if (hexDistance(start, n) + hexDistance(n, end) > hexDistance(start, end) + margin) continue;
      const cell = cellAt(map, n);
      if (hexAccessProblem(cell, supplies)) continue;
      const next = costs.get(key)! + terrainFactor(cell),
        old = costs.get(hexKey(n));
      if (old !== undefined && old <= next) continue;
      costs.set(hexKey(n), next);
      previous.set(hexKey(n), h);
      open.push([n, next + hexDistance(n, end)]);
    }
  }
  throw new Error('Keine Route gefunden.');
}
