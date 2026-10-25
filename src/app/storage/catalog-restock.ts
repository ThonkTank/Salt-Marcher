import { createHash, randomUUID } from 'node:crypto';
import type { Shop, ShopRestockTable } from '../items-contracts';
import { readItemDefinition, matchesItemDefinition } from './item-definitions';
import { drawRestockChoices, restockSpacing } from './shop-restock';

/** The surrounding receipt/time transaction fixes the current catalogue for this delivery. */
export function drawCatalogRestock(
  db: any,
  shop: Shop,
  table: ShopRestockTable,
  seed: string,
  periods: bigint,
  firstDue?: bigint,
) {
  const rule = table.catalog!,
    pool: { id: string; revision: number; name: string }[] = [],
    fingerprint = createHash('sha256');
  let excludedDamaged = 0;
  for (const row of db
    .prepare('SELECT id FROM authored_item UNION SELECT id FROM item_definition ORDER BY id')
    .iterate()) {
    let definition;
    try {
      definition = readItemDefinition(db, row.id);
    } catch {
      excludedDamaged++;
      continue;
    }
    if (definition.trashed || !matchesItemDefinition(definition, rule.filter)) continue;
    pool.push({ id: definition.id, revision: definition.revision, name: definition.name });
    fingerprint.update(JSON.stringify([definition.id, definition.revision]) + '\n');
  }
  const selected = drawRestockChoices(
      pool.map((d) => ({
        entryId: d.id,
        weight: '1',
        minimum: rule.minimum,
        maximum: rule.maximum,
      })),
      table.rolls,
      seed,
      periods,
      firstDue,
      restockSpacing(table),
    ),
    byId = new Map(pool.map((d) => [d.id, d]));
  const outcomes = selected.map((o) => {
    const d = byId.get(o.entryId)!;
    let stock = shop.stock.find(
      (s) => !s.unique && s.reference.definitionId === d.id && s.reference.revision === d.revision,
    );
    if (!stock) {
      if (shop.stock.length >= 1000)
        throw new Error(
          'Kataloglieferung würde mehr als 1.000 Shopzeilen erzeugen. Bestand oder Filter verkleinern.',
        );
      stock = {
        id: randomUUID(),
        reference: { kind: 'authored', definitionId: d.id, revision: d.revision },
        quantity: 0,
        unique: false,
        instanceId: null,
        buyCopper: rule.buyCopper,
        sellCopper: rule.sellCopper,
        notes: '',
        restock: null,
      };
      shop.stock.push(stock);
    }
    const before = stock.quantity;
    stock.quantity += o.added;
    if (!Number.isSafeInteger(stock.quantity) || stock.quantity > 1000000)
      throw new Error(
        'Kataloglieferung überschreitet die Bestandsgrenze. Menge oder Zeitraum verringern.',
      );
    return {
      entryId: stock.id,
      reference: { ...stock.reference },
      name: d.name,
      before,
      added: o.added,
      quantity: stock.quantity,
      buyCopper: stock.buyCopper,
      sellCopper: stock.sellCopper,
    };
  });
  return {
    outcomes,
    catalogPool: { eligible: pool.length, excludedDamaged, fingerprint: fingerprint.digest('hex') },
  };
}
