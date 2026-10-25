import { validShopInstant as instant } from '../runtime/shop-validation';
import { createHash } from 'node:crypto';
import { integerWeights } from '../campaign/generation-contracts';
import type { Shop, ShopRestockTable, ShopStock } from '../catalog/items-contracts';
import type { CalendarEvent } from '../runtime/world-contracts';

// A display name revises history metadata without restarting the delivery clock.
const authored = (t: ShopRestockTable) =>
  JSON.stringify({
    seed: t.seed,
    rolls: t.rolls,
    entries: t.entries,
    catalog: t.catalog ?? null,
    trigger:
      t.schedule &&
      ('eventId' in t.schedule
        ? { eventId: t.schedule.eventId, eventRevision: t.schedule.eventRevision }
        : t.schedule.intervalMs),
  });
export function prepareRestockTables(
  shop: Shop,
  prior: Shop | null,
  time: () => bigint,
  through: bigint | null,
  event: (id: string) => CalendarEvent,
) {
  for (const table of shop.restockTables ?? []) {
    const old = prior?.restockTables?.find((t) => t.id === table.id);
    const changed = !old || authored(old) !== authored(table);
    table.revision = old ? old.revision + (changed || old.name !== table.name ? 1 : 0) : 1;
    if (table.schedule) {
      if ('eventId' in table.schedule) {
        const s = table.schedule,
          e = event(s.eventId);
        if (e.trashed || e.revision !== s.eventRevision)
          throw new Error(
            'Lieferereignis geändert oder im Papierkorb. Ereignisbindung im Shop erneuern.',
          );
        s.repeatMs = e.repeatMs;
        if (changed || !old?.schedule || s.nextDueMs === '0') {
          const now = time(),
            start = BigInt(e.startMs),
            repeat = e.repeatMs ? BigInt(e.repeatMs) : null;
          s.nextDueMs =
            start > now
              ? String(start)
              : repeat
                ? String(start + ((now - start) / repeat + 1n) * repeat)
                : null;
        } else s.nextDueMs = old.schedule.nextDueMs;
      } else if (changed || !old?.schedule || table.schedule.nextDueMs === '0')
        table.schedule.nextDueMs = (time() + BigInt(table.schedule.intervalMs)).toString();
      else table.schedule.nextDueMs = old.schedule.nextDueMs!;
      if (
        table.schedule.nextDueMs !== null &&
        (!instant(table.schedule.nextDueMs) ||
          (through !== null && BigInt(table.schedule.nextDueMs) <= through))
      )
        throw new Error(
          'Neue Warenfälligkeit würde bestätigte Auffüllungen wiederholen oder ist nicht darstellbar.',
        );
    }
  }
}
/** Aggregate one deterministic stream before applying its selected stock changes. */
export function drawRestockChoices(
  entries: ShopRestockTable['entries'],
  rolls: number,
  seed: string,
  periods = 1n,
  firstDue?: bigint,
  spacing = '0',
) {
  const draws = periods * BigInt(rolls);
  if (draws > 100000n)
    throw new Error(
      'Mehr als 100.000 Warenziehungen in einem Zeitschritt. Zeit in kleineren Schritten bestätigen oder die Auffüllregel anpassen.',
    );
  if (!entries.length) return [];
  const weights = integerWeights(entries.map((e) => e.weight));
  let total = 0n;
  const edges = weights.map((w) => (total += w)),
    selected = new Map<string, number>();
  const random = (key: string) =>
    BigInt(
      '0x' +
        createHash('sha256')
          .update(seed + '|' + key)
          .digest('hex'),
    );
  for (let p = 0n; p < periods; p++)
    for (let draw = 0; draw < rolls; draw++) {
      const key =
        (firstDue === undefined ? 'manual' : (firstDue + p * BigInt(spacing)).toString()) +
        '|' +
        draw;
      const roll = random(key + '|entry') % total;
      let lo = 0,
        hi = edges.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (roll < edges[mid]!) hi = mid;
        else lo = mid + 1;
      }
      const entry = entries[lo]!,
        quantity =
          entry.minimum +
          Number(random(key + '|quantity') % BigInt(entry.maximum - entry.minimum + 1));
      selected.set(entry.entryId, (selected.get(entry.entryId) ?? 0) + quantity);
    }
  return [...selected].map(([entryId, added]) => ({ entryId, added }));
}
export function restockSpacing(table: ShopRestockTable) {
  const s = table.schedule;
  return s ? ('eventId' in s ? (s.repeatMs ?? '0') : s.intervalMs) : '0';
}
/** The caller owns the transaction. */
export function drawRestockTable(
  shop: Shop,
  table: ShopRestockTable,
  seed: string,
  periods = 1n,
  firstDue?: bigint,
) {
  const stockById = new Map<string, ShopStock>(shop.stock.map((s) => [s.id, s]));
  return drawRestockChoices(
    table.entries,
    table.rolls,
    seed,
    periods,
    firstDue,
    restockSpacing(table),
  ).map((o) => {
    const stock = stockById.get(o.entryId)!,
      before = stock.quantity;
    stock.quantity += o.added;
    if (!Number.isSafeInteger(stock.quantity) || stock.quantity > 1000000)
      throw new Error(
        'Gewichtete Auffüllung überschreitet die Bestandsgrenze. Menge oder Zeitraum verringern.',
      );
    return {
      entryId: stock.id,
      reference: { ...stock.reference },
      before,
      added: o.added,
      quantity: stock.quantity,
    };
  });
}
