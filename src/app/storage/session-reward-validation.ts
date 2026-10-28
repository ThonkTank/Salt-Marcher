import { budgetRarities } from '../atlas/dungeon-budget-contracts';
import type { SessionLootGuidance } from '../campaign/session-contracts';
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
