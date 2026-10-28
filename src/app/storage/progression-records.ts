import { checkedQuery, checkedRow, type SqliteDatabase } from './sqlite-connection';
import { decodeStored } from './stored-payload';
import * as shape from './stored-shapes';
import { createHash, randomUUID } from 'node:crypto';
import {
  checkedHealth,
  checkedHealthStatus,
  copper,
  ledgerCopper,
  ledgerDefinitionId,
  xpLevel,
  xpShare,
} from '../runtime/progression';
import { type ItemInput } from '../catalog/item-input-contracts';
import { type LedgerItem, type Treasure } from '../runtime/treasure-contracts';
import { type Progress } from '../runtime/character-progress-contracts';
import { readLiveScene } from './live-read';
import { readItemDefinition, recordItemDefinitionVersion } from './item-definitions';
import { validateCatalogReference } from '../catalog/catalog-reference-contracts';
import { itemDefinitionReference, resolveItemReference } from './catalog-references';
export const json = (v: unknown) => JSON.stringify(v);

export const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export function checkedProgressValue(value: unknown): Progress {
  const p = shape.character_progress(value);
  if (
    typeof p.characterId !== 'string' ||
    !p.characterId.trim() ||
    p.characterId.length > 1000 ||
    !Number.isSafeInteger(p.revision) ||
    p.revision < 0 ||
    (p.xp !== null && (!Number.isSafeInteger(p.xp) || p.xp < 0))
  )
    throw new Error('XP-Stand ungültig.');
  if (
    !p.rest ||
    typeof p.rest !== 'object' ||
    Array.isArray(p.rest) ||
    typeof p.rest.known !== 'boolean'
  )
    throw new Error('Raststand ungültig.');
  for (const value of [p.rest.longXp, p.rest.shortXp, p.rest.baseline, p.rest.sections])
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Raststand ungültig.');
  if (p.rest.sections > 2 || p.rest.baseline > p.rest.longXp || p.rest.shortXp > p.rest.longXp)
    throw new Error('Rastabschnitte widersprüchlich.');
  if (p.health !== null) {
    const h = p.health;
    if (
      !h ||
      typeof h.conditions !== 'string' ||
      h.conditions.length > 4000 ||
      typeof h.concentrating !== 'boolean' ||
      ![h.hp, h.maxHp, h.tempHp].every((v) => Number.isSafeInteger(v) && v >= 0 && v <= 1000000) ||
      h.maxHp < 1 ||
      h.hp > h.maxHp
    )
      throw new Error('Gespeicherte Trefferpunkte oder Zustände ungültig.');
    checkedHealth(h);
  }
  if (p.combatStatus !== undefined) checkedHealthStatus(p.combatStatus);
  return p;
}
export function readProgressCharacter(db: SqliteDatabase, cam: string, id: string): Progress {
  const row = db
    .prepare('SELECT * FROM character_progress WHERE campaign_id=? AND id=?')
    .get(cam, id);
  const r = checkedRow(row, { id: 'text', revision: 'integer' }),
    p = decodeStored(row, checkedProgressValue);
  if (p.characterId !== r.id || p.characterId !== id || p.revision !== r.revision)
    throw new Error('Fortschrittszuordnung widersprüchlich.');
  return p;
}

export function saveProgress(db: SqliteDatabase, cam: string, p: Progress) {
  p.revision++;
  const payload = json(p);
  db.prepare(
    'UPDATE character_progress SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
  ).run(p.revision, payload, hash(payload), cam, p.characterId);
}

export function event(
  db: SqliteDatabase,
  cam: string,
  characterId: string | null,
  kind: keyof typeof import('./progression.transfer.json').tables.progress_event.columns.payload.transfer.models,
  facts: unknown,
  id: string = randomUUID(),
) {
  const payload = json({ recordedAt: new Date().toISOString(), ...(facts as object) });
  db.prepare('INSERT INTO progress_event VALUES(?,?,?,?,?,?)').run(
    cam,
    id,
    characterId,
    kind,
    payload,
    hash(payload),
  );
  return id;
}

