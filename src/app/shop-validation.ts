import type { Shop } from './items-contracts';
import { integerWeights } from './generation-contracts';

export function validateShopQuantity(n: number, zero = false) {
  if (!Number.isSafeInteger(n) || n < (zero ? 0 : 1) || n > 1000000)
    throw new Error('Menge muss eine ganze Zahl bis 1.000.000 sein.');
}
function price(s: string) {
  if (typeof s !== 'string' || !/^(0|[1-9][0-9]{0,17})$/.test(s))
    throw new Error('Ungültiger Preis.');
}

/** Shared structural rules. Database ownership, revisions and schedule authority stay with Main. */
export function validateShopShape(s: Shop, pending = false) {
  const text = (v: unknown, max: number, nonempty = false) =>
    typeof v === 'string' && v.length <= max && (!nonempty || !!v.trim());
  if (
    !s ||
    !text(s.id, 1000, true) ||
    !Number.isSafeInteger(s.revision) ||
    s.revision < (pending ? 0 : 1) ||
    !text(s.name, 1000, true) ||
    !text(s.notes, 100000) ||
    typeof s.trashed !== 'boolean' ||
    !s.owner ||
    !['npc', 'location'].includes(s.owner.kind) ||
    !text(s.owner.id, 1000, true) ||
    !Array.isArray(s.stock) ||
    s.stock.length > 1000
  )
    throw new Error('Shopbeschreibung oder Revision ungültig.');
  const ids = new Set<string>(),
    instances = new Set<string>();
  for (const e of s.stock) {
    if (
      !e ||
      !text(e.id, 1000, true) ||
      ids.has(e.id) ||
      !e.reference ||
      e.reference.kind !== 'authored' ||
      !text(e.reference.definitionId, 1000, true) ||
      !Number.isSafeInteger(e.reference.revision) ||
      e.reference.revision < 1 ||
      !text(e.notes, 100000) ||
      typeof e.unique !== 'boolean'
    )
      throw new Error('Shopbestandszeile oder Gegenstandsreferenz ungültig.');
    ids.add(e.id);
    validateShopQuantity(e.quantity, true);
    price(e.buyCopper);
    price(e.sellCopper);
    if (e.unique) {
      if (
        e.quantity > 1 ||
        !text(e.instanceId, 1000, true) ||
        instances.has(e.instanceId!) ||
        e.restock !== null
      )
        throw new Error('Einzelstück benötigt eine eindeutige Identität und keine Auffüllregel.');
      instances.add(e.instanceId!);
    } else if (e.instanceId !== null)
      throw new Error('Mengenstapel darf keine Einzelstückidentität haben.');
    if (e.restock !== null) {
      const r = e.restock;
      if (
        !r ||
        !['fill', 'add'].includes(r.mode) ||
        typeof r.intervalMs !== 'string' ||
        !/^[1-9][0-9]{0,17}$/.test(r.intervalMs) ||
        typeof r.nextDueMs !== 'string' ||
        !/^(0|[1-9][0-9]{0,29})$/.test(r.nextDueMs)
      )
        throw new Error(
          'Auffüllregel benötigt eine gültige Menge, ein positives Intervall und eine darstellbare Fälligkeit.',
        );
      validateShopQuantity(r.quantity);
    }
  }
  validateRestockTables(s, pending);
}

export const validShopInstant = (v: unknown) =>
  typeof v === 'string' && /^(0|[1-9][0-9]{0,29})$/.test(v);
const interval = (v: unknown) => typeof v === 'string' && /^[1-9][0-9]{0,17}$/.test(v);
const positive = (v: number, max = 1000000) => Number.isSafeInteger(v) && v > 0 && v <= max;
function validateRestockTables(shop: Shop, pending = false) {
  if (shop.restockTables === undefined) return;
  if (!Array.isArray(shop.restockTables) || shop.restockTables.length > 100)
    throw new Error('Ungültige Warenauffülltabellen.');
  const ids = new Set<string>();
  for (const table of shop.restockTables) {
    if (
      !table ||
      typeof table.id !== 'string' ||
      !table.id ||
      table.id.length > 1000 ||
      ids.has(table.id) ||
      !Number.isSafeInteger(table.revision) ||
      table.revision < (pending ? 0 : 1) ||
      typeof table.name !== 'string' ||
      !table.name.trim() ||
      table.name.length > 1000 ||
      typeof table.seed !== 'string' ||
      !table.seed.trim() ||
      table.seed.length > 1000 ||
      !positive(table.rolls, 100) ||
      !Array.isArray(table.entries) ||
      (!table.catalog && !table.entries.length) ||
      table.entries.length > 1000
    )
      throw new Error('Warenauffülltabelle benötigt Namen, Zufallsbasis und 1–100 Ziehungen.');
    ids.add(table.id);
    const entries = new Set<string>();
    for (const e of table.entries) {
      const stock = shop.stock.find((s) => s.id === e?.entryId);
      if (
        !e ||
        !stock ||
        stock.unique ||
        entries.has(e.entryId) ||
        !positive(e.minimum) ||
        !positive(e.maximum) ||
        e.maximum < e.minimum
      )
        throw new Error(
          'Auffülltabelle benötigt eindeutige Mengenstapel mit gültigen Mindest-/Höchstmengen.',
        );
      entries.add(e.entryId);
    }
    if (table.catalog) {
      const c = table.catalog,
        f = c.filter,
        price = (v: unknown) => typeof v === 'string' && /^(0|[1-9][0-9]{0,17})$/.test(v);
      if (
        !f ||
        typeof f.search !== 'string' ||
        f.search.length > 1000 ||
        !['', 'coins', 'equipment', 'trade-goods', 'magic', 'other'].includes(f.category) ||
        !['', 'yes', 'no'].includes(f.magic) ||
        typeof f.rarity !== 'string' ||
        f.rarity.length > 1000 ||
        !['', 'no', 'yes', 'unspecified'].includes(f.attunement) ||
        !['', 'authored', 'srd51'].includes(f.source ?? '') ||
        !positive(c.minimum) ||
        !positive(c.maximum) ||
        c.minimum > c.maximum ||
        !price(c.buyCopper) ||
        !price(c.sellCopper)
      )
        throw new Error('Kataloglieferung benötigt gültige Filter, Mengenbereiche und Preise.');
    }
    if (!table.catalog && !integerWeights(table.entries.map((e) => e.weight)).some((w) => w > 0n))
      throw new Error('Mindestens ein Warengewicht muss positiv sein.');
    const s = table.schedule;
    if (s !== null) {
      if (!s || typeof s !== 'object') throw new Error('Ungültiger Lieferauslöser.');
      if ('eventId' in s) {
        if (
          typeof s.eventId !== 'string' ||
          !s.eventId.trim() ||
          s.eventId.length > 1000 ||
          !positive(s.eventRevision, Number.MAX_SAFE_INTEGER) ||
          (s.repeatMs !== null && (!validShopInstant(s.repeatMs) || s.repeatMs === '0')) ||
          (s.nextDueMs !== null && !validShopInstant(s.nextDueMs))
        )
          throw new Error('Warenlieferung benötigt eine gültige Ereignisbindung.');
      } else if (!interval(s.intervalMs) || !validShopInstant(s.nextDueMs))
        throw new Error(
          'Warenauffülltabelle benötigt ein positives Intervall und eine gültige Fälligkeit.',
        );
    }
  }
}
