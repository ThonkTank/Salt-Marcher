import { createHash, randomUUID } from 'node:crypto';
import { worldNoteDocument } from '../../features/world/world-notes';
import { checkedLocationDocument } from '../../features/location/location-schema';
import type {
  WorldSource,
  WorldSources,
  EncounterTable,
  GenerationRequest,
} from '../campaign/generation-contracts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installWorldSources(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS world_source(campaign_id TEXT NOT NULL REFERENCES campaign(id),kind TEXT NOT NULL CHECK(kind IN ('faction','location')),id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,kind,id)) STRICT;`,
  );
}
function checkedSource(value: unknown): WorldSource {
  const s = value as WorldSource,
    id = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 1000,
    ids = (v: unknown) =>
      Array.isArray(v) && v.length <= 1000 && v.every(id) && new Set(v).size === v.length;
  if (
    !s ||
    typeof s !== 'object' ||
    Array.isArray(s) ||
    !['faction', 'location'].includes(s.kind) ||
    !id(s.id) ||
    !Number.isSafeInteger(s.revision) ||
    s.revision < 0 ||
    !ids(s.tableIds) ||
    !ids(s.factionIds) ||
    !Array.isArray(s.stock) ||
    s.stock.length > 1000 ||
    s.stock.some(
      (e) =>
        !e ||
        typeof e !== 'object' ||
        Array.isArray(e) ||
        !id(e.creatureId) ||
        !Number.isSafeInteger(e.limit) ||
        e.limit < 0 ||
        e.limit > 1000000,
    ) ||
    new Set(s.stock.map((e) => e.creatureId)).size !== s.stock.length ||
    (s.kind === 'faction' && (s.tableIds.length > 1 || s.factionIds.length > 0)) ||
    (s.kind === 'location' && s.stock.length > 0)
  )
    throw new Error('Weltquelle benötigt eindeutige Verknüpfungen und gültige Bestände.');
  if (
    s.disposition !== undefined &&
    (!Number.isSafeInteger(s.disposition) || s.disposition < -100 || s.disposition > 100)
  )
    throw new Error('Fraktionshaltung benötigt eine ganze Zahl zwischen -100 und 100.');
  return s;
}
function sourceRow(row: any): WorldSource {
  if (!row || typeof row.payload !== 'string' || hash(row.payload) !== row.checksum)
    throw new Error('Weltquelle beschädigt.');
  const s = checkedSource(JSON.parse(row.payload));
  if (s.id !== row.id || s.kind !== row.kind || s.revision !== row.revision || s.revision < 1)
    throw new Error('Weltquelle besitzt eine widersprüchliche Identität oder Revision.');
  return s;
}
function sourceDocument(row: any, kind: 'note' | 'location') {
  if (!row || typeof row.payload !== 'string' || hash(row.payload) !== row.checksum)
    throw new Error('Weltquellenziel fehlt oder ist beschädigt.');
  const doc =
    kind === 'note'
      ? worldNoteDocument(JSON.parse(row.payload))
      : checkedLocationDocument(JSON.parse(row.payload));
  if (
    doc.id !== row.id ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    ('revision' in doc && doc.revision !== row.revision)
  )
    throw new Error('Weltquellenziel hat eine widersprüchliche Identität oder Revision.');
  return doc;
}
function sourceReferences(db: any, cam: string, s: WorldSource) {
  const faction = (id: string) => {
    const doc = sourceDocument(
      db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam, id),
      'note',
    );
    if (doc.kind !== 'faction') throw new Error('Weltquelle verweist auf keine Fraktion.');
  };
  if (s.kind === 'faction') faction(s.id);
  else
    sourceDocument(
      db.prepare('SELECT * FROM location WHERE campaign_id=? AND id=?').get(cam, s.id),
      'location',
    );
  for (const id of s.factionIds) faction(id);
  let allowed = new Set<string>();
  for (const id of s.tableIds) {
    const row = db
      .prepare(
        'SELECT * FROM encounter_table WHERE id=? AND (campaign_id IS NULL OR campaign_id=?)',
      )
      .get(id, cam);
    if (!row || hash(row.payload) !== row.checksum)
      throw new Error('Encounter-Quelle fehlt oder ist beschädigt.');
    if (s.kind === 'faction')
      allowed = new Set(JSON.parse(row.payload).entries.map((e: any) => e.creatureId));
  }
  if (s.stock.some((e) => !allowed.has(e.creatureId)))
    throw new Error('Fraktionsbestand enthält Kreaturen außerhalb seiner Haupttabelle.');
}
function records(db: any, cam: string): WorldSource[] {
  return db
    .prepare('SELECT * FROM world_source WHERE campaign_id=? ORDER BY kind,id')
    .all(cam)
    .map((row: any) => {
      const s = sourceRow(row);
      sourceReferences(db, cam, s);
      return s;
    });
}
export function validateWorldSources(db: any) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='world_source'").get()) {
    if (db.pragma('user_version', { simple: true }) >= 42)
      throw new Error('Weltquellenspeicher fehlt.');
    return;
  }
  for (const row of db.prepare('SELECT * FROM world_source').iterate()) {
    const s = sourceRow(row);
    sourceReferences(db, row.campaign_id, s);
  }
}
export function readWorldSources(db: any, cam: string): WorldSources {
  const factions: WorldSources['factions'] = [],
    locations: WorldSources['locations'] = [];
  for (const row of db
    .prepare('SELECT * FROM world_note WHERE campaign_id=? AND trashed=0')
    .iterate(cam)) {
    const doc = sourceDocument(row, 'note');
    if (doc.kind === 'faction') factions.push({ id: doc.id, name: doc.title });
  }
  for (const row of db
    .prepare('SELECT * FROM location WHERE campaign_id=? AND trashed=0')
    .iterate(cam)) {
    const doc = sourceDocument(row, 'location');
    if (doc.kind === 'location') locations.push({ id: doc.id, name: doc.name });
  }
  const order = (a: { id: string; name: string }, b: { id: string; name: string }) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  return {
    sources: records(db, cam),
    factions: factions.sort(order),
    locations: locations.sort(order),
  };
}
function put(db: any, cam: string, s: WorldSource) {
  checkedSource(s);
  if (s.revision < 1) throw new Error('Ungültige Weltquellenrevision.');
  const p = JSON.stringify(s);
  db.prepare(
    'INSERT INTO world_source VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,kind,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, s.kind, s.id, s.revision, p, hash(p));
}
export function saveWorldSource(
  db: any,
  cam: string,
  input: WorldSource,
  expected: number | null,
  tables: EncounterTable[],
) {
  const s = structuredClone(checkedSource(input)),
    view = readWorldSources(db, cam),
    old = view.sources.find((x) => x.kind === s.kind && x.id === s.id);
  if (s.revision !== (old?.revision ?? 0) || (old?.revision ?? null) !== expected)
    throw new Error('Weltquelle geändert. Gespeicherten Stand neu öffnen.');
  if (!(s.kind === 'faction' ? view.factions : view.locations).some((x) => x.id === s.id))
    throw new Error('Ziel der Weltquelle fehlt oder liegt im Papierkorb.');
  for (const id of s.tableIds)
    if (!tables.some((t) => t.id === id && (!t.trashed || old?.tableIds.includes(id))))
      throw new Error('Quelltabelle fehlt oder liegt im Papierkorb.');
  for (const id of s.factionIds)
    if (!view.factions.some((f) => f.id === id) && !old?.factionIds.includes(id))
      throw new Error('Verknüpfte Fraktion fehlt.');
  const allowed = new Set(
    tables.find((t) => t.id === s.tableIds[0])?.entries.map((e) => e.creatureId) ?? [],
  );
  for (const e of s.stock)
    if (
      !allowed.has(e.creatureId) ||
      !Number.isSafeInteger(e.limit) ||
      e.limit < 0 ||
      e.limit > 1000000
    )
      throw new Error(
        'Bestand benötigt eine ganze Anzahl 0–1000000 aus der Haupttabelle. Leer bedeutet unbegrenzt.',
      );
  sourceReferences(db, cam, s);
  s.revision = (old?.revision ?? 0) + 1;
  put(db, cam, s);
  const name = (s.kind === 'faction' ? view.factions : view.locations).find(
      (x) => x.id === s.id,
    )!.name,
    payload = JSON.stringify({
      text:
        (s.kind === 'faction'
          ? 'Fraktionsquelle und Bestand aktualisiert: '
          : 'Ortsquellen aktualisiert: ') + name,
      recordedAt: new Date().toISOString(),
      facts: { before: old ?? null, after: s },
    });
  db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)').run(
    cam,
    randomUUID(),
    null,
    payload,
    hash(payload),
  );
}
/** Table membership owns eligible stock; prune removed entries in the same transaction. */
export function pruneWorldStock(db: any, cam: string, table: EncounterTable) {
  const allowed = new Set(table.entries.map((e) => e.creatureId));
  // The table owner is already checked by table-save. Decode only that domain;
  // installation tables still require all dependent campaigns in the transaction.
  const rows =
    table.scope === 'installation'
      ? db.prepare("SELECT * FROM world_source WHERE kind='faction'").all()
      : db.prepare("SELECT * FROM world_source WHERE campaign_id=? AND kind='faction'").all(cam);
  for (const row of rows) {
    const s = sourceRow(row);
    if (!s.tableIds.includes(table.id)) continue;
    const stock = s.stock.filter((e) => allowed.has(e.creatureId));
    if (stock.length !== s.stock.length)
      put(db, row.campaign_id, { ...s, revision: s.revision + 1, stock });
  }
}
export function resolveWorldSources(
  db: any,
  cam: string,
  r: Pick<GenerationRequest, 'factionIds' | 'locationId' | 'tableIds'>,
  tables: EncounterTable[],
) {
  const factionIds = r.factionIds ?? [],
    locationId = r.locationId ?? null;
  if (
    !Array.isArray(factionIds) ||
    factionIds.length > 1000 ||
    new Set(factionIds).size !== factionIds.length ||
    (locationId !== null && typeof locationId !== 'string')
  )
    throw new Error('Ungültige Weltfilter.');
  if (!factionIds.length && !locationId)
    return { tableIds: r.tableIds, caps: new Map<string, number>(), basis: null, snapshot: null };
  const view = readWorldSources(db, cam);
  for (const id of factionIds)
    if (!view.factions.some((f) => f.id === id))
      throw new Error('Gewählte Fraktion nicht verfügbar.');
  if (locationId && !view.locations.some((l) => l.id === locationId))
    throw new Error('Gewählter Ort nicht verfügbar.');
  const source = (kind: WorldSource['kind'], id: string) =>
    view.sources.find((s) => s.kind === kind && s.id === id) ?? {
      kind,
      id,
      revision: 0,
      tableIds: [],
      factionIds: [],
      stock: [],
    };
  const factionTables = (ids: string[]) => ids.flatMap((id) => source('faction', id).tableIds);
  const location = locationId ? source('location', locationId) : null,
    linked = location?.factionIds.filter((id) => view.factions.some((f) => f.id === id)) ?? [];
  let ids = tables.filter((t) => !t.trashed).map((t) => t.id);
  for (const dimension of [
    r.tableIds.length ? r.tableIds : null,
    factionIds.length ? factionTables(factionIds) : null,
    location ? [...location.tableIds, ...factionTables(linked)] : null,
  ])
    if (dimension) ids = ids.filter((id) => dimension.includes(id));
  // Every explicitly selected faction is binding. A union can retain A while
  // filters remove B entirely; reject that partial input before generating work.
  for (const id of factionIds) {
    const faction = source('faction', id);
    const available = faction.tableIds.some(
      (tid) =>
        ids.includes(tid) &&
        tables
          .find((t) => t.id === tid)
          ?.entries.some(
            (e) =>
              e.weight !== '0' &&
              (faction.stock.find((stock) => stock.creatureId === e.creatureId)?.limit ??
                Infinity) > 0,
          ),
    );
    if (!available)
      throw new Error(
        'Gewählte Fraktion ' +
          view.factions.find((f) => f.id === id)!.name +
          ' hat keine verfügbare Encounter-Tabelle mit positivem Bestand für diese Weltfilter.',
      );
  }
  if (!ids.length)
    throw new Error(
      'Keine gemeinsame Encounter-Tabelle für diese Weltfilter. Verknüpfe zuerst die gewünschten Quellen.',
    );
  const capacity = (creatureId: string, owners: string[], direct: string[]) => {
    if (
      direct.some(
        (id) =>
          ids.includes(id) &&
          tables.find((t) => t.id === id)?.entries.some((e) => e.creatureId === creatureId),
      )
    )
      return Infinity;
    let total = 0;
    for (const id of owners) {
      const f = source('faction', id);
      if (
        !f.tableIds.some(
          (tid) =>
            ids.includes(tid) &&
            tables.find((t) => t.id === tid)?.entries.some((e) => e.creatureId === creatureId),
        )
      )
        continue;
      total += f.stock.find((e) => e.creatureId === creatureId)?.limit ?? Infinity;
    }
    return total;
  };
  const caps = new Map<string, number>();
  for (const creatureId of new Set(
    tables.filter((t) => ids.includes(t.id)).flatMap((t) => t.entries.map((e) => e.creatureId)),
  )) {
    const cap = Math.min(
      factionIds.length ? capacity(creatureId, factionIds, []) : Infinity,
      location ? capacity(creatureId, linked, location.tableIds) : Infinity,
    );
    if (Number.isFinite(cap)) caps.set(creatureId, cap);
  }
  const involved = [...new Set([...factionIds, ...linked])]
    .sort()
    .map((id) => source('faction', id));
  return {
    tableIds: ids,
    caps,
    snapshot: {
      location,
      involved,
      tableIds: ids,
      caps: [...caps].map(([creatureId, limit]) => ({ creatureId, limit })),
    },
    basis: hash(JSON.stringify({ location, involved, tableIds: ids, caps: [...caps] })),
  };
}

