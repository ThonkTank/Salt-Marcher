import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { selectMagicItems } from '../../src/core/session-generation/magic-selection-stage.js'
import { selectNonMagicItems } from '../../src/core/session-generation/non-magic-selection-stage.js'
import { packTreasures } from '../../src/core/session-generation/packing-stage.js'
import { aggregateReward } from '../../src/core/session-generation/reward-aggregation-stage.js'
import { planSlotsAndRoles } from '../../src/core/session-generation/slot-role-stage.js'
import { planSessionTreasures } from '../../src/core/session-generation/treasure-planning-stage.js'
import type { LootRarity } from '../../src/core/session-generation/loot-catalog.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
import { sha256EncounterEntropy as entropy } from '../../src/utility/session-generation/sha256-entropy.js'

const catalog = new BundledEncounterCatalogProvider(
  join(process.cwd(), 'resources/sessiongeneration/catalog-2026-07-16')
).loadFull()
const seed = 179_974

function plans() {
  return planSessionTreasures(
    {
      seed,
      adventureDayFraction: '0.6',
      goldBudgetCp: 45_120,
      encounterNumbers: [1, 2],
      themes: catalog.themes
    },
    entropy
  )
}

function roles() {
  return planSlotsAndRoles(
    {
      profile: 'session',
      seed,
      adventureDayFraction: '0.6',
      treasures: plans().treasures
    },
    entropy
  )
}

function nonMagic() {
  return selectNonMagicItems({ seed, treasures: roles(), catalog }, entropy)
}

const oneCommon = {
  Common: 1,
  Uncommon: 0,
  Rare: 0,
  'Very Rare': 0,
  Legendary: 0
} satisfies Record<LootRarity, number>

describe('session generation pure reward stages', () => {
  it('plans budget channels and unique encounter anchors', () => {
    const output = plans()
    expect(output.treasures.map((entry) => entry.targetValueCp)).toEqual([
      45_120, 9_024
    ])
    expect(
      output.treasures
        .map((entry) => entry.anchorEncounterNumber)
        .filter((entry) => entry !== null)
    ).toEqual([1])
    expect(Object.isFrozen(output.treasures[0])).toBe(true)
  })

  it('plans one role per immutable slot', () => {
    const output = roles()
    expect(output.map((entry) => entry.roles)).toEqual([
      ['compact_value', 'compact_value', 'flavor'],
      ['useful', 'complex_value', 'complex_value']
    ])
    expect(output.every((entry) => Object.isFrozen(entry.roles))).toBe(true)
  })

  it('selects non-magic values without mutating role plans', () => {
    const source = roles()
    const output = selectNonMagicItems(
      { seed, treasures: source, catalog },
      entropy
    )
    expect(output.every((entry) => entry.items.length > 0)).toBe(true)
    expect(
      output[0]?.items.reduce((sum, item) => sum + item.totalValueCp, 0)
    ).toBe(45_120)
    expect('items' in source[0]!).toBe(false)
  })

  it('resolves exact magic targets independently of packing', () => {
    const output = selectMagicItems(
      { seed, treasures: nonMagic(), targets: oneCommon, catalog },
      entropy
    )
    expect(
      output.flatMap((entry) => entry.items).filter((item) => item.magic)
    ).toHaveLength(1)
    expect(output.every(Object.isFrozen)).toBe(true)
  })

  it('packs every assignment into its own Treasure', () => {
    const selected = selectMagicItems(
      { seed, treasures: nonMagic(), targets: oneCommon, catalog },
      entropy
    )
    const output = packTreasures(
      { seed, treasures: selected, catalog },
      entropy
    )
    expect(
      output.every((treasure) =>
        treasure.items.every(
          (item) =>
            item.containerId === null ||
            treasure.containers.some((entry) => entry.id === item.containerId)
        )
      )
    ).toBe(true)
    expect(output.every(Object.isFrozen)).toBe(true)
  })

  it('aggregates totals and structured integrity observations', () => {
    const selected = selectMagicItems(
      { seed, treasures: nonMagic(), targets: oneCommon, catalog },
      entropy
    )
    const treasures = packTreasures(
      { seed, treasures: selected, catalog },
      entropy
    )
    const output = aggregateReward({
      treasures,
      goldBudgetCp: 45_120,
      magicTargets: oneCommon,
      expectedTreasureCount: 2
    })
    expect(output.normalValueCp).toBe(45_120)
    expect(output.magicCount).toBe(1)
    expect(
      output.audits.filter((audit) => audit.hard).every((audit) => audit.passed)
    ).toBe(true)
  })
})
