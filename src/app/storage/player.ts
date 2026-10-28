import { createHash, randomUUID } from 'node:crypto';
import { contains } from '../atlas/landscape-geometry';
import type {
  PlayerAction,
  PlayerAsset,
  PlayerCommand,
  PlayerFrame,
  PlayerMapCell,
  PlayerMapQuery,
  PlayerObserver,
  PlayerSettings,
  PlayerView,
} from '../runtime/player-contracts';
import type { Hex } from '../runtime/world-cell-contracts';
import type { SceneWorld } from '../runtime/world-contracts';
import { authoredCellAt, cellAt, hexDistance, hexPoint, pointHex } from '../runtime/world-model';
import {
  addMemory,
  checkedMemory,
  rememberAtlasHex,
  unionMemory,
  validateAtlasMemory,
  type RememberedHex,
} from './atlas-knowledge';
import { dungeonDisplay } from './dungeon-play';
import { readLive } from './live-read';
import { position as scenePosition } from './scene-position';
import { readSceneWorld, readWorld } from './world-state';
const hash = (p: string) => createHash('sha256').update(p).digest('hex');
export function installPlayerSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS player_record(campaign_id TEXT NOT NULL REFERENCES campaign(id),kind TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,kind,id)) STRICT;
CREATE TABLE IF NOT EXISTS player_asset(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,kind TEXT NOT NULL,subject_id TEXT,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS player_discovery(campaign_id TEXT NOT NULL,character_id TEXT NOT NULL,id TEXT NOT NULL,kind TEXT NOT NULL,subject_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),UNIQUE(campaign_id,character_id,kind,subject_id),FOREIGN KEY(campaign_id,character_id) REFERENCES roster_member(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS player_receipt(campaign_id TEXT NOT NULL REFERENCES campaign(id),command_id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL) STRICT;`);
}
function parsed<T = any>(r: any): T {
  if (!r || hash(r.payload) !== r.checksum)
    throw new Error('Spieleranzeigedaten fehlen oder sind beschädigt.');
  const value = JSON.parse(r.payload);
  if (
    r.revision !== undefined &&
    (!Number.isSafeInteger(r.revision) || r.revision < 1 || value?.revision !== r.revision)
  )
    throw new Error('Spieleranzeigerevision widersprüchlich.');
  return value;
}
const identity = (id: unknown) => typeof id === 'string' && id.length > 0;
const nullableIdentity = (id: unknown) => id === null || identity(id);
function validateSettings(s: PlayerSettings) {
  if (
    !s ||
    !['follow', 'image', 'scene'].includes(s.mode) ||
    !['auto', 'daylight', 'dim', 'darkness'].includes(s.light) ||
    [s.blank, s.windowOpen, s.labels, s.fullscreen].some((v) => typeof v !== 'boolean') ||
    typeof s.title !== 'string' ||
    s.title.length > 1000 ||
    !nullableIdentity(s.imageId) ||
    !nullableIdentity(s.boundSceneId) ||
    (s.mode === 'image' && !s.blank && s.imageId === null) ||
    (s.displayId !== null && !Number.isSafeInteger(s.displayId))
  )
    throw new Error('Anzeigeoptionen prüfen.');
}
function validateObserver(o: PlayerObserver) {
  if (
    !o ||
    !identity(o.characterId) ||
    typeof o.enabled !== 'boolean' ||
    !Number.isFinite(o.rangeMeters) ||
    o.rangeMeters < 0 ||
    o.rangeMeters > 200000 ||
    !Number.isFinite(o.darkvisionMeters) ||
    o.darkvisionMeters < 0 ||
    o.darkvisionMeters > 10000 ||
    !Number.isFinite(o.eyeHeightMeters) ||
    o.eyeHeightMeters < 0 ||
    o.eyeHeightMeters > 1000
  )
    throw new Error('Charakter oder Sichtwerte prüfen.');
}
function validateCell(
  m: Pick<Extract<PlayerAction, { kind: 'mask' }>, 'mapId' | 'q' | 'r' | 'publicLabel'>,
) {
  if (
    !m ||
    !identity(m.mapId) ||
    !Number.isSafeInteger(m.q) ||
    !Number.isSafeInteger(m.r) ||
    Math.abs(m.q) > 1e9 ||
    Math.abs(m.r) > 1e9 ||
    typeof m.publicLabel !== 'string' ||
    m.publicLabel.length > 1000
  )
    throw new Error('Karte, Hex oder öffentliche Beschriftung prüfen.');
}
function validateMask(m: Extract<PlayerAction, { kind: 'mask' }>) {
  validateCell(m);
  if (m.kind !== 'mask' || typeof m.hidden !== 'boolean' || typeof m.blocksSight !== 'boolean')
    throw new Error('Sichtmaskenwerte prüfen.');
}

interface LocationKnowledge {
  publicLabel: string;
  position?: { mapId: string; q: number; r: number; revision: number } | null;
  confirmationRevision?: number;
}
function checkedDiscovery(row: any, settingsRevision: number): LocationKnowledge {
  const k = parsed<LocationKnowledge>(row),
    p = k.position;
  if (
    row.kind !== 'location' ||
    !identity(row.id) ||
    !identity(row.subject_id) ||
    typeof k.publicLabel !== 'string' ||
    k.publicLabel.length > 1000 ||
    Object.keys(k).some((key) => !['publicLabel', 'position', 'confirmationRevision'].includes(key))
  )
    throw new Error('Ortskenntnis ist ungültig.');
  if (
    k.confirmationRevision !== undefined &&
    (!Number.isSafeInteger(k.confirmationRevision) ||
      k.confirmationRevision < 1 ||
      k.confirmationRevision > settingsRevision)
  )
    throw new Error('Ortskenntnisrevision ist widersprüchlich.');
  if (
    (k.confirmationRevision !== undefined && p === undefined) ||
    (p !== undefined &&
      (k.confirmationRevision === undefined ||
        (p !== null &&
          (!p ||
            typeof p !== 'object' ||
            Array.isArray(p) ||
            Object.keys(p).some((key) => !['mapId', 'q', 'r', 'revision'].includes(key)) ||
            !identity(p.mapId) ||
            ![p.q, p.r].every((v) => Number.isSafeInteger(v) && Math.abs(v) <= 1e9) ||
            !Number.isSafeInteger(p.revision) ||
            p.revision < 1))))
  )
    throw new Error('Erinnerte Ortsposition ist ungültig.');
  return k;
}
const discoveryFacts = (k: LocationKnowledge) =>
  JSON.stringify([
    k.publicLabel,
    k.position === undefined
      ? 'legacy'
      : k.position === null
        ? null
        : [k.position.mapId, k.position.q, k.position.r, k.position.revision],
    k.confirmationRevision ?? null,
  ]);
function validateDiscoveries(db: any) {
  const revisions = new Map<string, number>(),
    location = db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?'),
    map = db.prepare("SELECT 1 FROM world_record WHERE campaign_id=? AND kind='map' AND id=?");
  for (const row of db.prepare('SELECT * FROM player_discovery').iterate()) {
    let revision = revisions.get(row.campaign_id);
    if (revision === undefined) {
      revision = playerSettings(db, row.campaign_id).revision;
      revisions.set(row.campaign_id, revision);
    }
    const value = checkedDiscovery(row, revision);
    if (
      !location.get(row.campaign_id, row.subject_id) ||
      (value.position && !map.get(row.campaign_id, value.position.mapId))
    )
      throw new Error('Ortskenntnisreferenz fehlt.');
  }
}

function checkedPlayerRecord(db: any, row: any) {
  let v = parsed(row);
  const cam = row.campaign_id;
  if (row.kind === 'settings') {
    if (v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, 'boundSceneId'))
      v = { ...v, boundSceneId: null };
    validateSettings(v);
    if (row.id !== 'main') throw new Error('Anzeigeoptionskennung widersprüchlich.');
    if (
      v.imageId !== null &&
      !db.prepare('SELECT 1 FROM player_asset WHERE campaign_id=? AND id=?').get(cam, v.imageId)
    )
      throw new Error('Bildauswahl fehlt.');
    if (
      v.boundSceneId !== null &&
      !db.prepare('SELECT 1 FROM live_scene WHERE campaign_id=? AND id=?').get(cam, v.boundSceneId)
    )
      throw new Error('Anzeigeszenenbindung fehlt.');
  } else if (row.kind === 'observer') {
    validateObserver(v);
    if (
      v.characterId !== row.id ||
      !db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(cam, row.id)
    )
      throw new Error('Beobachterbindung fehlt.');
  } else if (row.kind === 'mask') {
    validateMask(v);
    if (
      !db
        .prepare("SELECT 1 FROM world_record WHERE campaign_id=? AND kind='map' AND id=?")
        .get(cam, v.mapId)
    )
      throw new Error('Sichtmaskenkarte fehlt.');
  } else
    throw new Error('Unbekannte Spieleranzeigedaten benötigen einen unterstützten Formatstand.');
  return v;
}

const defaults = (): PlayerSettings => ({
  revision: 0,
  blank: true,
  windowOpen: false,
  mode: 'follow',
  imageId: null,
  boundSceneId: null,
  title: '',
  labels: false,
  light: 'auto',
  displayId: null,
  fullscreen: false,
});
export function playerSettings(db: any, cam: string): PlayerSettings {
  const r = db
    .prepare("SELECT * FROM player_record WHERE campaign_id=? AND kind='settings' AND id='main'")
    .get(cam);
  return r ? checkedPlayerRecord(db, r) : defaults();
}
function saveRecord(db: any, cam: string, kind: string, id: string, v: any) {
  const old = db
      .prepare('SELECT revision FROM player_record WHERE campaign_id=? AND kind=? AND id=?')
      .get(cam, kind, id),
    revision = (old?.revision ?? 0) + 1,
    payload = JSON.stringify({ ...v, revision });
  db.prepare(
    'INSERT INTO player_record VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,kind,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, kind, id, revision, payload, hash(payload));
  return revision;
}
export function playerMediaFiles(db: any, cam: string) {
  const files = new Map<string, { name: string; sha256: string; bytes: number }>();
  for (const row of db.prepare('SELECT * FROM player_asset WHERE campaign_id=?').iterate(cam)) {
    const a = checkedPlayerAsset(row),
      name = 'images/' + a.sha256 + a.extension,
      previous = files.get(name);
    if (previous && previous.bytes !== a.bytes)
      throw new Error('Gemeinsame Bildgröße widersprüchlich: ' + name);
    files.set(name, { name, sha256: a.sha256, bytes: a.bytes });
  }
  return [...files.values()];
}
export function playerAssets(db: any, cam: string): PlayerAsset[] {
  return db
    .prepare('SELECT * FROM player_asset WHERE campaign_id=? ORDER BY rowid')
    .all(cam)
    .map((row: any) => {
      const a = checkedPlayerAsset(row);
      checkImageOwner(db, cam, a);
      return a;
    });
}
export function playerObservers(db: any, cam: string) {
  const live = readLive(db, cam),
    list = (live.scene?.members ?? []).map((id) => {
      const member = live.roster.find((c) => c.id === id)!;
      const r = db
          .prepare("SELECT * FROM player_record WHERE campaign_id=? AND kind='observer' AND id=?")
          .get(cam, id),
        o: PlayerObserver = r
          ? checkedPlayerRecord(db, r)
          : {
              characterId: id,
              enabled: true,
              rangeMeters: 10000,
              darkvisionMeters: 0,
              eyeHeightMeters: 1.7,
            };
      return { ...o, name: member.profile.name };
    });
  return { live, list };
}
function mapLine(a: Hex, b: Hex): Hex[] {
  const n = hexDistance(a, b),
    out: Hex[] = [];
  if (n > 200) return out;
  for (let i = 1; i < n; i++) {
    const t = i / n,
      x = a.q + (b.q - a.q) * t,
      z = a.r + (b.r - a.r) * t,
      y = -x - z;
    let q = Math.round(x),
      r = Math.round(z),
      m = Math.round(y);
    const dx = Math.abs(q - x),
      dy = Math.abs(m - y),
      dz = Math.abs(r - z);
    if (dx > dy && dx > dz) q = -m - r;
    else if (dy > dz) m = -q - r;
    else r = -q - m;
    out.push({ q, r });
  }
  return out;
}
function light(frame: SceneWorld, s: PlayerSettings, daySeconds: number) {
  if (s.light !== 'auto') return s.light;
  const hour =
    (Number(BigInt(frame.scene.clock.instantMs) % (BigInt(daySeconds) * 1000n)) /
      (daySeconds * 1000)) *
    24;
  return hour >= 6 && hour < 18 ? 'daylight' : hour >= 5 && hour < 19 ? 'dim' : 'darkness';
}
export function projectPlayer(db: any, cam: string): PlayerFrame {
  return db.transaction(() => {
    const s = playerSettings(db, cam),
      { live, list } = playerObservers(db, cam);
    if (s.blank || !live.scene || !list.length)
      return {
        mode: 'blank',
        title: '',
        reason: s.blank ? 'GM hat die Anzeige ausgeblendet.' : 'Keine fokussierte Gruppe.',
      } as PlayerFrame;
    const assets = playerAssets(db, cam);
    if (s.mode === 'image') {
      if (s.boundSceneId !== live.scene.id)
        return { mode: 'blank', title: '', reason: 'Bildauswahl gehört zu einer anderen Gruppe.' };
      const asset = assets.find((a) => a.id === s.imageId);
      return asset
        ? { mode: 'image', title: s.title || asset.title, imageId: asset.id }
        : { mode: 'blank', title: '', reason: 'Bild fehlt.' };
    }
    // Scene and mask names organize GM work; only the explicit public title may cross this boundary.
    // Retain valid legacy settings without publishing their unsupported text channel.
    if (s.mode === 'scene')
      return {
        mode: 'blank',
        title: '',
        reason:
          'Der frühere Textmodus ist keine passive Karten-/Artanzeige. Automatische Ansicht oder Bild wählen.',
      };
    const frame = readSceneWorld(db, cam, live.scene.id),
      world = readWorld(db, cam),
      position = frame.position;
    if (position.dungeon) {
      const dungeon = dungeonDisplay(db, cam, live.scene.id, s, list);
      return dungeon
        ? {
            mode: 'dungeon',
            title: s.title || 'Dungeon',
            dungeon: {
              position: dungeon.position,
              known: dungeon.known,
              visible: dungeon.visible,
              labels: dungeon.labels,
              markers: dungeon.markers.map(({ point, kind, open }) => ({ point, kind, open })),
              ...(dungeon.tracks
                ? { tracks: dungeon.tracks.map(({ from, to }) => ({ from, to })) }
                : {}),
            },
          }
        : { mode: 'blank', title: '', reason: 'Dungeonposition nicht verfügbar.' };
    }
    if (frame.scene.locationId && !frame.journey?.status.match(/active|paused|interrupted/)) {
      const asset = assets
        .filter((a) => a.kind === 'location' && a.subjectId === frame.scene.locationId)
        .at(-1);
      return asset
        ? { mode: 'image', title: s.title || asset.title, imageId: asset.id }
        : {
            mode: 'blank',
            title: '',
            reason: 'Für diesen Ort ist noch kein freigegebenes Bild hinterlegt.',
          };
    }
    const map = world.maps.find((m) => m.id === position.mapId);
    if (!map) return { mode: 'blank', title: '', reason: 'Keine Reisekarte für diese Gruppe.' };
    const masks = db
        .prepare("SELECT * FROM player_record WHERE campaign_id=? AND kind='mask'")
        .all(cam)
        .map((r: any) => checkedPlayerRecord(db, r))
        .filter((m: any) => m.mapId === map.id),
      maskIndex = new Map<string, any>(masks.map((m: any) => [m.q + ':' + m.r, m]));
    const known = new Map<string, Hex>(),
      memories = new Map<string, RememberedHex>(),
      union = new Map<string, Parameters<typeof unionMemory>[0]>();
    const knownRows = db.prepare(
        'SELECT q,r FROM atlas_knowledge WHERE campaign_id=? AND character_id=? AND map_id=?',
      ),
      memoryRow = db.prepare(
        'SELECT * FROM player_hex_memory WHERE campaign_id=? AND character_id=? AND map_id=? AND q=? AND r=?',
      );
    for (const observer of list)
      for (const h of knownRows.all(cam, observer.characterId, map.id)) {
        const key = h.q + ':' + h.r;
        known.set(key, h);
        const row = memoryRow.get(cam, observer.characterId, map.id, h.q, h.r);
        if (row) {
          try {
            const value = checkedMemory(row);
            if ((value.mapRevision ?? 0) <= map.revision) addMemory(union, key, value);
          } catch {
            /* Keep damaged bytes; this cell has no reliable remembered details. */
          }
        }
      }
    for (const [key, state] of union) {
      const value = unionMemory(state);
      if (value) memories.set(key, value);
    }
    const illumination = light(frame, s, world.calendar.daySeconds),
      visible = new Set<string>(),
      origin = cellAt(map, position);
    for (const observer of list.filter((o) => o.enabled)) {
      const range = Math.min(
          frame.weather?.effects.visibilityMeters ?? observer.rangeMeters,
          illumination === 'darkness'
            ? observer.darkvisionMeters
            : illumination === 'dim'
              ? Math.max(observer.rangeMeters / 2, observer.darkvisionMeters)
              : observer.rangeMeters,
        ),
        radius = Math.min(40, Math.ceil(range / map.hexMeters));
      if (range <= 0) continue;
      for (let q = -radius; q <= radius; q++)
        for (let r = -radius; r <= radius; r++) {
          const h = { q: position.q + q, r: position.r + r },
            d = hexDistance(position, h) * map.hexMeters;
          if (d > range || maskIndex.get(h.q + ':' + h.r)?.hidden) continue;
          const target = cellAt(map, h),
            from = origin.elevationM + observer.eyeHeightMeters,
            to = target.elevationM;
          const line = mapLine(position, h),
            blocked = line.some((p, i) => {
              const m = maskIndex.get(p.q + ':' + p.r);
              return (
                m?.blocksSight ||
                cellAt(map, p).elevationM + (cellAt(map, p).terrain === 'forest' ? 5 : 0) >
                  from + ((to - from) * (i + 1)) / (line.length + 1)
              );
            });
          if (!blocked) visible.add(h.q + ':' + h.r);
        }
    }
    for (const key of visible) {
      const [q, r] = key.split(':').map(Number);
      known.set(key, { q: q!, r: r! });
    }
    const cells = [...known]
      .filter(([key]) => !maskIndex.get(key)?.hidden)
      .map(([key, h]) => {
        const seen = visible.has(key),
          c = seen ? cellAt(map, h) : memories.get(key);
        return {
          ...h,
          terrain: c?.terrain ?? 'unknown',
          ...(c?.elevationM !== undefined ? { elevationM: c.elevationM } : {}),
          road: c?.road ?? null,
          river: c?.river ?? null,
          visible: seen,
          label: s.labels ? (maskIndex.get(key)?.publicLabel ?? '') : '',
        };
      });
    const placements = new Map(world.places.map((p) => [p.locationId, p])),
      availability = new Map<string, boolean>();
    const locationKnowledge = new Map<string, { value: LocationKnowledge; conflict: boolean }>(),
      discoveryRows = db.prepare(
        "SELECT * FROM player_discovery WHERE campaign_id=? AND character_id=? AND kind='location'",
      ),
      locationExists = db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?');
    for (const observer of list)
      for (const row of discoveryRows.all(cam, observer.characterId)) {
        try {
          const value = checkedDiscovery(row, s.revision);
          let exists = availability.get(row.subject_id);
          if (exists === undefined) {
            exists = !!locationExists.get(cam, row.subject_id);
            availability.set(row.subject_id, exists);
          }
          if (!exists) continue;
          const old = locationKnowledge.get(row.subject_id),
            revision = value.confirmationRevision ?? 0;
          if (!old || revision > (old.value.confirmationRevision ?? 0))
            locationKnowledge.set(row.subject_id, { value, conflict: false });
          else if (
            revision === (old.value.confirmationRevision ?? 0) &&
            discoveryFacts(value) !== discoveryFacts(old.value)
          )
            old.conflict = true;
        } catch {
          /* Preserve unavailable knowledge; never infer its missing position from GM state. */
        }
      }
    const markers: NonNullable<PlayerFrame['map']>['markers'] = [];
    for (const [id, state] of locationKnowledge) {
      if (state.conflict) continue;
      const k = state.value,
        current = placements.get(id),
        seen =
          current &&
          current.mapId === map.id &&
          !current.trashed &&
          visible.has(current.q + ':' + current.r) &&
          !maskIndex.get(current.q + ':' + current.r)?.hidden;
      const point = seen ? current : k.position;
      if (
        !point ||
        point.mapId !== map.id ||
        !known.has(point.q + ':' + point.r) ||
        maskIndex.get(point.q + ':' + point.r)?.hidden
      )
        continue;
      markers.push({
        q: point.q,
        r: point.r,
        label: s.labels ? k.publicLabel : '',
        visible: !!seen,
      });
    }
    return {
      mode: 'map',
      title: s.title || 'Reisekarte',
      map: { hexMeters: map.hexMeters, position: { q: position.q, r: position.r }, cells, markers },
    } as PlayerFrame;
  })();
}
export function playerView(db: any, cam: string, query?: PlayerMapQuery): PlayerView {
  const { live, list } = playerObservers(db, cam),
    world = readWorld(db, cam);
  const masks = new Map<string, Extract<PlayerAction, { kind: 'mask' }>>(
      db
        .prepare("SELECT * FROM player_record WHERE campaign_id=? AND kind='mask'")
        .all(cam)
        .map((row: any) => {
          const m = checkedPlayerRecord(db, row);
          return [m.mapId + ':' + m.q + ',' + m.r, m] as const;
        }),
    ),
    known = new Set<string>();
  const knowledge = db.prepare(
    'SELECT map_id,q,r FROM atlas_knowledge WHERE campaign_id=? AND character_id=?',
  );
  for (const observer of list)
    for (const h of knowledge.all(cam, observer.characterId))
      known.add(h.map_id + ':' + h.q + ',' + h.r);
  if (
    query &&
    (!world.maps.some((m) => m.id === query.mapId) ||
      ![query.q, query.r].every((n) => Number.isSafeInteger(n) && Math.abs(n) <= 1e9) ||
      typeof query.search !== 'string' ||
      query.search.length > 1000)
  )
    throw new Error('Kartenausschnitt oder Suche prüfen.');
  const position = live.scene ? scenePosition(db, cam, live.scene.id) : null;
  const maps = world.maps.map((m) => {
    const center =
        query?.mapId === m.id
          ? { q: query.q, r: query.r }
          : position?.mapId === m.id
            ? { q: position.q, r: position.r }
            : { q: 0, r: 0 },
      cells = new Map<string, PlayerMapCell>();
    const add = (h: Hex, name = '') => {
      if (![h.q, h.r].every((n) => Number.isSafeInteger(n) && Math.abs(n) <= 1e9)) return;
      const key = m.id + ':' + h.q + ',' + h.r,
        mask = masks.get(key),
        c = cellAt(m, h);
      cells.set(h.q + ',' + h.r, {
        q: h.q,
        r: h.r,
        terrain: c.terrain,
        name: name || c.label,
        publicLabel: mask?.publicLabel ?? '',
        hidden: mask?.hidden ?? false,
        blocksSight: mask?.blocksSight ?? false,
        known: known.has(key),
      });
    };
    for (let dq = -4; dq <= 4; dq++)
      for (let dr = -4; dr <= 4; dr++) {
        const h = { q: center.q + dq, r: center.r + dr },
          p = hexPoint(h, m.hexMeters),
          key = m.id + ':' + h.q + ',' + h.r;
        if (
          hexDistance(h, center) <= 4 &&
          (authoredCellAt(m, h) ||
            known.has(key) ||
            masks.has(key) ||
            ((m.landscape ?? []).some((l) => l.kind === 'patch' && contains(p, l.polygons)) &&
              (cellAt(m, h).label || cellAt(m, h).terrain !== 'water')))
        )
          add(h);
      }
    const term = query?.mapId === m.id ? query.search.trim().toLocaleLowerCase() : '';
    if (term) {
      let matches = 0;
      const candidate = (h: Hex, name: string) => {
        if (matches >= 20 || !name.toLocaleLowerCase().includes(term)) return;
        add(h, name);
        matches++;
      };
      for (const c of m.cells) if (c.level === 0) candidate(c, c.label);
      for (const l of m.landscape ?? []) {
        const name = l.values.label || (l.kind === 'place' ? l.name : '');
        if (!name || !name.toLocaleLowerCase().includes(term)) continue;
        const ring = l.polygons[0]?.outer,
          p =
            l.points[0] ??
            (ring?.length
              ? {
                  x: ring.reduce((n, p) => n + p.x, 0) / ring.length,
                  y: ring.reduce((n, p) => n + p.y, 0) / ring.length,
                }
              : null);
        if (p) candidate(pointHex(p.x, p.y, m.hexMeters), name);
      }
      for (const p of world.places) if (p.mapId === m.id && !p.trashed) candidate(p, p.name);
      const coordinate = term.match(/^(-?\d+)\s*,\s*(-?\d+)$/);
      if (coordinate) add({ q: Number(coordinate[1]), r: Number(coordinate[2]) });
    }
    return { id: m.id, name: m.name, center, cells: [...cells.values()] };
  });
  return {
    settings: playerSettings(db, cam),
    focusId: live.focusId,
    focusRevision: live.focusRevision,
    focusMembershipRevision: live.scene?.membershipRevision ?? null,
    focusLocationId: live.scene?.locationId ?? null,
    focusTitle: live.scene?.title ?? null,
    observers: list,
    assets: playerAssets(db, cam),
    maps,
    locations: db
      .prepare('SELECT id,payload FROM location WHERE campaign_id=? AND trashed=0')
      .all(cam)
      .map((r: any) => ({ id: r.id, name: JSON.parse(r.payload).name })),
    npcs: db
      .prepare('SELECT id,payload FROM world_note WHERE campaign_id=? AND trashed=0')
      .all(cam)
      .filter((r: any) => JSON.parse(r.payload).kind === 'npc')
      .map((r: any) => ({ id: r.id, name: JSON.parse(r.payload).title })),
    frame: projectPlayer(db, cam),
  };
}
function validatePlayerAsset(a: PlayerAsset) {
  if (
    !a.id ||
    !['location', 'npc', 'custom'].includes(a.kind) ||
    !/^[a-f0-9]{64}$/.test(a.sha256) ||
    a.extension !== '.png' ||
    !Number.isSafeInteger(a.bytes) ||
    a.bytes < 1 ||
    typeof a.title !== 'string' ||
    a.title.length > 1000
  )
    throw new Error('Bildbeschreibung prüfen.');
}
function checkedPlayerAsset(row: any) {
  const a = parsed<PlayerAsset>(row);
  validatePlayerAsset(a);
  if (a.id !== row.id || a.kind !== row.kind || a.subjectId !== row.subject_id)
    throw new Error('Spielerbildidentität widersprüchlich.');
  return a;
}
function checkImageOwner(db: any, cam: string, a: PlayerAsset, active = false) {
  if (!nullableIdentity(a.subjectId)) throw new Error('Bildziel prüfen.');
  if (a.kind === 'custom') return;
  const table = a.kind === 'location' ? 'location' : 'world_note';
  if (
    !a.subjectId ||
    !db
      .prepare(
        `SELECT 1 FROM ${table} WHERE campaign_id=? AND id=?${a.kind === 'npc' ? " AND json_extract(payload,'$.kind')='npc'" : ''}${active ? ' AND trashed=0' : ''}`,
      )
      .get(cam, a.subjectId)
  )
    throw new Error('Bildziel fehlt.');
}
export function savePlayerAsset(db: any, cam: string, a: PlayerAsset) {
  validatePlayerAsset(a);
  checkImageOwner(db, cam, a, true);
  const payload = JSON.stringify(a);
  db.prepare('INSERT INTO player_asset VALUES(?,?,?,?,?,?)').run(
    cam,
    a.id,
    a.kind,
    a.subjectId,
    payload,
    hash(payload),
  );
}
export function setPlayerWindow(db: any, cam: string, open: boolean) {
  const s = { ...playerSettings(db, cam), windowOpen: open };
  validateSettings(s);
  saveRecord(db, cam, 'settings', 'main', s);
}
export function executePlayer(db: any, c: PlayerCommand, guard: () => void) {
  return db
    .transaction(() => {
      guard();
      if (!['settings', 'observer', 'mask', 'discover', 'forget', 'blank'].includes(c.action?.kind))
        throw new Error('Unbekannte Spieleranzeigeaktion.');
      const s = playerSettings(db, c.campaignId),
        fp = hash(JSON.stringify({ ...c, token: undefined })),
        receipt = db
          .prepare('SELECT fingerprint FROM player_receipt WHERE command_id=?')
          .get(c.commandId);
      if (receipt) {
        if (receipt.fingerprint !== fp)
          throw new Error('Anzeigeänderungskennung anders verwendet.');
        return playerView(db, c.campaignId);
      }
      if (c.action.kind !== 'blank' && c.expectedRevision !== s.revision)
        throw new Error('Anzeige geändert. Aktualisiere die Steuerung.');
      const a = c.action;
      // A queued GM intent must never acquire the authority of a later focused group, including A-B-A switches.
      if (a.kind !== 'blank') {
        const live = readLive(db, c.campaignId);
        if (
          c.expectedFocusId !== live.focusId ||
          c.expectedFocusRevision !== live.focusRevision ||
          c.expectedFocusMembershipRevision !== (live.scene?.membershipRevision ?? null) ||
          c.expectedFocusLocationId !== (live.scene?.locationId ?? null)
        )
          throw new Error(
            'Fokussierte Gruppe geändert. Aktualisiere die Spielersteuerung und prüfe die Freigabe erneut.',
          );
      }
      if (a.kind === 'blank') {
        saveRecord(db, c.campaignId, 'settings', 'main', { ...s, blank: true });
      } else if (a.kind === 'settings') {
        if (!['follow', 'image'].includes(a.settings?.mode))
          throw new Error('Die passive Anzeige erlaubt Karten und Art, keinen Textmodus.');
        const n = { ...s, ...a.settings },
          live = readLive(db, c.campaignId);
        validateSettings(n);
        const image =
          n.mode === 'image' && !n.blank
            ? playerAssets(db, c.campaignId).find((x) => x.id === n.imageId)
            : undefined;
        if (n.mode === 'image' && !n.blank && !image) throw new Error('Bildauswahl fehlt.');
        if (image?.kind === 'npc') checkImageOwner(db, c.campaignId, image, true);
        n.boundSceneId = n.mode === 'follow' ? null : live.focusId;
        saveRecord(db, c.campaignId, 'settings', 'main', n);
      } else if (a.kind === 'observer') {
        const o = a.observer;
        validateObserver(o);
        if (!readLive(db, c.campaignId).roster.some((x) => x.id === o.characterId))
          throw new Error('Charakter fehlt.');
        saveRecord(db, c.campaignId, 'observer', o.characterId, o);
        saveRecord(db, c.campaignId, 'settings', 'main', s);
      } else {
        const world = readWorld(db, c.campaignId),
          currentMap = world.maps.find((m) => m.id === a.mapId);
        if (!currentMap) throw new Error('Karte fehlt.');
        if (a.kind === 'mask') {
          validateMask(a);
          const old = db
            .prepare(
              "SELECT id FROM player_record WHERE campaign_id=? AND kind='mask' AND json_extract(payload,'$.mapId')=? AND json_extract(payload,'$.q')=? AND json_extract(payload,'$.r')=?",
            )
            .get(c.campaignId, a.mapId, a.q, a.r);
          saveRecord(db, c.campaignId, 'mask', old?.id ?? randomUUID(), a);
        } else {
          validateCell(a);
          if (
            !Array.isArray(a.characterIds) ||
            !a.characterIds.length ||
            new Set(a.characterIds).size !== a.characterIds.length
          )
            throw new Error('Eindeutige Charaktere auswählen.');
          const roster = new Set(readLive(db, c.campaignId).roster.map((member) => member.id));
          let discoveredPayload: string | null = null;
          if (a.locationId) {
            const location = db
              .prepare('SELECT trashed FROM location WHERE campaign_id=? AND id=?')
              .get(c.campaignId, a.locationId);
            if (!location) throw new Error('Ort fehlt.');
            if (a.kind === 'discover') {
              if (location.trashed) throw new Error('Ort ist im Papierkorb.');
              const place = world.places.find((p) => p.locationId === a.locationId);
              if (place && (place.mapId !== a.mapId || place.q !== a.q || place.r !== a.r))
                throw new Error('Ortsposition geändert oder passt nicht zum bestätigten Hex.');
              discoveredPayload = JSON.stringify({
                publicLabel: a.publicLabel,
                position: place
                  ? { mapId: place.mapId, q: place.q, r: place.r, revision: place.revision }
                  : null,
                confirmationRevision: s.revision + 1,
              });
            }
          }
          if (a.kind === 'discover' && !a.locationId) {
            const old = db
              .prepare(
                "SELECT * FROM player_record WHERE campaign_id=? AND kind='mask' AND json_extract(payload,'$.mapId')=? AND json_extract(payload,'$.q')=? AND json_extract(payload,'$.r')=?",
              )
              .get(c.campaignId, a.mapId, a.q, a.r);
            const mask = old
              ? checkedPlayerRecord(db, old)
              : { kind: 'mask', mapId: a.mapId, q: a.q, r: a.r, hidden: false, blocksSight: false };
            saveRecord(db, c.campaignId, 'mask', old?.id ?? randomUUID(), {
              ...mask,
              publicLabel: a.publicLabel,
            });
          }
          const oldDiscovery = db.prepare(
            "SELECT * FROM player_discovery WHERE campaign_id=? AND character_id=? AND kind='location' AND subject_id=?",
          );
          for (const id of a.characterIds) {
            if (!roster.has(id)) throw new Error('Charakter fehlt.');
            if (a.kind === 'discover') {
              if (a.locationId) {
                const old = oldDiscovery.get(c.campaignId, id, a.locationId);
                if (old) checkedDiscovery(old, s.revision);
              }
              rememberAtlasHex(db, c.campaignId, id, currentMap, a);
            } else {
              db.prepare(
                'DELETE FROM atlas_knowledge WHERE campaign_id=? AND character_id=? AND map_id=? AND q=? AND r=?',
              ).run(c.campaignId, id, a.mapId, a.q, a.r);
              db.prepare(
                'DELETE FROM player_hex_memory WHERE campaign_id=? AND character_id=? AND map_id=? AND q=? AND r=?',
              ).run(c.campaignId, id, a.mapId, a.q, a.r);
            }
            if (a.locationId) {
              if (a.kind === 'discover')
                db.prepare(
                  "INSERT INTO player_discovery VALUES(?,?,?,'location',?,?,?) ON CONFLICT(campaign_id,character_id,kind,subject_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum",
                ).run(
                  c.campaignId,
                  id,
                  randomUUID(),
                  a.locationId,
                  discoveredPayload,
                  hash(discoveredPayload!),
                );
              else
                db.prepare(
                  "DELETE FROM player_discovery WHERE campaign_id=? AND character_id=? AND kind='location' AND subject_id=?",
                ).run(c.campaignId, id, a.locationId);
            }
          }
        }
        saveRecord(db, c.campaignId, 'settings', 'main', s);
      }
      db.prepare('INSERT INTO player_receipt VALUES(?,?,?)').run(c.campaignId, c.commandId, fp);
      return playerView(db, c.campaignId);
    })
    .immediate();
}
export function validatePlayer(db: any) {
  validateAtlasMemory(db);
  validateDiscoveries(db);
  for (const r of db.prepare('SELECT * FROM player_asset').iterate()) {
    const a = checkedPlayerAsset(r);
    checkImageOwner(db, r.campaign_id, a);
  }
  for (const r of db.prepare('SELECT * FROM player_record').iterate()) checkedPlayerRecord(db, r);
}