export function notice(db: SqliteDatabase, cam: string, characterId: string, amount: number) {
  if (
    amount &&
    !checkedQuery(db, 'SELECT active FROM roster_member WHERE campaign_id=? AND id=?', {
      active: 'integer',
    }).required(cam, characterId).active
  )
    db.prepare('INSERT INTO progress_notice VALUES(?,?,?,?,0)').run(
      cam,
      randomUUID(),
      characterId,
      amount + ' XP erhalten, während die Figur inaktiv war.',
    );
}

function checkedTreasure(t: Treasure, unpersisted = false): Treasure {
  const id = (v: unknown) => typeof v === 'string' && !!v.trim() && v.length <= 1000;
  const reference = (r: Treasure['items'][number]['reference']) =>
    r &&
    r.kind === 'authored' &&
    id(r.definitionId) &&
    Number.isSafeInteger(r.revision) &&
    r.revision > 0 &&
    (r.historicalDefinitionId === undefined || id(r.historicalDefinitionId));
  if (
    !t ||
    !id(t.id) ||
    !Number.isSafeInteger(t.revision) ||
    (t.revision < 1 && !(unpersisted && t.revision === 0 && t.items.length === 0)) ||
    typeof t.title !== 'string' ||
    t.title.length > 1000 ||
    !Array.isArray(t.items) ||
    [t.sceneId, t.locationId, t.combatId].some((v) => v !== null && !id(v)) ||
    [t.sourceNoteId, t.awardId].some((v) => v !== undefined && !id(v))
  )
    throw new Error('Schatzbeschreibung oder Zuordnung widersprüchlich.');
  const seen = new Set<string>();
  for (const i of t.items) {
    if (
      !i ||
      !id(i.id) ||
      seen.has(i.id) ||
      !reference(i.reference) ||
      typeof i.name !== 'string' ||
      i.name.length > 1000 ||
      !['coins', 'equipment', 'trade-goods', 'magic', 'other'].includes(i.category) ||
      !Number.isSafeInteger(i.quantity) ||
      i.quantity < 0 ||
      !Number.isSafeInteger(i.allocated) ||
      i.allocated < 0 ||
      i.allocated > i.quantity ||
      (i.unitCopper !== null &&
        (typeof i.unitCopper !== 'string' || !/^(0|[1-9][0-9]{0,17})$/.test(i.unitCopper)))
    )
      throw new Error('Schatzlos oder vergebene Menge widersprüchlich.');
    const o = i.origin;
    if (
      o !== undefined &&
      (!o ||
        !id(o.treasureId) ||
        !id(o.itemId) ||
        [o.sceneId, o.locationId, o.combatId].some((v) => v !== null && !id(v)) ||
        [o.sourceNoteId, o.awardId].some((v) => v !== undefined && !id(v)))
    )
      throw new Error('Schatzlosherkunft ungültig.');
    seen.add(i.id);
  }
  return t;
}

export function checkedTreasureValue(value: unknown, unpersisted = false): Treasure {
  return checkedTreasure(shape.treasure(value), unpersisted);
}

export function checkedTreasureRow(value: unknown): Treasure {
  const row = checkedRow(value, { id: 'text', revision: 'integer' });
  const t = decodeStored(value, checkedTreasureValue);
  if (t.id !== row.id || t.revision !== row.revision)
    throw new Error('Beutezuordnung widersprüchlich.');
  return t;
}

