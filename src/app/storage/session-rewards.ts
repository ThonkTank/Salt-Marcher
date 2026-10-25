import {
  emptyMagic,
  magicRules,
  magicGuidance,
  rewardIsMagic,
  fitMagicItems,
  checkedMagicPool,
} from './session-magic';
import { budgetRarity, budgetRarities } from '../dungeon-budget-contracts';
import type {
  SessionProfile,
  SessionLootGuidance,
  SessionProposal,
  SessionGenerationRequest,
  SessionLootBasis,
  SessionRun,
} from '../session-contracts';
import { canonicalJson } from '../generation/canonical-json';
import type { ItemInput } from '../progression';
import { copper, xpShare } from '../progression';
import { cumulativeGoldCopper, type RewardGuidanceRules } from '../generation/reward-guidance';
import { readGeneratorRegistry } from './generation';
import {
  readProgressCharacter,
  ledgerRewardValue,
  readLedgerDefinition,
  ledgerRewardQuantity,
  checkedLedgerRow,
} from './progression';
import { readItemDefinition } from './item-definitions';
/** Validate the saved calculation itself; current XP, prices and presets may have changed. */
export function checkedSessionLootGuidance(
  g: SessionLootGuidance,
  count: number,
): SessionLootGuidance {
  const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
  const id = (v: any) => typeof v === 'string' && !!v.trim() && v.length <= 1000;
  const unsigned = (v: any) => Number.isSafeInteger(v) && v >= 0;
  const amount = (v: any, signed = false) =>
    typeof v === 'string' && v.length <= 100 && (signed ? /^-?\d+$/ : /^\d+$/).test(v);
  if (
    !object(g) ||
    !['cumulative-gold-v1', 'cumulative-gold-magic-v2'].includes(g.version) ||
    !object(g.preset) ||
    !id(g.preset.id) ||
    !unsigned(g.preset.revision) ||
    g.preset.revision < 1 ||
    typeof g.preset.hash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(g.preset.hash) ||
    !unsigned(g.rewardXp) ||
    ![
      g.expectedBeforeCopper,
      g.expectedAfterCopper,
      g.receivedCopper,
      g.baselineCopper,
      g.targetCopper,
    ].every((v) => amount(v)) ||
    !amount(g.differenceCopper, true) ||
    !Array.isArray(g.allocationsCopper) ||
    g.allocationsCopper.length !== count ||
    !g.allocationsCopper.every((v) => amount(v)) ||
    !Array.isArray(g.characters) ||
    !g.characters.length ||
    g.characters.length > 1000
  )
    throw new Error('Beuteausgleich der Vorschau beschädigt.');
  if (g.basis !== undefined) {
    const b = g.basis;
    if (
      !object(b) ||
      !Array.isArray(b.ledger) ||
      !Array.isArray(b.definitions) ||
      new Set(b.ledger.map((v) => v?.id)).size !== b.ledger.length ||
      new Set(b.definitions.map((v) => v?.definitionId)).size !== b.definitions.length ||
      b.ledger.some(
        (v) =>
          !object(v) ||
          !id(v.id) ||
          !id(v.characterId) ||
          !unsigned(v.revision) ||
          v.revision < 1 ||
          !g.characters.some((c) => c.characterId === v.characterId),
      ) ||
      b.definitions.some(
        (v) => !object(v) || !id(v.definitionId) || !unsigned(v.revision) || v.revision < 1,
      )
    )
      throw new Error('Beutegrundlage der Vorschau beschädigt.');
  }
  for (const c of g.characters)
    if (
      !object(c) ||
      !id(c.characterId) ||
      typeof c.name !== 'string' ||
      c.name.length > 1000 ||
      !unsigned(c.xp) ||
      !unsigned(c.revision) ||
      ![c.receivedCopper, c.expectedBeforeCopper, c.expectedAfterCopper].every((v) => amount(v)) ||
      BigInt(c.expectedAfterCopper) < BigInt(c.expectedBeforeCopper)
    )
      throw new Error('Figur des Beuteausgleichs beschädigt.');
  const sum = (key: 'expectedBeforeCopper' | 'expectedAfterCopper' | 'receivedCopper') =>
      g.characters.reduce((n, c) => n + BigInt(c[key]), 0n),
    before = sum('expectedBeforeCopper'),
    after = sum('expectedAfterCopper'),
    received = sum('receivedCopper'),
    target = after > received ? after - received : 0n;
  if (
    new Set(g.characters.map((c) => c.characterId)).size !== g.characters.length ||
    before !== BigInt(g.expectedBeforeCopper) ||
    after !== BigInt(g.expectedAfterCopper) ||
    received !== BigInt(g.receivedCopper) ||
    after - before !== BigInt(g.baselineCopper) ||
    before - received !== BigInt(g.differenceCopper) ||
    target !== BigInt(g.targetCopper) ||
    g.allocationsCopper.reduce((n, v) => n + BigInt(v), 0n) !== target
  )
    throw new Error('Beuteausgleich hat widersprüchliche Summen oder doppelte Figuren.');
  if (g.version === 'cumulative-gold-magic-v2') {
    const m = g.magic,
      counts = (v: any) => object(v) && budgetRarities.every((r) => unsigned(v[r])),
      expectation = (v: any) =>
        object(v) && budgetRarities.every((r) => Number.isFinite(v[r]) && v[r] >= 0);
    if (
      !object(m) ||
      !expectation(m!.expectedBefore) ||
      !expectation(m!.expectedAfter) ||
      !counts(m!.received) ||
      !counts(m!.target) ||
      !counts(m!.missing) ||
      !Array.isArray(m!.allocations) ||
      m!.allocations.length !== count ||
      !m!.allocations.every(counts) ||
      !Array.isArray(m!.warnings) ||
      m!.warnings.some((w) => typeof w !== 'string') ||
      !Array.isArray(m!.characters) ||
      m!.characters.length !== g.characters.length ||
      new Set(m!.characters.map((c) => c.characterId)).size !== m!.characters.length
    )
      throw new Error('Magischer Beuteausgleich beschädigt.');
    if (m!.pool !== undefined) {
      const pool = m!.pool;
      if (
        !Array.isArray(pool) ||
        pool.length > 100 ||
        new Set(pool.map((v) => v?.definitionId)).size !== pool.length ||
        pool.some(
          (v) =>
            !object(v) ||
            !id(v.definitionId) ||
            !unsigned(v.revision) ||
            v.revision < 1 ||
            typeof v.name !== 'string' ||
            !v.name.trim() ||
            v.name.length > 1000 ||
            !budgetRarities.includes(v.rarity),
        )
      )
        throw new Error('Magiebeutepool der Vorschau beschädigt.');
    }
    for (const c of m!.characters)
      if (
        !object(c) ||
        !counts(c.received) ||
        !g.characters.some((a) => a.characterId === c.characterId)
      )
        throw new Error('Magischer Beuteausgleich gehört zu anderen Figuren.');
    for (const r of budgetRarities)
      if (
        m!.expectedAfter[r] < m!.expectedBefore[r] ||
        m!.characters.reduce((n, c) => n + c.received[r], 0) !== m!.received[r] ||
        m!.allocations.reduce((n, c) => n + c[r], 0) !== m!.target[r] ||
        m!.missing[r] > m!.target[r]
      )
        throw new Error('Magischer Beuteausgleich hat widersprüchliche Summen.');
  } else if (g.magic !== undefined) throw new Error('Magischer Beuteausgleich benötigt Version 2.');
  return g;
}
function rulesOf(value: unknown): RewardGuidanceRules {
  const r = value as RewardGuidanceRules;
  if (
    !r ||
    !Array.isArray(r.progression) ||
    r.progression.length !== 20 ||
    r.progression.some(
      (p, i) =>
        p.level !== i + 1 ||
        !Number.isSafeInteger(p.xpAtLevel) ||
        p.xpAtLevel < 0 ||
        !Number.isSafeInteger(p.goldAtLevelCp) ||
        p.goldAtLevelCp < 0 ||
        (i > 0 &&
          (p.xpAtLevel <= r.progression[i - 1]!.xpAtLevel ||
            p.goldAtLevelCp < r.progression[i - 1]!.goldAtLevelCp)),
    ) ||
    r.progression[0]!.xpAtLevel !== 0
  )
    throw new Error(
      'Das wirksame Preset benötigt die vollständige Beute-Fortschrittskurve. Automatischen Beuteausgleich ausschalten oder Preset korrigieren.',
    );
  return r;
}
export function sessionLootGuidance(
  db: any,
  cam: string,
  p: SessionProfile,
  proposals: SessionProposal[],
  withMagic = false,
): SessionLootGuidance {
  if (
    !p.party.length ||
    new Set(p.party.map((c) => c.id)).size !== p.party.length ||
    p.party.some((c) => c.count !== 1)
  )
    throw new Error(
      'Automatischer Beuteausgleich benötigt einzelne Roster-Figuren, jede mit Anzahl 1. Freie Planungszeilen weiter ohne automatischen Ausgleich verwenden.',
    );
  const registry = readGeneratorRegistry(db, cam),
    preset = registry.presets.find((p) => p.id === registry.effectiveId)!,
    rules = rulesOf(preset.config.loot),
    ids = new Set(p.party.map((c) => c.id)),
    received = new Map<string, bigint>();
  for (const id of ids) received.set(id, 0n);
  const magicReceived = new Map(p.party.map((c) => [c.id, emptyMagic()]));
  if (withMagic) magicRules(rules);
  const ledger: SessionLootBasis['ledger'] = [],
    definitions = new Map<string, number>();
  const members = db
    .prepare('SELECT id FROM roster_member WHERE campaign_id=?')
    .all(cam)
    .map((r: any) => r.id);
  for (const id of ids)
    if (!members.includes(id))
      throw new Error(
        'Planungsfigur fehlt im Roster. Für Beuteausgleich vorhandene Figuren wählen.',
      );
  for (const row of db.prepare('SELECT * FROM character_ledger WHERE campaign_id=?').iterate(cam)) {
    if (!ids.has(row.character_id)) continue;
    const item = checkedLedgerRow(row),
      definition = readLedgerDefinition(db, item);
    if (item.origin !== 'purchase' && item.origin !== 'transfer') {
      ledger.push({
        id: item.id,
        characterId: item.characterId,
        revision: item.revision,
      });
      definitions.set(definition.id, definition.revision);
    }
    if (withMagic && definition.magic) {
      const quantity = ledgerRewardQuantity(db, cam, item),
        rarity = budgetRarity(definition.rarity);
      if (quantity && !rarity)
        throw new Error(
          'Erhaltene Magiebeute besitzt keine bekannte Seltenheit: ' +
            definition.name +
            '. Im Katalog klären oder magischen Ausgleich ausschalten.',
        );
      if (rarity) magicReceived.get(row.character_id)![rarity] += quantity;
      continue;
    }
    const value = ledgerRewardValue(db, cam, item);
    if (value === null)
      throw new Error(
        'Ein erhaltener Beutewert ist unbekannt. Wert im Ledger/Katalog klären oder automatischen Ausgleich ausschalten.',
      );
    received.set(row.character_id, received.get(row.character_id)! + value);
  }
  const rewardXp = proposals.reduce(
      (n, p) => n + p.encounter.assessment.baseXp + (p.reward?.poolXp ?? 0),
      0,
    ),
    perCharacter = proposals.reduce(
      (n, p) =>
        n + xpShare(p.encounter.assessment.baseXp + (p.reward?.poolXp ?? 0), ids.size).share,
      0,
    ),
    characters = p.party.map((c) => {
      const progress = readProgressCharacter(db, cam, c.id);
      if (progress.xp === null)
        throw new Error(
          'Für ' +
            c.name +
            ' fehlen bestätigte XP. Beuteausgleich benötigt XP, nicht nur ein Planungslevel.',
        );
      return {
        characterId: c.id,
        name: c.name,
        xp: progress.xp,
        revision: progress.revision,
        receivedCopper: String(received.get(c.id)!),
        expectedBeforeCopper: cumulativeGoldCopper(progress.xp, rules),
        expectedAfterCopper: cumulativeGoldCopper(progress.xp + perCharacter, rules),
      };
    });
  const sum = (key: 'expectedBeforeCopper' | 'expectedAfterCopper' | 'receivedCopper') =>
      characters.reduce((n, c) => n + BigInt(c[key]), 0n),
    before = sum('expectedBeforeCopper'),
    after = sum('expectedAfterCopper'),
    actual = sum('receivedCopper'),
    target = after > actual ? after - actual : 0n,
    part = target / BigInt(proposals.length),
    rest = target % BigInt(proposals.length);
  return checkedSessionLootGuidance(
    {
      basis: {
        ledger,
        definitions: [...definitions].map(([definitionId, revision]) => ({
          definitionId,
          revision,
        })),
      },
      ...(withMagic
        ? {
            magic: magicGuidance(characters, magicReceived, perCharacter, proposals.length, rules),
          }
        : {}),
      version: withMagic ? 'cumulative-gold-magic-v2' : 'cumulative-gold-v1',
      preset: { id: preset.id, revision: preset.revision, hash: preset.hash },
      rewardXp,
      expectedBeforeCopper: String(before),
      expectedAfterCopper: String(after),
      receivedCopper: String(actual),
      baselineCopper: String(after - before),
      differenceCopper: String(before - actual),
      targetCopper: String(target),
      allocationsCopper: proposals.map((_, i) => String(part + (BigInt(i) < rest ? 1n : 0n))),
      characters,
    },
    proposals.length,
  );
}
/** Recheck the observed inputs, without rebudgeting or replacing any authored reward. */
export function assertSessionRewardBasisCurrent(
  db: any,
  cam: string,
  p: SessionProfile,
  run: SessionRun,
  proposal: SessionProposal,
) {
  if (p.revision !== run.profileRevision)
    throw new Error('Planungsparty geändert. Vorschau neu erzeugen.');
  const prior = run.lootGuidance;
  if (prior) {
    if (!prior.basis)
      throw new Error(
        'Beutevorschlag besitzt keine prüfbare Grundlage. Vorschau neu erzeugen; gespeicherte Inhalte bleiben erhalten.',
      );
    if (prior.magic?.pool) checkedMagicPool(db, prior.magic.pool);
    const current = sessionLootGuidance(db, cam, p, run.proposals, !!prior.magic);
    const inputs = (g: SessionLootGuidance) => ({
      preset: g.preset,
      characters: g.characters.map((c) => ({
        characterId: c.characterId,
        xp: c.xp,
      })),
      basis: {
        ledger: [...g.basis!.ledger].sort((a, b) => a.id.localeCompare(b.id)),
        definitions: [...g.basis!.definitions].sort((a, b) =>
          a.definitionId.localeCompare(b.definitionId),
        ),
      },
      receivedCopper: g.receivedCopper,
      magic: g.magic?.received,
    });
    if (canonicalJson(inputs(prior)) !== canonicalJson(inputs(current)))
      throw new Error(
        'Beutegrundlage oder XP geändert. Vorschau neu erzeugen; eigene Bearbeitungen bleiben erhalten.',
      );
  }
  for (const item of proposal.reward?.items ?? []) {
    if (!item.reference) continue;
    const definition = readItemDefinition(db, item.reference.definitionId);
    if (definition.trashed || definition.revision !== item.reference.revision)
      throw new Error('Katalogbeute geändert. Belohnung erneut auswählen oder erzeugen.');
  }
}
export function rewardItemCopper(db: any, item: ItemInput): bigint {
  const value = item.reference
    ? readItemDefinition(db, item.reference.definitionId, item.reference.revision).unitCopper
    : copper(item.valueGold);
  if (value === null) throw new Error('Geplante Beute benötigt einen bekannten Wert.');
  return BigInt(value) * BigInt(item.quantity);
}
/** Keep table flavor when it fits, reduce quantities to the slice, fill the exact remainder with coin stacks. */
export function fitRewardItems(db: any, items: ItemInput[], budget: string): ItemInput[] {
  let remaining = BigInt(budget);
  const result: ItemInput[] = [];
  for (const item of items) {
    const total = rewardItemCopper(db, item),
      unit = total / BigInt(item.quantity),
      quantity =
        unit === 0n
          ? item.quantity
          : Number(
              remaining / unit > BigInt(item.quantity) ? BigInt(item.quantity) : remaining / unit,
            );
    if (quantity) {
      result.push({ ...structuredClone(item), quantity });
      remaining -= unit * BigInt(quantity);
    }
  }
  for (const [name, unit, valueGold] of [
    ['Goldmünzen', 100n, '1'],
    ['Silbermünzen', 10n, '0.1'],
    ['Kupfermünzen', 1n, '0.01'],
  ] as const) {
    let count = remaining / unit;
    remaining %= unit;
    while (count) {
      const portion = count > 1000000n ? 1000000n : count;
      result.push({
        name,
        quantity: Number(portion),
        valueGold,
        category: 'coins',
      });
      count -= portion;
      if (result.length > 100)
        throw new Error(
          'Automatischer Münzvorschlag zu groß. Weniger Szenenbudget oder andere Beutetabellen wählen.',
        );
    }
  }
  if (result.length > 100) throw new Error('Höchstens 100 Beuteeinträge pro Vorschlag.');
  return result;
}
export function fitSessionReward(
  db: any,
  items: ItemInput[],
  guidance: SessionLootGuidance,
  index: number,
  seed: string,
) {
  if (!guidance.magic)
    return {
      items: fitRewardItems(db, items, guidance.allocationsCopper[index]!),
      warnings: [],
      missing: emptyMagic(),
    };
  const mundane = fitRewardItems(
      db,
      items.filter((i) => !rewardIsMagic(db, i)),
      guidance.allocationsCopper[index]!,
    ),
    magic = fitMagicItems(
      db,
      items.filter((i) => rewardIsMagic(db, i)),
      guidance.magic.allocations[index]!,
      seed,
      guidance.magic.pool,
      100 - mundane.length,
    ),
    combined = [...mundane, ...magic.items];
  if (combined.length > 100) throw new Error('Höchstens100 Beuteeinträge pro Vorschlag.');
  return { ...magic, items: combined };
}
export function applyLootGuidance(
  db: any,
  cam: string,
  profile: SessionProfile,
  proposals: SessionProposal[],
  withMagic = false,
  pool?: SessionGenerationRequest['magicPool'],
) {
  if (pool !== undefined && !withMagic)
    throw new Error('Ein Gegenstandspool benötigt den magischen Beuteausgleich.');
  const guidance = sessionLootGuidance(db, cam, profile, proposals, withMagic);
  if (pool !== undefined) guidance.magic!.pool = checkedMagicPool(db, pool);
  for (const [index, p] of proposals.entries()) {
    const result = fitSessionReward(
      db,
      p.reward?.items ?? [],
      guidance,
      index,
      profile.seed + '|reward|' + index,
    );
    p.reward = { poolXp: p.reward?.poolXp ?? 0, items: result.items };
    if (guidance.magic) {
      p.rewardWarnings = result.warnings;
      p.rewardMissingMagic = result.missing;
    }
    if (guidance.magic) {
      for (const r of Object.keys(result.missing) as (keyof typeof result.missing)[])
        guidance.magic.missing[r] += result.missing[r];
      guidance.magic.warnings.push(...result.warnings);
    }
  }
  if (guidance.magic) guidance.magic.warnings = [...new Set(guidance.magic.warnings)];
  return guidance;
}
