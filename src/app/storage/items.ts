import { checkedCalendarEventRow } from './calendar-events';
import { decodeStored } from './stored-payload';
import * as shape from './stored-shapes';
import { checkedWorldNoteRow } from './world-note-row';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { validateLedgerItem } from './progression-records';
import { checkedQuery, checkedRow, type SqliteDatabase } from './sqlite-connection';
import { shopStockForItem } from '../catalog/items-contracts';
import { checkedDefinition } from '../catalog/item-definition-validation';
import {
  validateShopShape,
  validateShopRestockTable,
  validateShopQuantity as qty,
} from '../runtime/shop-validation';
import { npcIdsAtLocation } from './npc-world';
import { drawCatalogRestock } from './catalog-restock';
import { prepareRestockTables, drawRestockTable } from './shop-restock';
import { createHash, randomUUID } from 'node:crypto';
import type {
  Shop,
  ShopView,
  ShopHistoryPage,
  ShopSummary,
  ItemShopCommand,
  ItemShopAck,
} from '../catalog/items-contracts';
import { copper, partitionLedgerPaidPrice, type LedgerItem } from '../runtime/progression';
import { saveLedger, readLedgerItem } from './progression';
import { event } from './progression-records';
import {
  readItemDefinition,
  saveItemDefinition,
  installItemDefinitions,
  validateItemDefinitionVersions,
  validateCurrentItemDefinitions,
} from './item-definitions';
import { scenePreparation } from './session-read';
import { readLiveScene, readCampaignTime } from './live-read';
import { formatInstant } from '../runtime/live-contracts';
const json = (v: unknown) => JSON.stringify(v),
  hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installItemsSchema(db: SqliteDatabase) {
  installItemDefinitions(db);
  db.exec(`CREATE TABLE IF NOT EXISTS shop(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS shop_event(campaign_id TEXT NOT NULL,shop_id TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,shop_id) REFERENCES shop(campaign_id,id)) STRICT;
 CREATE INDEX IF NOT EXISTS shop_event_by_shop ON shop_event(campaign_id,shop_id);
 CREATE TABLE IF NOT EXISTS shop_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;`);
}
function owner(db: SqliteDatabase, cam: string, s: Shop) {
  if (!['npc', 'location'].includes(s.owner.kind))
    throw new Error('Shop benötigt einen NPC oder Ort als Besitzer.');
  const row = db
    .prepare(
      `SELECT * FROM ${s.owner.kind === 'npc' ? 'world_note' : 'location'} WHERE campaign_id=? AND id=?`,
    )
    .get(cam, s.owner.id);
  if (!row) throw new Error('Shopbesitzer fehlt.');
  const r = checkedRow(row, { id: 'text', trashed: 'integer' });
  const d =
    s.owner.kind === 'npc' ? checkedWorldNoteRow(row) : decodeStored(row, checkedLocationDocument);
  if (s.owner.kind === 'npc' && d.kind !== 'npc')
    throw new Error('Shopbesitzer muss ein NPC sein.');
  const name = 'title' in d ? d.title : d.name;
  if (
    d.id !== s.owner.id ||
    (s.owner.kind === 'location' && d.kind !== 'location') ||
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 1000
  )
    throw new Error('Shopbesitzer hat keine gültige Identität oder Bezeichnung.');
  return { name, unavailable: !!r.trashed };
}
function saveShop(db: SqliteDatabase, cam: string, s: Shop) {
  validateShopShape(s);
  const payload = json(s);
  db.prepare(
    'INSERT INTO shop VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, s.id, s.revision, payload, hash(payload));
}
export function shopRecord(db: SqliteDatabase, cam: string, id: string): Shop {
  const row = checkedQuery(db, 'SELECT * FROM shop WHERE campaign_id=? AND id=?', {
      campaign_id: 'text',
      id: 'text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    }).get(cam, id),
    s = decodeStored(row, shape.shop);
  const r = checkedRow(row, { id: 'text', revision: 'integer' });
  validateShopShape(s);
  if (s.id !== id || s.revision !== r.revision || s.id !== r.id)
    throw new Error('Shoprevision widersprüchlich.');
  return s;
}
function history(
  db: SqliteDatabase,
  cam: string,
  s: Shop,
  description: string,
  facts: import('../catalog/items-contracts').ShopHistoryFacts,
) {
  const id = randomUUID(),
    payload = json({ time: new Date().toISOString(), description, facts });
  db.prepare('INSERT INTO shop_event VALUES(?,?,?,?,?)').run(cam, s.id, id, payload, hash(payload));
  return id;
}
function restockThrough(db: SqliteDatabase, cam: string, id: string): bigint | null {
  let through: bigint | null = null;
  for (const row of checkedQuery(
    db,
    'SELECT shop_id,payload,checksum FROM shop_event WHERE campaign_id=? AND shop_id=?',
    { payload: 'text', checksum: 'text' },
  ).iterate(cam, id)) {
    const facts = checkedShopEvent(row).facts;
    if (!facts || facts.intervals === undefined || facts.instantMs === undefined) continue;
    const instant = facts.lastDueMs ?? facts.instantMs;
    if (typeof instant !== 'string' || !/^(0|[1-9][0-9]{0,29})$/.test(instant))
      throw new Error('Auffüllzeit im Shopverlauf beschädigt.');
    const value = BigInt(instant);
    if (through === null || value > through) through = value;
  }
  return through;
}
function restockTimeNotice(db: SqliteDatabase, cam: string, id: string): string | null {
  const through = restockThrough(db, cam, id),
    focus = checkedQuery(db, 'SELECT focus_id FROM live_state WHERE campaign_id=?', {
      focus_id: 'text',
    }).get(cam)?.focus_id;
  if (!focus) return null;
  let scene;
  try {
    scene = readLiveScene(db, cam, focus);
  } catch {
    return 'Scenezeit nicht verfügbar. Shopbestand bleibt unverändert.';
  }
  if (through === null || through <= BigInt(scene.clock.instantMs)) return null;
  return (
    'Auffüllungen bis ' +
    formatInstant(through.toString()) +
    ' bleiben erhalten. Die Gruppe im Fokus steht bei ' +
    formatInstant(scene.clock.instantMs) +
    '. Zeitangaben in Tagen zu je 24 Stunden.'
  );
}
function restockEvents(db: SqliteDatabase, cam: string) {
  const events: NonNullable<ShopView['restockEvents']> = [];
  for (const row of checkedQuery(
    db,
    "SELECT id,revision,payload,checksum FROM world_record WHERE campaign_id=? AND kind='calendar-event' ORDER BY id",
    { id: 'text', revision: 'integer', payload: 'text', checksum: 'text' },
  ).iterate(cam)) {
    const e = checkedCalendarEventRow(row);
    if (
      e.id !== checkedRow(row, { id: 'text', revision: 'integer' }).id ||
      e.revision !== checkedRow(row, { id: 'text', revision: 'integer' }).revision
    )
      throw new Error('Lieferereignis widerspricht seiner Identität.');
    events.push({
      id: e.id,
      revision: e.revision,
      name: e.name,
      startMs: e.startMs,
      repeatMs: e.repeatMs,
      trashed: e.trashed,
    });
  }
  return events;
}
function readRestockEvent(db: SqliteDatabase, cam: string, id: string) {
  const row = checkedQuery(
      db,
      "SELECT * FROM world_record WHERE campaign_id=? AND kind='calendar-event' AND id=?",
      {
        campaign_id: 'text',
        kind: 'text',
        id: 'text',
        revision: 'integer',
        payload: 'text',
        checksum: 'text',
      },
    ).get(cam, id),
    e = checkedCalendarEventRow(row);
  if (
    e.id !== checkedRow(row, { id: 'text', revision: 'integer' }).id ||
    e.revision !== checkedRow(row, { id: 'text', revision: 'integer' }).revision
  )
    throw new Error('Lieferereignis widerspricht seiner Identität.');
  return e;
}
function historyPage(
  db: SqliteDatabase,
  cam: string,
  id: string,
  after: string | null,
): ShopHistoryPage {
  const cursor =
    after === null
      ? null
      : checkedQuery(
          db,
          'SELECT rowid AS cursor FROM shop_event WHERE campaign_id=? AND shop_id=? AND id=?',
          { cursor: 'integer' },
        ).get(cam, id, after);
  if (after !== null && !cursor) throw Error('Seitenmarke gehört nicht zu diesem Shopverlauf.');
  const rows = cursor
    ? checkedQuery(
        db,
        'SELECT * FROM shop_event WHERE campaign_id=? AND shop_id=? AND rowid<? ORDER BY rowid DESC LIMIT 51',
        { campaign_id: 'text', shop_id: 'text', id: 'text', payload: 'text', checksum: 'text' },
      ).all(cam, id, cursor.cursor)
    : checkedQuery(
        db,
        'SELECT * FROM shop_event WHERE campaign_id=? AND shop_id=? ORDER BY rowid DESC LIMIT 51',
        { campaign_id: 'text', shop_id: 'text', id: 'text', payload: 'text', checksum: 'text' },
      ).all(cam, id);
  const entries = rows
    .slice(0, 50)
    .map((r) => ({ ...checkedShopEvent(r), id: checkedRow(r, { id: 'text' }).id }));
  return { shopId: id, entries, next: rows.length > 50 ? entries.at(-1)!.id : null };
}
export function readShopHistory(
  db: SqliteDatabase,
  cam: string,
  id: string,
  after: string | null,
): ShopHistoryPage {
  if (
    typeof id !== 'string' ||
    !id ||
    id.length > 1000 ||
    (after !== null && (typeof after !== 'string' || !after || after.length > 1000))
  )
    throw Error('Shopverlauf und Seitenmarke prüfen.');
  return db.transaction(() => {
    shopRecord(db, cam, id);
    return historyPage(db, cam, id, after);
  })();
}
export function readShop(db: SqliteDatabase, cam: string, id: string): ShopView {
  const s = shopRecord(db, cam, id),
    o = owner(db, cam, s),
    history = historyPage(db, cam, id, null);
  return {
    shop: s,
    ownerName: o.name,
    unavailable: o.unavailable || s.trashed,
    timeNotice: restockTimeNotice(db, cam, id),
    restockEvents: restockEvents(db, cam),
    items: [...new Set(s.stock.map((e) => e.reference.definitionId))].map((id) =>
      readItemDefinition(db, id),
    ),
    history: history.entries,
    historyNext: history.next,
  };
}
function listShops(
  db: SqliteDatabase,
  cam: string,
  includeTrashed: boolean,
  accept?: (s: Shop) => boolean,
): ShopSummary[] {
  const list: ShopSummary[] = [];
  for (const row of checkedQuery(db, 'SELECT id FROM shop WHERE campaign_id=?', {
    id: 'text',
  }).iterate(cam)) {
    let s: Shop | undefined;
    try {
      s = shopRecord(db, cam, row.id);
      const o = owner(db, cam, s),
        unavailable = o.unavailable || s.trashed;
      if ((!includeTrashed && unavailable) || (accept && !accept(s))) continue;
      list.push({
        id: s.id,
        name: s.name,
        revision: s.revision,
        ownerName: o.name,
        unavailable,
        problem: null,
      });
    } catch (error) {
      list.push({
        id: row.id,
        name: s?.name ?? 'Unlesbarer Shop',
        revision: null,
        ownerName: 'Zuordnung nicht geprüft',
        unavailable: true,
        problem:
          row.id + ': ' + (error instanceof Error ? error.message : 'Shopdaten nicht verfügbar.'),
      });
    }
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}
export function readShops(db: SqliteDatabase, cam: string, includeTrashed: boolean) {
  return listShops(db, cam, includeTrashed);
}
export function sceneShops(db: SqliteDatabase, cam: string, sceneId: string) {
  const scene = checkedQuery(
    db,
    'SELECT location_id FROM live_scene WHERE campaign_id=? AND id=?',
    { location_id: 'nullable-text' },
  ).get(cam, sceneId);
  if (!scene) throw new Error('Scene fehlt.');
  const actors = new Set(
    scenePreparation(db, cam, sceneId)
      .groups.flatMap((g) => g.actors)
      .filter((a) => !a.unavailable)
      .map((a) => a.id),
  );
  if (scene.location_id)
    for (const id of npcIdsAtLocation(db, cam, scene.location_id)) actors.add(id);
  return listShops(db, cam, false, (s) =>
    s.owner.kind === 'location' ? s.owner.id === scene.location_id : actors.has(s.owner.id),
  );
}

function sceneTime(db: SqliteDatabase, cam: string, id: string | null) {
  if (!id) return { sceneId: null, locationId: null, instantMs: null };
  const scene = readLiveScene(db, cam, id);
  if (scene.retired) throw new Error('Handelsgruppe ist archiviert.');
  return { sceneId: scene.id, locationId: scene.locationId, instantMs: scene.clock.instantMs };
}
function scheduleTime(
  db: SqliteDatabase,
  cam: string,
  shopId: string,
  basis: Extract<ItemShopCommand['action'], { kind: 'shop' }>['scheduleClock'],
) {
  if (basis) {
    const scene = readLiveScene(db, cam, basis.sceneId);
    if (scene.retired || scene.clock.revision !== basis.expectedRevision)
      throw new Error('Scenezeit für neue Auffüllregel geändert. Erneut ansehen.');
    const instant = BigInt(scene.clock.instantMs),
      through = restockThrough(db, cam, shopId);
    if (through !== null && instant < through)
      throw new Error(
        'Scenezeit liegt vor bestätigten Auffüllungen dieses Shops. Eine passende Zeitbasis wählen.',
      );
    return instant;
  }
  if (checkedQuery(db, 'SELECT 1 FROM live_state WHERE campaign_id=?', { '1': 'integer' }).get(cam))
    throw new Error(
      'Neue Auffüllregel benötigt eine ausdrücklich gewählte Scenezeit als Zeitbasis.',
    );
  return BigInt(readCampaignTime(db, cam).instantMs);
}
function checkedShop(
  db: SqliteDatabase,
  cam: string,
  s: Shop,
  expected: number | null,
  basis: Extract<ItemShopCommand['action'], { kind: 'shop' }>['scheduleClock'],
) {
  validateShopShape(s, true);
  const row = checkedQuery(db, 'SELECT revision FROM shop WHERE campaign_id=? AND id=?', {
    revision: 'integer',
  }).get(cam, s.id);
  if ((row?.revision ?? null) !== expected) throw new Error('Shop geändert. Bitte aktualisieren.');
  owner(db, cam, s);
  const prior = row ? shopRecord(db, cam, s.id) : null;
  const through = restockThrough(db, cam, s.id);
  for (const e of s.stock) {
    const d = readItemDefinition(db, e.reference.definitionId);
    e.reference = { ...e.reference, revision: d.revision };
    if (e.restock) {
      if (e.restock.nextDueMs === '0')
        e.restock.nextDueMs = (
          scheduleTime(db, cam, s.id, basis) + BigInt(e.restock.intervalMs)
        ).toString();
      if (through !== null && BigInt(e.restock.nextDueMs) <= through)
        throw new Error('Neue Fälligkeit würde bestätigte Auffüllungen dieses Shops wiederholen.');
    }
  }
  prepareRestockTables(
    s,
    prior,
    () => scheduleTime(db, cam, s.id, basis),
    through,
    (id) => readRestockEvent(db, cam, id),
  );
  return { ...s, revision: (expected ?? 0) + 1 };
}
export function restockDue(db: SqliteDatabase, cam: string, instantMs: string) {
  if (!/^(0|[1-9][0-9]{0,29})$/.test(instantMs)) throw new Error('Ungültige Auffüllzeit.');
  const current = BigInt(instantMs);
  for (const row of checkedQuery(db, 'SELECT id FROM shop WHERE campaign_id=?', { id: 'text' }).all(
    cam,
  )) {
    const s = shopRecord(db, cam, row.id);
    if (
      s.trashed ||
      (!s.stock.some((e) => e.restock && BigInt(e.restock.nextDueMs) <= current) &&
        !(s.restockTables ?? []).some(
          (t) => t.schedule?.nextDueMs != null && BigInt(t.schedule.nextDueMs) <= current,
        ))
    )
      continue;
    if (owner(db, cam, s).unavailable) continue;
    let changed = false;
    for (const e of s.stock) {
      const rule = e.restock;
      if (!rule || e.unique || BigInt(rule.nextDueMs) > current) continue;
      const firstDueMs = rule.nextDueMs,
        count = (current - BigInt(firstDueMs)) / BigInt(rule.intervalMs) + 1n,
        before = e.quantity,
        next =
          rule.mode === 'fill'
            ? BigInt(Math.max(e.quantity, rule.quantity))
            : BigInt(e.quantity) + count * BigInt(rule.quantity);
      if (next > 1000000n)
        throw new Error(
          'Automatisches Auffüllen überschreitet die Bestandsgrenze. Passe die Regel an.',
        );
      e.quantity = Number(next);
      rule.nextDueMs = (BigInt(rule.nextDueMs) + count * BigInt(rule.intervalMs)).toString();
      history(
        db,
        cam,
        s,
        'Automatisch aufgefüllt: ' + before + ' → ' + e.quantity + ' · ' + count + ' Fälligkeiten',
        {
          entryId: e.id,
          before,
          quantity: e.quantity,
          intervals: count.toString(),
          instantMs: current.toString(),
          firstDueMs,
          rule: { mode: rule.mode, quantity: rule.quantity, intervalMs: rule.intervalMs },
          lastDueMs: (BigInt(rule.nextDueMs) - BigInt(rule.intervalMs)).toString(),
        },
      );
      changed = true;
    }
    for (const table of s.restockTables ?? []) {
      const schedule = table.schedule;
      if (!schedule || schedule.nextDueMs === null || BigInt(schedule.nextDueMs) > current)
        continue;
      let event: ReturnType<typeof readRestockEvent> | null = null;
      if ('eventId' in schedule) {
        // An authored event revision is the trigger. Changes pause it until the GM rebinds.
        if (
          !checkedQuery(
            db,
            "SELECT 1 FROM world_record WHERE campaign_id=? AND kind='calendar-event' AND id=?",
            { '1': 'integer' },
          ).get(cam, schedule.eventId)
        )
          continue;
        event = readRestockEvent(db, cam, schedule.eventId);
        if (event.trashed || event.revision !== schedule.eventRevision) continue;
      }
      const firstDue = BigInt(schedule.nextDueMs),
        spacing = 'eventId' in schedule ? schedule.repeatMs : schedule.intervalMs,
        count = spacing ? (current - firstDue) / BigInt(spacing) + 1n : 1n;
      const rule = structuredClone(table),
        result = applyRandomRestock(db, s, table, table.seed, count, firstDue),
        lastDue = firstDue + (count - 1n) * BigInt(spacing ?? '0');
      schedule.nextDueMs = spacing ? String(lastDue + BigInt(spacing)) : null;
      history(
        db,
        cam,
        s,
        'Gewichtet aufgefüllt: ' +
          table.name +
          ' · ' +
          (event ? event.name + ' · ' : '') +
          count +
          ' Fälligkeiten · ' +
          deliverySummary(result.outcomes),
        {
          tableId: table.id,
          tableRevision: table.revision,
          rule,
          seed: table.seed,
          ...result,
          intervals: count.toString(),
          instantMs,
          firstDueMs: String(firstDue),
          lastDueMs: String(lastDue),
          ...(event
            ? { eventId: event.id, eventRevision: event.revision, eventName: event.name }
            : {}),
        },
      );
      changed = true;
    }
    if (changed) {
      s.revision++;
      saveShop(db, cam, s);
    }
  }
}
function deliverySummary(outcomes: { name: string; added: number }[]) {
  return outcomes.length
    ? outcomes
        .slice(0, 8)
        .map((o) => o.name + ' +' + o.added)
        .join(', ') + (outcomes.length > 8 ? ' · weitere ' + (outcomes.length - 8) + ' Waren' : '')
    : 'keine passenden Waren';
}
function applyRandomRestock(
  db: SqliteDatabase,
  shop: Shop,
  table: import('../catalog/items-contracts').ShopRestockTable,
  seed: string,
  count = 1n,
  firstDue?: bigint,
) {
  if (table.catalog) return drawCatalogRestock(db, shop, table, seed, count, firstDue);
  for (const entry of table.entries) {
    if (!/[1-9]/.test(entry.weight)) continue;
    const stock = shop.stock.find((e) => e.id === entry.entryId)!;
    if (readItemDefinition(db, stock.reference.definitionId).trashed)
      throw new Error('Ein Gegenstand der Auffülltabelle liegt im Papierkorb. Tabelle bearbeiten.');
  }
  return {
    outcomes: drawRestockTable(shop, table, seed, count, firstDue).map((outcome) => ({
      ...outcome,
      name: readItemDefinition(db, outcome.reference.definitionId, outcome.reference.revision).name,
    })),
  };
}
export function executeItemShop(
  db: SqliteDatabase,
  c: ItemShopCommand,
  guard: () => void,
): ItemShopAck {
  return db
    .transaction(() => {
      guard();
      if (!c.commandId || typeof c.commandId !== 'string')
        throw new Error('Änderungskennung fehlt.');
      const fp = hash(json({ campaignId: c.campaignId, action: c.action })),
        prior = checkedQuery(db, 'SELECT * FROM shop_receipt WHERE command_id=?', {
          command_id: 'text',
          campaign_id: 'text',
          fingerprint: 'text',
          payload: 'text',
          checksum: 'text',
        }).get(c.commandId);
      if (prior) {
        if (prior.campaign_id !== c.campaignId || prior.fingerprint !== fp)
          throw new Error('Änderungskennung anders verwendet.');
        return checkedShopReceipt(db, prior);
      }
      const a = c.action,
        cam = c.campaignId;
      let result: ItemShopAck;
      if (a.kind === 'definition') {
        result = { definition: saveItemDefinition(db, a.definition, a.expectedRevision) };
      } else if (a.kind === 'definition-trash') {
        const d = readItemDefinition(db, a.id);
        result = {
          definition: saveItemDefinition(db, { ...d, trashed: a.trashed }, a.expectedRevision),
        };
      } else if (a.kind === 'shop') {
        const s = checkedShop(
          db,
          cam,
          structuredClone(a.shop),
          a.expectedRevision,
          a.scheduleClock,
        );
        saveShop(db, cam, s);
        history(
          db,
          cam,
          s,
          a.expectedRevision === null ? 'Shop angelegt' : 'Bestand / Shop bearbeitet',
          { shop: s },
        );
        result = { shop: readShop(db, cam, s.id) };
      } else {
        const s = shopRecord(db, cam, a.shopId),
          o = owner(db, cam, s);
        if (s.revision !== a.expectedRevision || s.trashed || o.unavailable)
          throw new Error('Shop geändert oder Besitzer im Papierkorb.');
        const ledgerIds: string[] = [];
        if (a.kind === 'purchase') {
          qty(a.quantity);
          const e = s.stock.find((e) => e.id === a.entryId);
          if (!e || a.quantity > e.quantity)
            throw new Error('Menge überschreitet den Shopbestand.');
          const d = readItemDefinition(db, e.reference.definitionId);
          if (d.trashed || d.revision !== a.expectedDefinitionRevision)
            throw new Error('Gegenstand geändert oder im Papierkorb.');
          const member = checkedQuery(
            db,
            'SELECT active,membership_revision,scene_id FROM roster_member WHERE campaign_id=? AND id=?',
            { active: 'integer', membership_revision: 'integer', scene_id: 'nullable-text' },
          ).get(cam, a.characterId);
          if (!member?.active || member.membership_revision !== a.expectedMembershipRevision)
            throw new Error('Empfänger geändert oder inaktiv.');
          const time = sceneTime(db, cam, member.scene_id);
          const l: LedgerItem = {
            id: randomUUID(),
            characterId: a.characterId,
            revision: 1,
            reference: { ...e.reference, revision: d.revision },
            name: d.name,
            category: d.category,
            quantity: a.quantity,
            unitCopper: d.unitCopper,
            origin: 'purchase',
            status: 'received',
            actualSaleCopper: null,
            paidCopper: copper(a.actualGold),
            counterparty: s.name + ' · ' + o.name,
            counterpartyReference: { shopId: s.id, owner: s.owner },
            instanceId: e.instanceId,
            treasureId: null,
            combatId: null,
            ...time,
            recordedAt: new Date().toISOString(),
            parentId: null,
          };
          e.quantity -= a.quantity;
          saveLedger(db, cam, l);
          ledgerIds.push(l.id);
          event(db, cam, l.characterId, 'shop-purchase', { entry: l, shopId: s.id });
          history(db, cam, s, 'Kauf: ' + a.quantity + ' × ' + d.name, { entry: l });
        } else if (a.kind === 'sell') {
          qty(a.quantity);
          const l = readLedgerItem(db, cam, a.ledgerId),
            before = structuredClone(l);
          if (
            l.revision !== a.expectedLedgerRevision ||
            l.status !== 'received' ||
            a.quantity > l.quantity
          )
            throw new Error('Persönlicher Beutestand geändert.');
          const d = readItemDefinition(db, l.reference.definitionId);
          if (d.revision !== a.expectedDefinitionRevision)
            throw new Error('Gegenstandsdefinition geändert.');
          const member = checkedQuery(
            db,
            'SELECT scene_id FROM roster_member WHERE campaign_id=? AND id=?',
            { scene_id: 'nullable-text' },
          ).get(cam, l.characterId);
          if (!member) throw new Error('Verkäufer fehlt.');
          const part: LedgerItem = {
            ...l,
            ...sceneTime(db, cam, member.scene_id),
            id: randomUUID(),
            revision: 1,
            quantity: a.quantity,
            status: 'sold',
            actualSaleCopper: copper(a.actualGold),
            counterparty: s.name + ' · ' + o.name,
            counterpartyReference: { shopId: s.id, owner: s.owner },
            parentId: l.id,
            recordedAt: new Date().toISOString(),
          };
          delete part.currentName;
          delete part.currentUnitCopper;
          partitionLedgerPaidPrice(l, part);
          l.quantity -= a.quantity;
          l.revision++;
          saveLedger(db, cam, l);
          saveLedger(db, cam, part);
          ledgerIds.push(l.id, part.id);
          let e = shopStockForItem(s.stock, l);
          if (e) {
            if (e.unique && e.quantity) throw new Error('Einzelstück bereits im Shopbestand.');
            e.quantity += a.quantity;
            qty(e.quantity);
            e.reference.revision = d.revision;
          } else {
            const prices = a.newStockPrices
              ? {
                  buyCopper: copper(a.newStockPrices.buyGold),
                  sellCopper: copper(a.newStockPrices.sellGold),
                }
              : d.unitCopper === null
                ? null
                : { buyCopper: d.unitCopper, sellCopper: d.unitCopper };
            if (!prices)
              throw new Error(
                'Neuer Shopbestand mit unbekanntem Wert benötigt ausdrückliche Ankaufs- und Verkaufspreise.',
              );
            s.stock.push({
              id: randomUUID(),
              reference: { kind: 'authored', definitionId: d.id, revision: d.revision },
              quantity: a.quantity,
              unique: !!l.instanceId,
              instanceId: l.instanceId ?? null,
              ...prices,
              notes: a.notes,
              restock: null,
            });
          }
          event(db, cam, l.characterId, 'shop-sale', {
            before,
            portion: part,
            shopId: s.id,
            notes: a.notes,
          });
          history(db, cam, s, 'Verkauf an Shop: ' + a.quantity + ' × ' + d.name, { entry: part });
        } else if (a.kind === 'random-restock') {
          const table = s.restockTables?.find((t) => t.id === a.tableId);
          if (!table || table.revision !== a.expectedTableRevision)
            throw new Error('Warenauffülltabelle geändert. Bitte erneut laden.');
          const seed = table.seed + '|manual|' + c.commandId,
            delivery = applyRandomRestock(db, s, table, seed);
          history(
            db,
            cam,
            s,
            'Gewichtet aufgefüllt: ' + table.name + ' · ' + deliverySummary(delivery.outcomes),
            {
              tableId: table.id,
              tableRevision: table.revision,
              rule: structuredClone(table),
              seed,
              ...delivery,
            },
          );
        } else if (a.kind === 'restock') {
          qty(a.quantity);
          const e = s.stock.find((e) => e.id === a.entryId);
          if (!e || e.unique || !['fill', 'add'].includes(a.mode))
            throw new Error('Auffüllen benötigt einen Mengenstapel.');
          const before = e.quantity;
          e.quantity =
            a.mode === 'fill' ? Math.max(e.quantity, a.quantity) : e.quantity + a.quantity;
          qty(e.quantity, true);
          history(db, cam, s, 'Manuell aufgefüllt', {
            entryId: e.id,
            before,
            quantity: e.quantity,
            reason: a.reason,
          });
        } else throw new Error('Unbekannte Shopaktion.');
        s.revision++;
        saveShop(db, cam, s);
        result = { shop: readShop(db, cam, s.id), ledgerIds };
      }
      const payload = json(result);
      db.prepare('INSERT INTO shop_receipt VALUES(?,?,?,?,?)').run(
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
export function validateItemsBackup(db: SqliteDatabase) {
  validateCurrentItemDefinitions(db);
  validateItemDefinitionVersions(db);
  for (const row of checkedQuery(db, 'SELECT campaign_id,id FROM shop', {
    campaign_id: 'text',
    id: 'text',
  }).iterate())
    readShop(db, row.campaign_id, row.id);
  for (const row of checkedQuery(db, 'SELECT * FROM shop_event', {
    campaign_id: 'text',
    shop_id: 'text',
    id: 'text',
    payload: 'text',
    checksum: 'text',
  }).iterate())
    checkedShopEvent(row);
  for (const row of checkedQuery(db, 'SELECT * FROM shop_receipt', {
    command_id: 'text',
    campaign_id: 'text',
    fingerprint: 'text',
    payload: 'text',
    checksum: 'text',
  }).iterate())
    checkedShopReceipt(db, row);
}

export function checkedShopEventValue(value: unknown) {
  const v = shape.shop_event(value);
  if (!v.time || !Number.isFinite(Date.parse(v.time))) throw new Error('Shopverlauf beschädigt.');
  const f = v.facts;
  if (!f) return v;
  if (f.shop) validateShopShape(f.shop);
  if (f.entry) validateLedgerItem(f.entry);
  const id = (value: string) => !!value.trim() && value.length <= 1000;
  for (const value of [f.entryId, f.tableId, f.eventId, f.seed])
    if (value !== undefined && !id(value))
      throw new Error('Shopverlauf enthält ungültige Kennungen.');
  for (const value of [f.before, f.quantity]) if (value !== undefined) qty(value, true);
  for (const value of [f.tableRevision, f.eventRevision])
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 1))
      throw new Error('Shopverlauf enthält ungültige Revisionen.');
  for (const value of [f.instantMs, f.firstDueMs, f.lastDueMs])
    if (value !== undefined && !/^(0|[1-9][0-9]{0,29})$/.test(value))
      throw new Error('Auffüllzeit im Shopverlauf beschädigt.');
  if (
    f.intervals !== undefined &&
    (!/^[1-9][0-9]{0,29}$/.test(f.intervals) ||
      f.instantMs === undefined ||
      f.firstDueMs === undefined ||
      f.lastDueMs === undefined)
  )
    throw new Error('Auffüllfälligkeiten im Shopverlauf beschädigt.');
  if (f.rule) {
    if ('mode' in f.rule) {
      if (!['fill', 'add'].includes(f.rule.mode))
        throw new Error('Historische Auffüllvariante beschädigt.');
      qty(f.rule.quantity);
      if (!/^[1-9][0-9]{0,17}$/.test(f.rule.intervalMs))
        throw new Error('Historische Auffüllregel beschädigt.');
    } else {
      validateShopRestockTable(f.rule);
      if (f.tableId !== f.rule.id || f.tableRevision !== f.rule.revision)
        throw new Error('Historische Auffülltabelle widersprüchlich.');
    }
  }
  if (new Set((f.outcomes ?? []).map((o) => o.entryId)).size !== (f.outcomes ?? []).length)
    throw new Error('Doppelte historische Warenlieferung.');
  for (const o of f.outcomes ?? []) {
    if (
      !id(o.entryId) ||
      !id(o.reference.definitionId) ||
      !Number.isSafeInteger(o.reference.revision) ||
      o.reference.revision < 1
    )
      throw new Error('Historische Warenlieferungsreferenz beschädigt.');
    for (const n of [o.before, o.added, o.quantity]) qty(n, true);
    for (const price of [o.buyCopper, o.sellCopper])
      if (price !== undefined && !/^(0|[1-9][0-9]{0,17})$/.test(price))
        throw new Error('Historischer Warenpreis beschädigt.');
  }
  if (
    f.catalogPool &&
    (![f.catalogPool.eligible, f.catalogPool.excludedDamaged].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
      !/^[0-9a-f]{64}$/.test(f.catalogPool.fingerprint))
  )
    throw new Error('Historischer Kataloglieferstand beschädigt.');
  return v;
}
export function checkedShopEvent(row: unknown) {
  const value = decodeStored(row, checkedShopEventValue);
  if (
    row &&
    typeof row === 'object' &&
    'shop_id' in row &&
    value.facts?.shop &&
    row.shop_id !== value.facts.shop.id
  )
    throw new Error('Historischer Shopstand gehört zu einem anderen Shop.');
  return value;
}
export function checkedShopReceipt(db: SqliteDatabase, value: unknown): ItemShopAck {
  const row = checkedRow(value, { command_id: 'text', campaign_id: 'text', fingerprint: 'text' });
  const ack = decodeStored(value, shape.shop_receipt);
  if (
    !row.command_id ||
    !/^[0-9a-f]{64}$/.test(row.fingerprint) ||
    !checkedQuery(db, 'SELECT 1 FROM campaign WHERE id=?', { '1': 'integer' }).get(
      row.campaign_id,
    ) ||
    (!ack.definition && !ack.shop)
  )
    throw new Error('Shopbestätigung beschädigt. Originaldaten bleiben erhalten.');
  if (ack.definition) checkedDefinition(ack.definition);
  if (ack.shop) {
    validateShopShape(ack.shop.shop);
    for (const d of ack.shop.items) checkedDefinition(d);
    for (const event of ack.shop.history) {
      if (!event.id) throw new Error('Shopverlaufkennung fehlt in der Bestätigung.');
      // The receipt owns its historical facts; do not compare them to later stock.
      checkedShopEventValue(event);
      if (event.facts?.shop && event.facts.shop.id !== ack.shop.shop.id)
        throw new Error('Historischer Shopstand gehört zu einem anderen Shop.');
    }
  }
  if (
    ack.ledgerIds &&
    (ack.ledgerIds.some((id) => !id || id.length > 1000) ||
      new Set(ack.ledgerIds).size !== ack.ledgerIds.length)
  )
    throw new Error('Shopbestätigung enthält ungültige Beutekennungen.');
  return ack;
}