export function readTreasure(db: SqliteDatabase, cam: string, id: string): Treasure {
  return db.transaction(() => {
    const row = checkedQuery(db, 'SELECT * FROM treasure WHERE campaign_id=? AND id=?', {
        campaign_id: 'text',
        id: 'text',
        revision: 'integer',
        payload: 'text',
        checksum: 'text',
      }).get(cam, id),
      value = checkedTreasureRow(row);
    const definitions = new Map<string, ReturnType<typeof readItemDefinition>>();
    for (const item of value.items) {
      let definition = definitions.get(item.reference.definitionId);
      if (!definition) {
        definition = readItemDefinition(db, item.reference.definitionId);
        definitions.set(definition.id, definition);
      }
      item.currentDefinition = definition;
    }
    return value;
  })();
}

export function validateLedgerItem(l: LedgerItem) {
  const text = (v: unknown, max: number, nonempty = false) =>
    typeof v === 'string' && v.length <= max && (!nonempty || !!v.trim());
  const id = (v: unknown) => text(v, 1000, true),
    price = (v: unknown) => typeof v === 'string' && /^(0|[1-9][0-9]{0,17})$/.test(v);
  if (
    !l ||
    !id(l.id) ||
    !id(l.characterId) ||
    !Number.isSafeInteger(l.revision) ||
    l.revision < 1 ||
    !text(l.name, 1000, true) ||
    !['coins', 'equipment', 'trade-goods', 'magic', 'other'].includes(l.category) ||
    !Number.isSafeInteger(l.quantity) ||
    l.quantity < 0 ||
    l.quantity > 1000000 ||
    !['award', 'purchase', 'manual', 'transfer'].includes(l.origin) ||
    !['received', 'sold', 'given'].includes(l.status) ||
    !text(l.counterparty, 10000) ||
    !text(l.recordedAt, 1000, true)
  )
    throw new Error(
      'Persönlicher Beuteeintrag hat eine ungültige Beschreibung, Menge oder Herkunft.',
    );
  if (
    !l.reference ||
    l.reference.kind !== 'authored' ||
    !id(l.reference.definitionId) ||
    !Number.isSafeInteger(l.reference.revision) ||
    l.reference.revision < 1 ||
    (l.reference.historicalDefinitionId !== undefined && !id(l.reference.historicalDefinitionId))
  )
    throw new Error('Gegenstandsreferenz im Beuteeintrag ungültig.');
  if (
    (l.unitCopper !== null && !price(l.unitCopper)) ||
    (l.actualSaleCopper !== null && !price(l.actualSaleCopper)) ||
    (l.paidCopper !== undefined && !price(l.paidCopper)) ||
    (l.status !== 'sold' && l.actualSaleCopper !== null)
  )
    throw new Error('Aufgezeichneter Beutewert oder Handelspreis ungültig.');
  for (const key of ['treasureId', 'combatId', 'sceneId', 'locationId', 'parentId'] as const)
    if (l[key] !== null && !id(l[key])) throw new Error('Beuteverknüpfung ungültig.');
  if (
    l.parentId === l.id ||
    (l.instantMs !== null &&
      (typeof l.instantMs !== 'string' || !/^(0|[1-9][0-9]{0,29})$/.test(l.instantMs)))
  )
    throw new Error('Beuteherkunft oder aufgezeichnete Zeit ungültig.');
  if (l.instanceId !== undefined && l.instanceId !== null && (!id(l.instanceId) || l.quantity > 1))
    throw new Error(
      'Einzelstück im persönlichen Bestand benötigt eine eindeutige Identität und höchstens Menge eins.',
    );
  if (
    l.counterpartyLink &&
    (!['shop', 'npc', 'location', 'faction'].includes(l.counterpartyLink.kind) ||
      !id(l.counterpartyLink.id))
  )
    throw new Error('Empfängerverknüpfung prüfen.');
  for (const field of [
    'sourceNoteId',
    'awardId',
    'mergeTargetId',
    'rewardCreditId',
    'sourceTreasureId',
    'sourceTreasureItemId',
  ] as const)
    if (l[field] !== undefined && !id(l[field])) throw new Error('Beuteherkunft prüfen.');
  const c = l.counterpartyReference;
  if (
    (c &&
      (!id(c.shopId) ||
        !c.owner ||
        !['npc', 'location'].includes(c.owner.kind) ||
        !id(c.owner.id))) ||
    (c !== undefined && !c)
  )
    throw new Error('Aufgezeichnete Handelsbeziehung ungültig.');
}

