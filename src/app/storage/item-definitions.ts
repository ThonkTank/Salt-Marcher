import { checkedDefinition, nextAuthoredDefinition } from '../catalog/item-definition-validation';
import { budgetRarity } from '../atlas/dungeon-budget-contracts';
import { srdItemDefinitions, srdItemSourceStatus } from './srd-items';
import { coinDefinitions } from './coin-definitions';
import { createHash } from 'node:crypto';
import type {
  ItemDefinition,
  ItemQuery,
  ItemPage,
  ItemCatalogFilter,
} from '../catalog/items-contracts';
import { canonicalJson } from '../campaign/generation/canonical-json';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function decoded(row: any, id: string, revision: number): ItemDefinition {
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error(
      'Gegenstandsdefinition beschädigt oder nicht verfügbar. Originalbytes bleiben erhalten.',
    );
  const d = checkedDefinition(JSON.parse(row.payload));
  if (d.id !== id || d.revision !== revision)
    throw new Error('Gegenstandsrevision widersprüchlich.');
  return d;
}
function legacyDefinition(row: any): ItemDefinition {
  return checkedDefinition({
    id: row.id,
    revision: row.revision,
    name: row.name,
    category: row.category,
    magic: row.category === 'magic',
    rarity: '',
    attunement: 'unspecified',
    unitCopper: row.unit_copper,
    weightText: '',
    properties: [],
    description: '',
    source: { kind: 'authored', label: 'Eigener Gegenstand', license: null, url: null },
    trashed: false,
  });
}
/** Immutable snapshots retain only genuinely observed versions, never invented past states. */
export function recordItemDefinitionVersion(db: any, d: ItemDefinition) {
  checkedDefinition(d);
  const old = db
    .prepare('SELECT * FROM item_definition_version WHERE id=? AND revision=?')
    .get(d.id, d.revision);
  if (old) {
    if (canonicalJson(decoded(old, d.id, d.revision)) !== canonicalJson(d))
      throw new Error('Gegenstandsstand widerspricht seiner aufgezeichneten Version.');
    return;
  }
  const payload = JSON.stringify(d);
  db.prepare(
    'INSERT INTO item_definition_version(id,revision,payload,checksum) VALUES(?,?,?,?)',
  ).run(d.id, d.revision, payload, hash(payload));
}
export function installItemDefinitions(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS item_definition(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS item_definition_version(id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(id,revision)) STRICT;`);
  installSrdItems(db);
}
function installSrdItems(db: any) {
  // Projection corrections can change the definition without changing its pinned source hash.
  db.transaction(() => {
    for (const source of [...srdItemDefinitions, ...coinDefinitions]) {
      const row = db.prepare('SELECT * FROM item_definition WHERE id=?').get(source.id),
        legacy = db.prepare('SELECT 1 FROM authored_item WHERE id=?').get(source.id);
      let d = source;
      if (row) {
        const current = decoded(row, source.id, row.revision);
        if (
          current.source.kind !== 'srd51' ||
          canonicalJson(current) === canonicalJson({ ...source, revision: current.revision })
        )
          continue;
        recordItemDefinitionVersion(db, current);
        d = { ...source, revision: current.revision + 1 };
      } else if (legacy) continue;
      checkedDefinition(d);
      recordItemDefinitionVersion(db, d);
      const payload = JSON.stringify(d);
      db.prepare(
        'INSERT INTO item_definition VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
      ).run(d.id, d.revision, payload, hash(payload));
      db.prepare(
        'INSERT INTO authored_item VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,name=excluded.name,category=excluded.category,unit_copper=excluded.unit_copper',
      ).run(d.id, d.revision, d.name, d.category, d.unitCopper ?? '0');
    }
  }).immediate();
}
export function readItemDefinition(db: any, id: string, revision?: number): ItemDefinition {
  if (
    typeof id !== 'string' ||
    !id ||
    (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 1))
  )
    throw new Error('Ungültige Gegenstandsreferenz.');
  if (revision !== undefined) {
    const old = db
      .prepare('SELECT * FROM item_definition_version WHERE id=? AND revision=?')
      .get(id, revision);
    if (old) return decoded(old, id, revision);
    const legacy = db
      .prepare(
        'SELECT * FROM authored_item WHERE id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM item_definition WHERE id=?)',
      )
      .get(id, revision, id);
    if (legacy) return legacyDefinition(legacy);
    throw new Error('Diese historische Gegenstandsversion ist nicht verfügbar.');
  }
  const row = db.prepare('SELECT * FROM item_definition WHERE id=?').get(id);
  if (row) {
    const d = decoded(row, id, row.revision),
      recorded = db
        .prepare('SELECT * FROM item_definition_version WHERE id=? AND revision=?')
        .get(id, row.revision);
    if (recorded && canonicalJson(decoded(recorded, id, row.revision)) !== canonicalJson(d))
      throw new Error('Aktuelle Gegenstandsdefinition widerspricht ihrer aufgezeichneten Version.');
    return d;
  }
  const legacy = db.prepare('SELECT * FROM authored_item WHERE id=?').get(id);
  if (!legacy) throw new Error('Gegenstand nicht gefunden.');
  const d = legacyDefinition(legacy),
    recorded = db
      .prepare('SELECT * FROM item_definition_version WHERE id=? AND revision=?')
      .get(id, legacy.revision);
  if (recorded && canonicalJson(decoded(recorded, id, legacy.revision)) !== canonicalJson(d))
    throw new Error('Legacy-Gegenstand widerspricht seinem aufgezeichneten Stand.');
  return d;
}
export function saveItemDefinition(db: any, input: ItemDefinition, expected: number | null) {
  return db
    .transaction(() => {
      if (
        !input ||
        typeof input.id !== 'string' ||
        !input.id ||
        (expected !== null && (!Number.isSafeInteger(expected) || expected < 1))
      )
        throw new Error('Ungültiger Gegenstandsauftrag.');
      const row = db
        .prepare(
          'SELECT revision FROM item_definition WHERE id=? UNION ALL SELECT revision FROM authored_item WHERE id=? AND NOT EXISTS(SELECT 1 FROM item_definition WHERE id=?)',
        )
        .get(input.id, input.id, input.id);
      if ((row?.revision ?? null) !== expected)
        throw new Error('Gegenstand geändert. Bitte aktualisieren.');
      if (
        input.source?.kind === 'srd51' ||
        (row && readItemDefinition(db, input.id).source.kind === 'srd51')
      )
        throw new Error('SRD-Quellen sind schreibgeschützt. Zuerst eine eigene Kopie anlegen.');
      if (row) recordItemDefinitionVersion(db, readItemDefinition(db, input.id));
      const d = nextAuthoredDefinition(input, expected);
      recordItemDefinitionVersion(db, d);
      const payload = JSON.stringify(d);
      db.prepare(
        'INSERT INTO item_definition(id,revision,payload,checksum) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
      ).run(d.id, d.revision, payload, hash(payload));
      db.prepare(
        'INSERT INTO authored_item(id,revision,name,category,unit_copper) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,name=excluded.name,category=excluded.category,unit_copper=excluded.unit_copper',
      ).run(d.id, d.revision, d.name, d.category, d.unitCopper ?? '0');
      return d;
    })
    .immediate();
}
export function matchesItemDefinition(d: ItemDefinition, q: ItemCatalogFilter) {
  const needle = q.search.toLocaleLowerCase();
  return (
    (!q.source || d.source.kind === q.source) &&
    (!q.category || d.category === q.category) &&
    (!q.magic || d.magic === (q.magic === 'yes')) &&
    (!q.rarity ||
      (budgetRarity(q.rarity)
        ? budgetRarity(d.rarity) === budgetRarity(q.rarity)
        : d.rarity.toLocaleLowerCase().includes(q.rarity.toLocaleLowerCase()))) &&
    (!q.attunement || d.attunement === q.attunement) &&
    (!needle ||
      [d.name, d.description, ...d.properties].join(' ').toLocaleLowerCase().includes(needle))
  );
}
export function readItemDefinitions(db: any, q: ItemQuery): ItemPage {
  if (
    !q ||
    typeof q.search !== 'string' ||
    !Number.isSafeInteger(q.after) ||
    q.after < 0 ||
    !['name', 'value'].includes(q.sort) ||
    !['asc', 'desc'].includes(q.direction)
  )
    throw new Error('Ungültige Gegenstandssuche.');
  const items: ItemDefinition[] = [],
    problems: string[] = [];
  for (const row of db
    .prepare('SELECT id FROM authored_item UNION SELECT id FROM item_definition')
    .iterate()) {
    try {
      const d = readItemDefinition(db, row.id);
      if ((q.includeTrashed || !d.trashed) && matchesItemDefinition(d, q)) items.push(d);
    } catch (error) {
      problems.push('Gegenstand ' + row.id + ' ist gesperrt: ' + (error as Error).message);
    }
  }
  items.sort((a, b) => {
    const byValue =
      q.sort === 'value'
        ? BigInt(a.unitCopper ?? '0') < BigInt(b.unitCopper ?? '0')
          ? -1
          : BigInt(a.unitCopper ?? '0') > BigInt(b.unitCopper ?? '0')
            ? 1
            : 0
        : a.name.localeCompare(b.name);
    return (q.direction === 'asc' ? 1 : -1) * (byValue || a.id.localeCompare(b.id));
  });
  return {
    items: items.slice(q.after, q.after + 40),
    total: items.length,
    next: items.length > q.after + 40 ? q.after + 40 : null,
    problems,
    sourceStatus: srdItemSourceStatus,
  };
}
export function validateItemDefinitionVersions(db: any) {
  for (const row of db.prepare('SELECT * FROM item_definition_version').iterate())
    decoded(row, row.id, row.revision);
}
