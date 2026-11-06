import { createHash } from 'node:crypto';
import { budgetRarities, budgetRarity, type BudgetRarity } from '../atlas/dungeon-budget-contracts';
import type {
  SessionLootGuidance,
  SessionMagicGuidance,
  SessionMagicPoolItem,
  SessionGenerationRequest,
} from '../campaign/session-contracts';
import type { ItemInput } from '../catalog/item-input-contracts';
import type { RewardGuidanceRules } from '../campaign/generation/reward-guidance';
import { cumulativeMagicGuidance } from '../campaign/generation/reward-guidance';
import { readItemDefinition } from './item-definitions';
import type { ItemDefinition } from '../catalog/item-definition-contracts';
export const emptyMagic = () =>
  Object.fromEntries(budgetRarities.map((r) => [r, 0])) as Record<BudgetRarity, number>;
export function magicRules(rules: RewardGuidanceRules) {
  if (
    rules.progression.some(
      (p) =>
        !p.magicPerXp ||
        budgetRarities.some((r) => !Number.isFinite(p.magicPerXp[r]) || p.magicPerXp[r] < 0),
    )
  )
    throw new Error(
      'Das Preset benötigt vollständige nichtnegative Magiequoten. Magischen Ausgleich ausschalten oder Preset korrigieren.',
    );
}
export function magicGuidance(
  characters: SessionLootGuidance['characters'],
  received: Map<string, Record<BudgetRarity, number>>,
  rewardXp: number,
  count: number,
  rules: RewardGuidanceRules,
): SessionMagicGuidance {
  const before = cumulativeMagicGuidance(
      characters.map((c) => c.xp),
      rules,
    ),
    after = cumulativeMagicGuidance(
      characters.map((c) => c.xp + rewardXp),
      rules,
    ),
    actual = emptyMagic(),
    target = emptyMagic();
  for (const c of characters)
    for (const r of budgetRarities) actual[r] += received.get(c.characterId)![r];
  for (const r of budgetRarities) target[r] = Math.max(0, after.quota[r] - actual[r]);
  return {
    expectedBefore: before.expected,
    expectedAfter: after.expected,
    received: actual,
    target,
    allocations: Array.from(
      { length: count },
      (_, i) =>
        Object.fromEntries(
          budgetRarities.map((r) => [
            r,
            Math.floor(target[r] / count) + (i < target[r] % count ? 1 : 0),
          ]),
        ) as Record<BudgetRarity, number>,
    ),
    missing: emptyMagic(),
    warnings: [],
    characters: characters.map((c) => ({
      characterId: c.characterId,
      received: { ...received.get(c.characterId)! },
    })),
  };
}
export function rewardIsMagic(db: any, item: ItemInput) {
  return item.reference
    ? readItemDefinition(db, item.reference.definitionId, item.reference.revision).magic
    : item.category === 'magic';
}
export function checkedMagicPool(
  db: any,
  input: NonNullable<SessionGenerationRequest['magicPool']>,
): SessionMagicPoolItem[] {
  if (
    !Array.isArray(input) ||
    input.length > 100 ||
    new Set(input.map((r) => r?.definitionId)).size !== input.length
  )
    throw new Error('Magiebeutepool benötigt höchstens 100 eindeutige Gegenstände.');
  return input.map((ref) => {
    const d = readItemDefinition(db, ref?.definitionId),
      rarity = budgetRarity(d.rarity);
    if (d.trashed || !d.magic || !rarity || d.revision !== ref.revision)
      throw new Error(
        d.name +
          ': Poolauswahl geändert oder keine aktive Magiebeute mit bekannter Seltenheit. Gegenstand im Pool erneut auswählen.',
      );
    return { definitionId: d.id, revision: d.revision, name: d.name, rarity };
  });
}
/** Scoped pools never escape into the installation catalog; keep only small candidate projections. */
export function fitMagicItems(
  db: any,
  items: ItemInput[],
  target: Record<BudgetRarity, number>,
  seed: string,
  scope?: SessionMagicPoolItem[],
  maxEntries = 100,
) {
  const remaining = { ...target },
    result: ItemInput[] = [],
    warnings: string[] = [],
    allowed = scope === undefined ? null : new Map(scope.map((r) => [r.definitionId, r.revision]));
  const used = new Set<string>();
  for (const item of items) {
    if (!item.reference) {
      warnings.push(
        'Magische Tabellenbeute ohne Katalogreferenz wurde durch die Seltenheitsauswahl ersetzt: ' +
          item.name,
      );
      continue;
    }
    if (allowed && allowed.get(item.reference.definitionId) !== item.reference.revision) {
      warnings.push('Tabellenbeute außerhalb des gewählten Pools ausgelassen: ' + item.name);
      continue;
    }
    if (allowed) {
      const current = readItemDefinition(db, item.reference.definitionId);
      if (current.trashed || current.revision !== item.reference.revision) {
        warnings.push('Poolgegenstand geändert oder im Papierkorb: ' + item.name);
        continue;
      }
    }
    const d = readItemDefinition(db, item.reference.definitionId, item.reference.revision),
      r = budgetRarity(d.rarity);
    if (!r || !d.magic) {
      warnings.push('Magische Tabellenbeute hat keine bekannte Seltenheit: ' + item.name);
      continue;
    }
    const quantity = Math.min(item.quantity, remaining[r]);
    if (quantity && result.length < maxEntries) {
      result.push({ ...structuredClone(item), quantity });
      remaining[r] -= quantity;
      used.add(d.id);
    }
  }
  type Choice = Pick<ItemDefinition, 'id' | 'revision' | 'name' | 'category' | 'unitCopper'> & {
    rank: string;
  };
  const pools = new Map<BudgetRarity, Choice[]>(),
    active = budgetRarities.filter((r) => remaining[r] > 0),
    slots = Math.max(0, maxEntries - result.length),
    perRarity = Math.min(12, Math.max(1, Math.floor(slots / Math.max(1, active.length))));
  let blocked = 0;
  if (slots && active.length) {
    const candidates: Iterable<{ id: string; revision?: number }> =
      scope === undefined
        ? db.prepare('SELECT id FROM authored_item UNION SELECT id FROM item_definition').iterate()
        : scope.map((r) => ({ id: r.definitionId, revision: r.revision }));
    for (const row of candidates) {
      try {
        const current = readItemDefinition(db, row.id);
        if (current.trashed) throw new Error('liegt im Papierkorb');
        if (row.revision !== undefined && row.revision !== current.revision)
          throw new Error(
            'gewählte Version geändert; Pool für einen neuen Vorschlag erneut zusammenstellen',
          );
        const d =
            row.revision === undefined ? current : readItemDefinition(db, row.id, row.revision),
          r = budgetRarity(d.rarity);
        if (!d.magic || !r || !remaining[r]) continue;
        const rank =
            (used.has(d.id) ? '1' : '0') +
            createHash('sha256')
              .update(seed + '|magic|' + r + '|' + d.id)
              .digest('hex'),
          pool = pools.get(r) ?? [];
        pool.push({
          id: d.id,
          revision: d.revision,
          name: d.name,
          category: d.category,
          unitCopper: d.unitCopper,
          rank,
        });
        pool.sort((a, b) => a.rank.localeCompare(b.rank));
        pool.length = Math.min(pool.length, perRarity, remaining[r]);
        pools.set(r, pool);
      } catch (error) {
        blocked++;
        if (blocked <= 20)
          warnings.push('Kataloggegenstand ' + row.id + ' gesperrt: ' + (error as Error).message);
      }
    }
  }
  if (blocked > 20)
    warnings.push(blocked - 20 + ' weitere gesperrte Kataloggegenstände wurden ausgelassen.');
  for (const r of active) {
    const choices = (pools.get(r) ?? []).slice(0, Math.max(0, maxEntries - result.length)),
      quantity = remaining[r];
    if (!choices.length) {
      warnings.push(
        r +
          ': ' +
          quantity +
          ' magische Gegenstände offen; ' +
          (scope === undefined ? 'im Katalog' : 'im gewählten Pool') +
          ' fehlt eine passende verfügbare Definition oder ein freier Beuteeintrag.',
      );
      continue;
    }
    for (const [i, d] of choices.entries()) {
      const count = Math.floor(quantity / choices.length) + (i < quantity % choices.length ? 1 : 0);
      if (count > 1000000) throw new Error('Magiebeute zu groß. Kleineren Spielabend planen.');
      const previous = result.find(
        (item) => item.reference?.definitionId === d.id && item.reference.revision === d.revision,
      );
      if (previous) {
        previous.quantity += count;
        if (previous.quantity > 1000000)
          throw new Error('Magiebeute zu groß. Kleineren Spielabend planen.');
      } else
        result.push({
          name: d.name,
          category: d.category,
          quantity: count,
          valueGold:
            d.unitCopper === null
              ? '0'
              : String(BigInt(d.unitCopper) / 100n) +
                '.' +
                String(BigInt(d.unitCopper) % 100n).padStart(2, '0'),
          reference: { kind: 'authored', definitionId: d.id, revision: d.revision },
        });
      remaining[r] -= count;
    }
  }
  return { items: result, missing: remaining, warnings: [...new Set(warnings)] };
}