export function checkedLedgerRow(value: unknown): LedgerItem {
  const row = checkedRow(value, { id: 'text', character_id: 'text', revision: 'integer' });
  const item = decodeStored(value, shape.character_ledger);
  validateLedgerItem(item);
  if (item.id !== row.id || item.characterId !== row.character_id || item.revision !== row.revision)
    throw new Error('Beuteeintrag gehört nicht zu seiner Figur oder Revision.');
  return item;
}

export function readLedgerDefinition(db: SqliteDatabase, item: LedgerItem) {
  const bound = item.reference.catalogReference;
  if (
    bound &&
    ((!item.reference.historicalDefinitionId && bound.entryId !== item.reference.definitionId) ||
      bound.sourceVersion !== String(item.reference.revision))
  )
    throw new Error('Beuteeintrag widerspricht seiner Katalogbindung.');
  const pinned = bound
    ? resolveItemReference(db, bound, ledgerDefinitionId(item))
    : readItemDefinition(db, ledgerDefinitionId(item), item.reference.revision);
  if (
    pinned.name !== item.name ||
    pinned.category !== item.category ||
    pinned.unitCopper !== item.unitCopper
  )
    throw new Error(
      'Persönlicher Beuteeintrag widerspricht seiner aufgezeichneten Gegenstandsrevision.',
    );
  return readItemDefinition(db, item.reference.definitionId);
}

// Older transfers already record their parent chain. Resolve it lazily so old
// campaign histories keep their bytes and receipts while new portions carry a stable credit.
export function transferCredit(db: SqliteDatabase, cam: string, item: LedgerItem): string {
  let current = item;
  const seen = new Set<string>();
  while (current.origin === 'transfer') {
    if (current.rewardCreditId) return current.rewardCreditId;
    if (!current.parentId || seen.has(current.id))
      throw new Error('Weitergabeherkunft nicht verfügbar.');
    seen.add(current.id);
    current = checkedLedgerRow(
      checkedQuery(db, 'SELECT * FROM character_ledger WHERE campaign_id=? AND id=?', {
        campaign_id: 'text',
        id: 'text',
        character_id: 'text',
        revision: 'integer',
        payload: 'text',
        checksum: 'text',
      }).get(cam, current.parentId),
    );
  }
  return current.id;
}

export function transferredValue(
  db: SqliteDatabase,
  cam: string,
  root: LedgerItem,
  quantityOnly = false,
): bigint | null {
  let total = 0n;
  // A transferred stack stays credited to its first handout. Quantity is counted
  // only at its current holder, or by the final sale/gift, never at intermediate handouts.
  const sql = `WITH RECURSIVE descendants(id) AS (
 SELECT id FROM character_ledger WHERE campaign_id=? AND id=?
 UNION SELECT l.id FROM character_ledger l JOIN descendants d ON CASE WHEN json_valid(l.payload) THEN json_extract(l.payload,'$.parentId') END=d.id WHERE l.campaign_id=?
 ) SELECT l.* FROM character_ledger l WHERE l.campaign_id=? AND (l.id IN (SELECT id FROM descendants) OR CASE WHEN json_valid(l.payload) THEN json_extract(l.payload,'$.rewardCreditId') END=?)`;
  for (const row of db.prepare(sql).iterate(cam, root.id, cam, cam, root.id)) {
    const item = checkedLedgerRow(row);
    if (item.origin !== 'transfer' || (item.status === 'given' && item.recipientCharacterId))
      continue;
    if (transferCredit(db, cam, item) !== root.id) continue;
    item.currentUnitCopper = readLedgerDefinition(db, item).unitCopper;
    const value = quantityOnly ? BigInt(item.quantity) : ledgerCopper(item);
    if (value === null) return null;
    total += value;
  }
  return total;
}