export function canonicalSourceSnapshot(
  snapshot: import('../campaign/generation-contracts').WorldSourceSnapshot | null,
) {
  if (snapshot === null) return null;
  const id = (v: unknown) => typeof v === 'string' && !!v && v.length <= 1000;
  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    Array.isArray(snapshot) ||
    !Array.isArray(snapshot.involved) ||
    !Array.isArray(snapshot.tableIds) ||
    snapshot.tableIds.some((v) => !id(v)) ||
    new Set(snapshot.tableIds).size !== snapshot.tableIds.length ||
    !Array.isArray(snapshot.caps) ||
    snapshot.caps.some(
      (c) =>
        !c ||
        typeof c !== 'object' ||
        !id(c.creatureId) ||
        !Number.isSafeInteger(c.limit) ||
        c.limit < 0,
    ) ||
    new Set(snapshot.caps.map((c) => c.creatureId)).size !== snapshot.caps.length
  )
    throw new Error('Weltquellenbasis der Vorschau beschädigt.');
  if (
    (snapshot.location !== null && checkedSource(snapshot.location).kind !== 'location') ||
    snapshot.involved.some((s) => checkedSource(s).kind !== 'faction') ||
    new Set(snapshot.involved.map((s) => s.id)).size !== snapshot.involved.length
  )
    throw new Error('Weltquellenbasis der Vorschau widersprüchlich.');
  const source = (s: WorldSource) => ({
    ...s,
    tableIds: s.tableIds.slice().sort(),
    factionIds: s.factionIds.slice().sort(),
    stock: s.stock.slice().sort((a, b) => a.creatureId.localeCompare(b.creatureId)),
  });
  return {
    location: snapshot.location ? source(snapshot.location) : null,
    involved: snapshot.involved.map(source).sort((a, b) => a.id.localeCompare(b.id)),
    tableIds: snapshot.tableIds.slice().sort(),
    caps: snapshot.caps.slice().sort((a, b) => a.creatureId.localeCompare(b.creatureId)),
  };
}
