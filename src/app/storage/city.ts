import { validateTerrainBuilding } from '../atlas/terrain-objects';
import { validateMapLabelStyle } from '../atlas/map-label-style';
import { createHash } from 'node:crypto';
import type {
  CityHeader,
  CityUnit,
  CityView,
  CityCommand,
  CityOverview,
  CityBuildingQuery,
  CityBuildingChoices,
} from '../atlas/city-contracts';
import { npcRecord } from './npc-record';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installCitySchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS city_document(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,location_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,location_id) REFERENCES location(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS city_unit(campaign_id TEXT NOT NULL,city_id TEXT NOT NULL,id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,city_id) REFERENCES city_document(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS city_history(campaign_id TEXT NOT NULL,city_id TEXT NOT NULL,id TEXT NOT NULL,command_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,city_id) REFERENCES city_document(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS city_receipt(campaign_id TEXT NOT NULL REFERENCES campaign(id),command_id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL) STRICT;`);
}
function parsed(row: any) {
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error('Stadtdaten fehlen oder sind beschädigt.');
  return JSON.parse(row.payload);
}
function checkedHeader(h: CityHeader) {
  if (
    !h ||
    !h.id ||
    !h.locationId ||
    !h.name.trim() ||
    h.name.length > 1000 ||
    !Number.isSafeInteger(h.revision) ||
    h.width < 20 ||
    h.width > 10000 ||
    h.height < 20 ||
    h.height > 10000 ||
    !Number.isFinite(h.width + h.height) ||
    !/^#[a-f0-9]{6}$/i.test(h.paper) ||
    !/^#[a-f0-9]{6}$/i.test(h.roof)
  )
    throw new Error('Stadtname, Ort, Maße oder Farben prüfen.');
}
export function checkedUnit(u: CityUnit) {
  validateTerrainBuilding(u?.terrain);
  if (u?.terrain && u.kind !== 'building')
    throw Error('Höhenbindung ist nur für Häuser verfügbar.');
  validateMapLabelStyle(u?.label);
  if (
    !u ||
    !u.id ||
    !['node', 'road', 'district', 'plaza', 'water', 'wall', 'building'].includes(u.kind) ||
    typeof u.name !== 'string' ||
    typeof u.protected !== 'boolean' ||
    u.name.length > 1000
  )
    throw new Error('Stadtelement prüfen.');
  if (
    (u.factionId !== undefined &&
      u.factionId !== null &&
      (typeof u.factionId !== 'string' || !u.factionId || u.factionId.length > 1000)) ||
    (u.factionId && (!['building', 'district'].includes(u.kind) || !u.protected))
  )
    throw new Error('Fraktionsbindung ist nur an geschützten Häusern und Vierteln möglich.');
  const people = (ids: unknown) => {
    if (
      !Array.isArray(ids) ||
      ids.length > 200 ||
      ids.some((id) => typeof id !== 'string' || !id || id.length > 1000) ||
      new Set(ids).size !== ids.length
    )
      throw new Error('Personenbindung prüfen (höchstens 200 je Haus oder Eintrag).');
  };
  if (u.kind === 'building') {
    people(u.residentIds ?? []);
    people(u.workerIds ?? []);
    if (!Array.isArray(u.households ?? []) || (u.households ?? []).length > 100)
      throw new Error('Höchstens 100 Haushalte je Haus.');
    if (!Array.isArray(u.jobs ?? []) || (u.jobs ?? []).length > 100)
      throw new Error('Höchstens 100 Berufe je Haus.');
    if (
      !u.protected &&
      ((u.residentIds ?? []).length ||
        (u.workerIds ?? []).length ||
        (u.households ?? []).length ||
        (u.jobs ?? []).length)
    )
      throw new Error(
        'Haus mit Personen-, Haushalts- oder Berufsbindung muss vor Regeneration geschützt bleiben.',
      );
    const householdIds = new Set<string>(),
      residents = new Set(u.residentIds ?? []);
    for (const h of u.households ?? []) {
      people(h?.memberIds);
      if (
        !h ||
        typeof h.id !== 'string' ||
        !h.id ||
        h.id.length > 1000 ||
        householdIds.has(h.id) ||
        typeof h.name !== 'string' ||
        !h.name.trim() ||
        h.name.length > 1000 ||
        h.memberIds.some((id) => !residents.has(id))
      )
        throw new Error(
          'Haushalt benötigt eine eindeutige Kennung, einen Namen und Bewohner dieses Hauses.',
        );
      householdIds.add(h.id);
    }
    const jobIds = new Set<string>(),
      workers = new Set(u.workerIds ?? []);
    for (const j of u.jobs ?? []) {
      people(j?.workerIds);
      if (
        !j ||
        typeof j.id !== 'string' ||
        !j.id ||
        j.id.length > 1000 ||
        jobIds.has(j.id) ||
        typeof j.name !== 'string' ||
        !j.name.trim() ||
        j.name.length > 1000 ||
        j.workerIds.some((id) => !workers.has(id))
      )
        throw new Error(
          'Beruf benötigt eine eindeutige Kennung, einen Namen und Beschäftigte dieses Hauses.',
        );
      jobIds.add(j.id);
    }
  } else if (
    u.residentIds !== undefined ||
    u.workerIds !== undefined ||
    u.households !== undefined ||
    u.jobs !== undefined
  )
    throw new Error('Nur Häuser dürfen Bewohner, Arbeitsplätze, Haushalte oder Berufe binden.');
  const point = (p: any) => {
    if (!p || !Number.isFinite(p.x + p.y) || Math.abs(p.x) > 100000 || Math.abs(p.y) > 100000)
      throw new Error('Meterkoordinate prüfen.');
  };
  if (u.kind === 'node') point(u.point);
  else if (u.kind === 'road' || u.kind === 'wall') {
    if (!u.nodeIds || u.nodeIds.length !== 2 || !u.width || u.width < 1 || u.width > 200)
      throw new Error('Straßenenden oder Breite fehlen.');
    for (const p of u.via ?? []) point(p);
  } else {
    if (!u.outline || u.outline.length < 3 || u.outline.length > 1000)
      throw new Error('Eine Fläche benötigt mindestens drei Eckpunkte.');
    for (const p of u.outline) point(p);
    let area = 0;
    for (let i = 0; i < u.outline.length; i++) {
      const p = u.outline[i]!,
        q = u.outline[(i + 1) % u.outline.length]!;
      area += p.x * q.y - q.x * p.y;
    }
    if (Math.abs(area) < 0.01) throw new Error('Fläche ist leer.');
    if (u.kind === 'building') {
      point(u.position);
      if (!Number.isFinite(u.angle) || typeof u.notes !== 'string' || u.notes.length > 2000000)
        throw new Error('Hauspose oder Beschreibung prüfen.');
    }
  }
}
function putHeader(db: any, cam: string, h: CityHeader) {
  checkedHeader(h);
  const p = JSON.stringify(h);
  db.prepare(
    'INSERT INTO city_document VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET location_id=excluded.location_id,revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, h.id, h.locationId, h.revision, p, hash(p));
}
function putUnit(db: any, cam: string, cityId: string, u: CityUnit) {
  checkedUnit(u);
  const p = JSON.stringify(u);
  db.prepare(
    'INSERT INTO city_unit VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET kind=excluded.kind,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, cityId, u.id, u.kind, p, hash(p));
}
export function readCityHeader(db: any, cam: string, id: string): CityHeader {
  const row = db.prepare('SELECT * FROM city_document WHERE campaign_id=? AND id=?').get(cam, id),
    header = parsed(row) as CityHeader;
  checkedHeader(header);
  if (
    header.id !== row.id ||
    header.revision !== row.revision ||
    header.locationId !== row.location_id
  )
    throw new Error('Stadtidentität widersprüchlich.');
  return header;
}
export function readCitySite(db: any, cam: string, cityId: string, unitId: string) {
  const hr = db
      .prepare('SELECT * FROM city_document WHERE campaign_id=? AND id=?')
      .get(cam, cityId),
    ur = db
      .prepare('SELECT * FROM city_unit WHERE campaign_id=? AND city_id=? AND id=?')
      .get(cam, cityId, unitId),
    header = parsed(hr) as CityHeader,
    unit = parsed(ur) as CityUnit;
  checkedHeader(header);
  checkedUnit(unit);
  if (
    header.id !== hr.id ||
    header.revision !== hr.revision ||
    header.locationId !== hr.location_id ||
    unit.id !== ur.id ||
    unit.kind !== ur.kind
  )
    throw new Error('Stadtschauplatz widerspricht seiner Identität.');
  return { header, unit };
}
export function readCityBuildingChoices(
  db: any,
  cam: string,
  q: CityBuildingQuery,
): CityBuildingChoices {
  if (
    !q ||
    typeof q.text !== 'string' ||
    q.text.length > 1000 ||
    !Number.isSafeInteger(q.offset) ||
    q.offset < 0 ||
    q.offset > 1000000 ||
    (q.excludeUnitId !== undefined && typeof q.excludeUnitId !== 'string')
  )
    throw new Error('Gebäudesuche prüfen.');
  const rows = db
    .prepare(
      `SELECT u.id,u.city_id FROM city_unit u JOIN city_document c ON c.campaign_id=u.campaign_id AND c.id=u.city_id JOIN location l ON l.campaign_id=c.campaign_id AND l.id=c.location_id WHERE u.campaign_id=@cam AND u.kind='building' AND l.trashed=0 AND u.id<>@exclude AND instr(lower(json_extract(u.payload,'$.name')||char(10)||json_extract(c.payload,'$.name')),lower(@text))>0 ORDER BY json_extract(c.payload,'$.name') COLLATE NOCASE,json_extract(u.payload,'$.name') COLLATE NOCASE,u.id LIMIT 41 OFFSET @offset`,
    )
    .all({ cam, exclude: q.excludeUnitId ?? '', text: q.text, offset: q.offset });
  return {
    next: rows.length > 40 ? q.offset + 40 : null,
    items: rows.slice(0, 40).map((r: any) => {
      const { header, unit } = readCitySite(db, cam, r.city_id, r.id);
      return {
        cityId: header.id,
        unitId: unit.id,
        title: unit.name || 'Unbenanntes Haus',
        cityTitle: header.name,
      };
    }),
  };
}
export function cityOverview(db: any, cam: string): CityOverview {
  return {
    cities: db
      .prepare('SELECT * FROM city_document WHERE campaign_id=? ORDER BY rowid')
      .all(cam)
      .map(parsed),
    locations: db
      .prepare(
        'SELECT id,payload,checksum FROM location WHERE campaign_id=? AND trashed=0 ORDER BY rowid',
      )
      .all(cam)
      .map((r: any) => ({ id: r.id, name: parsed(r).name })),
    factions: db
      .prepare(
        "SELECT id,payload,checksum FROM world_note WHERE campaign_id=? AND trashed=0 AND json_extract(payload,'$.kind')='faction' ORDER BY json_extract(payload,'$.title'),id",
      )
      .all(cam)
      .map((r: any) => {
        const n = parsed(r);
        if (n.id !== r.id || n.kind !== 'faction' || typeof n.title !== 'string' || !n.title.trim())
          throw new Error('Fraktionsquelle widerspricht ihrer Identität.');
        return { id: n.id, name: n.title };
      }),
    assignedPeople: db
      .prepare(
        `SELECT id,payload,checksum FROM world_note WHERE campaign_id=? AND id IN(
 SELECT value FROM city_unit,json_each(city_unit.payload,'$.residentIds') WHERE city_unit.campaign_id=?
 UNION SELECT value FROM city_unit,json_each(city_unit.payload,'$.workerIds') WHERE city_unit.campaign_id=?) ORDER BY id`,
      )
      .all(cam, cam, cam)
      .map((r: any) => {
        const n = parsed(r);
        return { id: n.id, name: n.title };
      }),
  };
}
export function readCity(db: any, cam: string, id: string): CityView {
  let canUndo = false,
    canRedo = false;
  for (const row of db
    .prepare(
      'SELECT payload,checksum FROM city_history WHERE campaign_id=? AND city_id=? ORDER BY rowid',
    )
    .iterate(cam, id)) {
    const history = parsed(row);
    canUndo ||= Boolean(history.applied);
    canRedo ||= !history.applied;
  }
  const units = db
      .prepare('SELECT * FROM city_unit WHERE campaign_id=? AND city_id=? ORDER BY rowid')
      .all(cam, id)
      .map(parsed) as CityUnit[],
    residentIds = [...new Set(units.flatMap((u) => u.residentIds ?? []))],
    workerIds = [...new Set(units.flatMap((u) => u.workerIds ?? []))],
    ancestries = new Map<string, number>(),
    genders = new Map<string, number>(),
    ages = new Map<number, number>(),
    presence = new Map<
      string,
      { residents: Set<string>; workers: Set<string>; units: Set<string> }
    >();
  let profiledCount = 0;
  const seen = (factionId: string) => {
    let found = presence.get(factionId);
    if (!found) {
      found = { residents: new Set(), workers: new Set(), units: new Set() };
      presence.set(factionId, found);
    }
    return found;
  };
  for (const residentId of residentIds) {
    const record = npcRecord(db, cam, residentId),
      d = record.demographics!;
    if (d.ancestry.trim()) ancestries.set(d.ancestry, (ancestries.get(d.ancestry) ?? 0) + 1);
    if (d.gender.trim()) genders.set(d.gender, (genders.get(d.gender) ?? 0) + 1);
    if (d.ageYears !== null) ages.set(d.ageYears, (ages.get(d.ageYears) ?? 0) + 1);
    if (d.ancestry.trim() || d.gender.trim() || d.ageYears !== null) profiledCount++;
    if (record.factionId) seen(record.factionId).residents.add(residentId);
  }
  for (const workerId of workerIds) {
    const factionId = npcRecord(db, cam, workerId).factionId;
    if (factionId) seen(factionId).workers.add(workerId);
  }
  for (const unit of units) if (unit.factionId) seen(unit.factionId).units.add(unit.id);
  const textCounts = (values: Map<string, number>) =>
    [...values]
      .sort(([a], [b]) => a.localeCompare(b, 'de', { sensitivity: 'base' }))
      .map(([value, count]) => ({ value, count }));
  const factions = [...presence]
    .map(([factionId, counts]) => {
      const row = db
        .prepare('SELECT id,payload,checksum,trashed FROM world_note WHERE campaign_id=? AND id=?')
        .get(cam, factionId);
      if (!row) throw new Error('Stadtfraktion fehlt.');
      const note = parsed(row);
      if (
        note.id !== row.id ||
        note.kind !== 'faction' ||
        typeof note.title !== 'string' ||
        !note.title.trim()
      )
        throw new Error('Stadtfraktion verweist auf keine World-Fraktion.');
      return {
        id: factionId,
        name: note.title,
        available: !row.trashed,
        residentCount: counts.residents.size,
        workerCount: counts.workers.size,
        unitCount: counts.units.size,
      };
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }) || a.id.localeCompare(b.id),
    );
  return {
    header: parsed(
      db.prepare('SELECT * FROM city_document WHERE campaign_id=? AND id=?').get(cam, id),
    ),
    units,
    demographics: {
      residentCount: residentIds.length,
      profiledCount,
      ancestries: textCounts(ancestries),
      genders: textCounts(genders),
      ages: [...ages].sort(([a], [b]) => a - b).map(([years, count]) => ({ years, count })),
    },
    factions,
    canUndo,
    canRedo,
  };
}
export function validateCities(db: any, cam?: string) {
  const homes = new Map<string, string>(),
    workplaces = new Map<string, string>(),
    lifeRecords = new Set<string>(),
    members = new Set<string>(),
    jobWorkers = new Set<string>();
  for (const row of db
    .prepare('SELECT * FROM city_document' + (cam ? ' WHERE campaign_id=?' : ''))
    .iterate(...(cam ? [cam] : []))) {
    const h = parsed(row) as CityHeader;
    checkedHeader(h);
    if (h.id !== row.id || h.locationId !== row.location_id || h.revision !== row.revision)
      throw new Error('Stadtidentität widersprüchlich.');
    for (const r of db
      .prepare('SELECT * FROM city_unit WHERE campaign_id=? AND city_id=?')
      .iterate(row.campaign_id, row.id)) {
      const u = parsed(r) as CityUnit;
      checkedUnit(u);
      if (u.id !== r.id || u.kind !== r.kind)
        throw new Error('Stadtelementidentität widersprüchlich.');
      for (const nodeId of u.nodeIds ?? []) {
        const n = db
          .prepare(
            "SELECT id FROM city_unit WHERE campaign_id=? AND city_id=? AND id=? AND kind='node'",
          )
          .get(row.campaign_id, row.id, nodeId);
        if (!n) throw new Error('Straßenknoten fehlt.');
      }
      if (
        u.districtId &&
        !db
          .prepare(
            "SELECT 1 FROM city_unit WHERE campaign_id=? AND city_id=? AND id=? AND kind='district'",
          )
          .get(row.campaign_id, row.id, u.districtId)
      )
        throw new Error('Viertelbindung fehlt.');
      if (u.factionId) {
        const faction = db
          .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
          .get(row.campaign_id, u.factionId);
        if (!faction) {
          throw new Error('Stadtfraktion fehlt.');
        }
        const note = parsed(faction);
        if (note.id !== u.factionId || note.kind !== 'faction')
          throw new Error('Stadtfraktion verweist auf keine World-Fraktion.');
      }
      for (const [kind, ids, index] of [
        ['Wohnort', u.residentIds ?? [], homes],
        ['Arbeitsplatz', u.workerIds ?? [], workplaces],
      ] as const)
        for (const id of ids) {
          const npc = db
            .prepare(
              "SELECT * FROM world_note WHERE campaign_id=? AND id=? AND trashed=0 AND json_extract(payload,'$.kind')='npc'",
            )
            .get(row.campaign_id, id);
          if (!npc || parsed(npc).id !== id)
            throw new Error(kind + ' verweist auf einen fehlenden oder gelöschten World-NPC.');
          const key = row.campaign_id + '\u0000' + id;
          if (index.has(key))
            throw new Error(
              'Ein World-NPC darf nur einen bestätigten ' + kind.toLowerCase() + ' haben.',
            );
          index.set(key, u.id);
        }
      for (const household of u.households ?? []) {
        const key = row.campaign_id + '\u0000' + household.id;
        if (lifeRecords.has(key))
          throw new Error('Lebensdatenkennung ist in der Kampagne bereits vergeben.');
        lifeRecords.add(key);
        for (const id of household.memberIds) {
          const member = row.campaign_id + '\u0000' + id;
          if (members.has(member))
            throw new Error('Ein World-NPC darf nur einem Haushalt angehören.');
          members.add(member);
        }
      }
      for (const job of u.jobs ?? []) {
        const key = row.campaign_id + '\u0000' + job.id;
        if (lifeRecords.has(key))
          throw new Error('Lebensdatenkennung ist in der Kampagne bereits vergeben.');
        lifeRecords.add(key);
        for (const id of job.workerIds) {
          const worker = row.campaign_id + '\u0000' + id;
          if (jobWorkers.has(worker))
            throw new Error('Ein World-NPC darf nur einem Stadtberuf angehören.');
          jobWorkers.add(worker);
        }
      }
    }
  }
}
// One history row per affected city, linked by command_id. A move is undone
// together from either city, after any later edits in those cities are undone.
function discardCityRedo(db: any, cam: string, cityIds: string[]) {
  const commands = new Set<string>();
  for (const cityId of cityIds)
    for (const row of db
      .prepare('SELECT * FROM city_history WHERE campaign_id=? AND city_id=?')
      .iterate(cam, cityId))
      if (!parsed(row).applied) commands.add(row.command_id);
  for (const command of commands)
    db.prepare('DELETE FROM city_history WHERE campaign_id=? AND command_id=?').run(cam, command);
}
function restoreCityHistory(db: any, c: CityCommand) {
  const undo = c.action.kind === 'undo',
    order = undo ? 'DESC' : 'ASC';
  const front = (cityId: string) =>
    db
      .prepare(
        'SELECT * FROM city_history WHERE campaign_id=? AND city_id=? ORDER BY rowid ' + order,
      )
      .all(c.campaignId, cityId)
      .find((r: any) => parsed(r).applied === undo);
  const row = front(c.cityId);
  if (!row) throw new Error('Kein weiterer Stadtschritt.');
  const group = db
    .prepare('SELECT * FROM city_history WHERE campaign_id=? AND command_id=?')
    .all(c.campaignId, row.command_id);
  for (const peer of group) {
    if (front(peer.city_id)?.id !== peer.id)
      throw new Error(
        'Stadtwechsel betrifft mehrere Städte. Spätere Änderungen dort zuerst rückgängig machen.',
      );
    const h = parsed(peer),
      expected = undo ? h.after : h.before;
    for (const u of expected) {
      const current = db
        .prepare('SELECT * FROM city_unit WHERE campaign_id=? AND city_id=? AND id=?')
        .get(c.campaignId, peer.city_id, u.id);
      if (u.deleted ? !!current : !current || JSON.stringify(parsed(current)) !== JSON.stringify(u))
        throw new Error('Betroffenes Haus wurde inzwischen geändert. Stadt neu laden.');
    }
    const current = parsed(
        db
          .prepare('SELECT * FROM city_document WHERE campaign_id=? AND id=?')
          .get(c.campaignId, peer.city_id),
      ),
      basis = undo ? h.afterHeader : h.beforeHeader;
    if (JSON.stringify({ ...current, revision: 0 }) !== JSON.stringify({ ...basis, revision: 0 }))
      throw new Error('Stadtangaben wurden inzwischen geändert.');
  }
  for (const peer of group) {
    const h = parsed(peer),
      list = undo ? h.before : h.after,
      current = parsed(
        db
          .prepare('SELECT * FROM city_document WHERE campaign_id=? AND id=?')
          .get(c.campaignId, peer.city_id),
      );
    for (const u of list) {
      if (u.deleted)
        db.prepare('DELETE FROM city_unit WHERE campaign_id=? AND city_id=? AND id=?').run(
          c.campaignId,
          peer.city_id,
          u.id,
        );
      else putUnit(db, c.campaignId, peer.city_id, u);
    }
    putHeader(db, c.campaignId, {
      ...(undo ? h.beforeHeader : h.afterHeader),
      revision: current.revision + 1,
    });
    h.applied = !undo;
    const payload = JSON.stringify(h);
    db.prepare('UPDATE city_history SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(
      payload,
      hash(payload),
      c.campaignId,
      peer.id,
    );
  }
}
export function executeCity(db: any, c: CityCommand, guard: () => void): CityView {
  return db
    .transaction(() => {
      guard();
      if (!c.action || !['create', 'change', 'undo', 'redo'].includes(c.action.kind))
        throw new Error('Unbekannte Stadtaktion.');
      const fp = hash(JSON.stringify({ ...c, token: undefined })),
        receipt = db
          .prepare('SELECT fingerprint FROM city_receipt WHERE command_id=?')
          .get(c.commandId);
      if (receipt) {
        if (receipt.fingerprint !== fp) throw new Error('Änderungskennung anders verwendet.');
        return readCity(db, c.campaignId, c.cityId);
      }
      if (c.action.kind === 'create') {
        if (c.cityId !== c.action.header.id) throw new Error('Stadtkennung widersprüchlich.');
        if (
          db
            .prepare('SELECT 1 FROM city_document WHERE campaign_id=? AND id=?')
            .get(c.campaignId, c.cityId)
        )
          throw new Error('Stadt existiert bereits.');
        putHeader(db, c.campaignId, { ...c.action.header, revision: 1 });
      } else {
        const view = readCity(db, c.campaignId, c.cityId);
        if (view.header.revision !== c.expectedRevision)
          throw new Error('Stadtstand geändert. Aktualisiere die Ansicht und Vorschau.');
        if (c.action.kind === 'change') {
          const change = { ...c.action, upsert: structuredClone(c.action.upsert) };
          if (change.header && change.header.id !== view.header.id)
            throw new Error('Stadtkennung geändert.');
          const sources = new Map<
              string,
              { header: CityHeader; before: Map<string, CityUnit>; after: Map<string, CityUnit> }
            >(),
            seen = new Set<string>();
          if (
            change.lifeMoves !== undefined &&
            (!Array.isArray(change.lifeMoves) || change.lifeMoves.length > 100)
          )
            throw new Error('Haushalts- oder Berufsumzug prüfen.');
          for (const move of change.lifeMoves ?? []) {
            if (
              !move ||
              !['home', 'work'].includes(move.role) ||
              typeof move.recordId !== 'string' ||
              !move.recordId ||
              typeof move.fromCityId !== 'string' ||
              typeof move.fromUnitId !== 'string' ||
              typeof move.toUnitId !== 'string' ||
              move.fromUnitId === move.toUnitId ||
              !Number.isSafeInteger(move.expectedRevision)
            )
              throw new Error('Haushalts- oder Berufsumzug prüfen.');
            const { header, unit } = readCitySite(
              db,
              c.campaignId,
              move.fromCityId,
              move.fromUnitId,
            );
            if (header.revision !== move.expectedRevision)
              throw new Error('Bisherige Stadt wurde geändert. Umzug erneut öffnen.');
            const target = change.upsert.find(
              (u) => u.id === move.toUnitId && u.kind === 'building',
            );
            if (!target || unit.kind !== 'building') throw new Error('Quell- oder Zielhaus fehlt.');
            const household =
                move.role === 'home' ? unit.households?.find((h) => h.id === move.recordId) : null,
              job = move.role === 'work' ? unit.jobs?.find((j) => j.id === move.recordId) : null,
              record = household ?? job;
            if (!record) throw new Error('Haushalt oder Beruf wurde inzwischen geändert.');
            const copied =
              move.role === 'home'
                ? target.households?.find((h) => h.id === move.recordId)
                : target.jobs?.find((j) => j.id === move.recordId);
            if (JSON.stringify(copied) !== JSON.stringify(record))
              throw new Error('Umzug muss Namen, Kennung und Mitglieder gemeinsam übernehmen.');
            const members = household?.memberIds ?? job!.workerIds,
              field = move.role === 'home' ? 'residentIds' : 'workerIds';
            if (members.some((id) => !(target[field] ?? []).includes(id)))
              throw new Error('Mitglieder fehlen im Zielhaus.');
            for (const id of members) {
              const key = move.role + ':' + id;
              if (seen.has(key)) throw new Error('Personenbindung mehrfach verschoben.');
              seen.add(key);
            }
            let source = sources.get(header.id);
            if (!source) {
              source = { header, before: new Map(), after: new Map() };
              sources.set(header.id, source);
            }
            source.before.set(unit.id, unit);
            const next = structuredClone(
              source.after.get(unit.id) ?? change.upsert.find((u) => u.id === unit.id) ?? unit,
            );
            next[field] = (next[field] ?? []).filter((id) => !members.includes(id));
            if (move.role === 'home')
              next.households = (next.households ?? []).filter((h) => h.id !== move.recordId);
            else next.jobs = (next.jobs ?? []).filter((j) => j.id !== move.recordId);
            source.after.set(unit.id, next);
          }
          // Same-city source houses belong in the usual single-city history image.
          const local = sources.get(c.cityId);
          if (local) {
            for (const u of local.after.values()) {
              const i = change.upsert.findIndex((v) => v.id === u.id);
              if (i < 0) change.upsert.push(u);
              else change.upsert[i] = u;
            }
            sources.delete(c.cityId);
          }
          const ids = [...new Set([...change.remove, ...change.upsert.map((u) => u.id)])],
            before = ids.map((id) => view.units.find((u) => u.id === id) ?? { id, deleted: true }),
            after = ids.map(
              (id) => change.upsert.find((u) => u.id === id) ?? { id, deleted: true },
            );
          if (
            change.bindingMoves !== undefined &&
            (!Array.isArray(change.bindingMoves) || change.bindingMoves.length > 400)
          )
            throw new Error('Stadtwechsel prüfen.');
          for (const move of change.bindingMoves ?? []) {
            if (
              !move ||
              !['home', 'work'].includes(move.role) ||
              typeof move.npcId !== 'string' ||
              !move.npcId ||
              typeof move.fromCityId !== 'string' ||
              move.fromCityId === c.cityId ||
              typeof move.fromUnitId !== 'string' ||
              !Number.isSafeInteger(move.expectedRevision)
            )
              throw new Error('Stadtwechsel prüfen.');
            const key = move.role + ':' + move.npcId;
            if (seen.has(key)) throw new Error('Personenbindung mehrfach verschoben.');
            seen.add(key);
            const field = move.role === 'home' ? 'residentIds' : 'workerIds',
              targets = change.upsert.filter(
                (u) => u.kind === 'building' && (u[field] ?? []).includes(move.npcId),
              );
            if (targets.length !== 1) throw new Error('Neues Haus für die Personenbindung fehlt.');
            const { header, unit } = readCitySite(
              db,
              c.campaignId,
              move.fromCityId,
              move.fromUnitId,
            );
            if (header.revision !== move.expectedRevision)
              throw new Error('Bisherige Stadt wurde geändert. Hausauswahl erneut öffnen.');
            if (unit.kind !== 'building' || !(unit[field] ?? []).includes(move.npcId))
              throw new Error('Bisherige Personenbindung wurde geändert.');
            let source = sources.get(header.id);
            if (!source) {
              source = { header, before: new Map(), after: new Map() };
              sources.set(header.id, source);
            }
            source.before.set(unit.id, unit);
            const next = structuredClone(source.after.get(unit.id) ?? unit);
            next[field] = (next[field] ?? []).filter((id) => id !== move.npcId);
            if (move.role === 'home')
              next.households = (next.households ?? []).map((h) => ({
                ...h,
                memberIds: h.memberIds.filter((id) => id !== move.npcId),
              }));
            else
              next.jobs = (next.jobs ?? []).map((j) => ({
                ...j,
                workerIds: j.workerIds.filter((id) => id !== move.npcId),
              }));
            source.after.set(unit.id, next);
          }
          const retainedHouseholds = new Set(
              change.upsert.flatMap((u) => (u.households ?? []).map((h) => h.id)),
            ),
            retainedJobs = new Set(change.upsert.flatMap((u) => (u.jobs ?? []).map((j) => j.id)));
          for (const id of change.remove) {
            const existing = view.units.find((u) => u.id === id);
            if (!existing) throw new Error('Zu entfernendes Element fehlt.');
            if ((existing.households ?? []).some((h) => !retainedHouseholds.has(h.id)))
              throw new Error('Haus enthält Haushalte. Diese zuerst verschieben oder auflösen.');
            if ((existing.jobs ?? []).some((j) => !retainedJobs.has(j.id)))
              throw new Error('Haus enthält Berufe. Diese zuerst verschieben oder auflösen.');
            db.prepare('DELETE FROM city_unit WHERE campaign_id=? AND city_id=? AND id=?').run(
              c.campaignId,
              c.cityId,
              id,
            );
          }
          for (const u of change.upsert) {
            const existing = db
              .prepare('SELECT city_id FROM city_unit WHERE campaign_id=? AND id=?')
              .get(c.campaignId, u.id);
            if (existing && existing.city_id !== c.cityId)
              throw new Error('Element gehört zu einer anderen Stadt.');
            putUnit(db, c.campaignId, c.cityId, u);
          }
          const next = { ...(change.header ?? view.header), revision: view.header.revision + 1 };
          putHeader(db, c.campaignId, next);
          discardCityRedo(db, c.campaignId, [c.cityId, ...sources.keys()]);
          const histories = [
            { cityId: c.cityId, before, after, beforeHeader: view.header, afterHeader: next },
          ];
          for (const [cityId, source] of sources) {
            for (const u of source.after.values()) putUnit(db, c.campaignId, cityId, u);
            const afterHeader = { ...source.header, revision: source.header.revision + 1 };
            putHeader(db, c.campaignId, afterHeader);
            histories.push({
              cityId,
              before: [...source.before.values()],
              after: [...source.after.values()],
              beforeHeader: source.header,
              afterHeader,
            });
          }
          for (const history of histories) {
            const id =
                history.cityId === c.cityId ? c.commandId : c.commandId + ':' + history.cityId,
              payload = JSON.stringify({ id, label: change.label, ...history, applied: true });
            db.prepare('INSERT INTO city_history VALUES(?,?,?,?,?,?)').run(
              c.campaignId,
              history.cityId,
              id,
              c.commandId,
              payload,
              hash(payload),
            );
          }
        } else restoreCityHistory(db, c);
      }
      validateCities(db, c.campaignId);
      db.prepare('INSERT INTO city_receipt VALUES(?,?,?)').run(c.campaignId, c.commandId, fp);
      return readCity(db, c.campaignId, c.cityId);
    })
    .immediate();
}