// One current reward valuation for the personal ledger and cross-character balance.
export function ledgerRewardQuantity(db: SqliteDatabase, cam: string, item: LedgerItem): number {
  readLedgerDefinition(db, item);
  if (item.origin === 'purchase' || item.origin === 'transfer') return 0;
  const quantity =
    item.status === 'given' && item.recipientCharacterId
      ? Number(transferredValue(db, cam, item, true))
      : item.quantity;
  if (!Number.isSafeInteger(quantity) || quantity < 0)
    throw new Error('Erhaltene Gegenstandsmenge nicht verfügbar.');
  return quantity;
}

export function ledgerRewardValue(
  db: SqliteDatabase,
  cam: string,
  item: LedgerItem,
): bigint | null {
  const definition = readLedgerDefinition(db, item);
  item.currentName = definition.name;
  item.currentUnitCopper = definition.unitCopper;
  if (item.origin === 'transfer') item.rewardCreditId = transferCredit(db, cam, item);
  if (item.origin === 'purchase' || item.origin === 'transfer') return 0n;
  const value =
    item.status === 'given' && item.recipientCharacterId
      ? transferredValue(db, cam, item)
      : ledgerCopper(item);
  if (item.status === 'given' && item.recipientCharacterId)
    item.creditedCopper = value?.toString() ?? null;
  return value;
}

export function checkedItemInput(input: ItemInput) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 1000 ||
    !Number.isSafeInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 1000000 ||
    !['coins', 'equipment', 'trade-goods', 'magic', 'other'].includes(input.category)
  )
    throw new Error('Beute benötigt Name, Kategorie und positive ganze Menge.');
  if (
    input.reference &&
    (typeof input.reference !== 'object' ||
      Array.isArray(input.reference) ||
      input.reference.kind !== 'authored' ||
      typeof input.reference.definitionId !== 'string' ||
      !input.reference.definitionId.trim() ||
      !Number.isSafeInteger(input.reference.revision) ||
      input.reference.revision < 1)
  )
    throw new Error('Gegenstandsreferenz prüfen.');
  if (input.reference?.catalogReference) {
    validateCatalogReference(input.reference.catalogReference);
    if (
      input.reference.catalogReference.entryType !== 'item' ||
      input.reference.catalogReference.entryId !== input.reference.definitionId ||
      input.reference.catalogReference.sourceVersion !== String(input.reference.revision)
    )
      throw new Error('Gegenstandsreferenz widerspricht ihrer Katalogbindung.');
  }
  if (!input.reference) copper(input.valueGold);
  return input;
}

export function validateItemInput(db: SqliteDatabase, input: ItemInput) {
  checkedItemInput(input);
  if (input.reference) {
    if (input.reference.catalogReference)
      resolveItemReference(db, input.reference.catalogReference);
    const d = readItemDefinition(db, input.reference.definitionId);
    if (d.trashed || d.revision !== input.reference.revision)
      throw new Error('Gegenstandsdefinition geändert oder im Papierkorb.');
    return d;
  }
  return null;
}

export function checkedItem(db: SqliteDatabase, input: ItemInput) {
  const definition = validateItemInput(db, input);
  if (definition)
    return {
      id: randomUUID(),
      reference: {
        kind: 'authored' as const,
        definitionId: definition.id,
        revision: definition.revision,
        catalogReference: itemDefinitionReference(definition),
      },
      name: definition.name,
      category: definition.category,
      quantity: input.quantity,
      allocated: 0,
      unitCopper: definition.unitCopper,
    };
  const id = randomUUID(),
    unitCopper = copper(input.valueGold);
  db.prepare('INSERT INTO authored_item VALUES(?,1,?,?,?)').run(
    id,
    input.name,
    input.category,
    unitCopper,
  );
  recordItemDefinitionVersion(db, readItemDefinition(db, id));
  return {
    id: randomUUID(),
    reference: {
      kind: 'authored' as const,
      definitionId: id,
      revision: 1,
      catalogReference: itemDefinitionReference(readItemDefinition(db, id)),
    },
    name: input.name,
    category: input.category,
    quantity: input.quantity,
    allocated: 0,
    unitCopper,
  };
}

export function saveTreasure(db: SqliteDatabase, cam: string, t: Treasure) {
  checkedTreasure(t);
  const stored = {
    ...t,
    items: t.items.map((i) => {
      const s = { ...i };
      delete s.currentDefinition;
      return s;
    }),
  };
  const payload = json(stored);
  db.prepare(
    'INSERT INTO treasure VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, t.id, t.revision, payload, hash(payload));
}

export function makeTreasure(
  db: SqliteDatabase,
  cam: string,
  title: string,
  sceneId: string | null,
  combatId: string | null,
  inputs: ItemInput[],
  locationId?: string,
) {
  if (
    typeof title !== 'string' ||
    title.length > 1000 ||
    !Array.isArray(inputs) ||
    inputs.length > 100
  )
    throw new Error('Ungültige Beute.');
  if (!inputs.length) return null;
  const scene = sceneId ? readLiveScene(db, cam, sceneId) : null;
  const treasure: Treasure = {
    id: randomUUID(),
    revision: 1,
    title: title || 'Beute',
    sceneId,
    locationId: locationId ?? scene?.locationId ?? null,
    combatId,
    items: inputs.map((i) => checkedItem(db, i)),
  };
  saveTreasure(db, cam, treasure);
  event(db, cam, null, 'treasure-created', { treasure });
  return treasure.id;
}

export function availableRecipient(db: SqliteDatabase, cam: string, id: string) {
  if (
    checkedQuery(
      db,
      "SELECT 1 FROM character_profile WHERE campaign_id=? AND id=? AND json_type(payload,'$.archive')='object'",
      { '1': 'integer' },
    ).get(cam, id)
  )
    throw new Error('Archivierte Belohnungsempfänger zuerst wiederherstellen.');
}

export function awardXpPool(
  db: SqliteDatabase,
  cam: string,
  pool: number,
  recipients: { characterId: string; revision: number }[],
  sourceKind: string,
  sourceId: string,
) {
  if (new Set(recipients.map((r) => r.characterId)).size !== recipients.length)
    throw new Error('XP-Empfänger dürfen nicht doppelt vorkommen.');
  const award = xpShare(pool, recipients.length);
  for (const recipient of recipients) {
    availableRecipient(db, cam, recipient.characterId);
    const p = readProgressCharacter(db, cam, recipient.characterId),
      before = structuredClone(p);
    if (p.revision !== recipient.revision)
      throw new Error('XP-Empfänger geändert. Belohnung erneut ansehen.');
    p.xp = (p.xp ?? 0) + award.share;
    xpLevel(p.xp);
    saveProgress(db, cam, p);
    notice(db, cam, p.characterId, award.share);
    event(db, cam, p.characterId, 'story-award', {
      sourceKind,
      sourceId,
      before,
      after: p,
      xp: award.share,
    });
  }
  return award;
}

export function createProgress(db: SqliteDatabase, cam: string, id: string, known = true) {
  const p: Progress = {
    characterId: id,
    revision: 0,
    xp: null,
    rest: { known, longXp: 0, shortXp: 0, baseline: 0, sections: 0 },
    health: null,
  };
  const payload = json(p);
  db.prepare('INSERT OR IGNORE INTO character_progress VALUES(?,?,?,?,?)').run(
    cam,
    id,
    0,
    payload,
    hash(payload),
  );
}
