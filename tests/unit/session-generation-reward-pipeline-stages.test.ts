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
  join(process.cwd(), 'resources/sessiongeneration/catalog-2026-08-16')
).loadFull()
const seed = 179_974
const runId = '00000000-0000-4000-8000-000000000099'

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
  return selectNonMagicItems(
    { runId, seed, treasures: roles(), catalog },
    entropy
  )
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
      ['complex_value', 'useful'],
      ['flavor', 'compact_value']
    ])
    expect(output.every((entry) => Object.isFrozen(entry.roles))).toBe(true)
  })

  it('selects non-magic values without mutating role plans', () => {
    const source = roles()
    const output = selectNonMagicItems(
      { runId, seed, treasures: source, catalog },
      entropy
    )
    expect(output.every((entry) => entry.items.length > 0)).toBe(true)
    expect(
      output[0]?.items.reduce(
        (sum, item) => sum + item.quantity * item.definition.unitValueCp,
        0
      )
    ).toBe(45_120)
    expect('items' in source[0]!).toBe(false)
  })

  it('resolves exact magic targets independently of packing', () => {
    const output = selectMagicItems(
      { runId, seed, treasures: nonMagic(), targets: oneCommon, catalog },
      entropy
    )
    expect(
      output
        .flatMap((entry) => entry.items)
        .filter((item) => item.definition.magic)
    ).toHaveLength(1)
    const magicTreasure = output.find((entry) =>
      entry.items.some((item) => item.definition.magic)
    )!
    const magicDefinition = magicTreasure.items.find(
      (item) => item.definition.magic
    )!.definition
    expect(
      catalog.magicItems.find(
        (item) => item.id === magicDefinition.components.magicItemId
      )?.type
    ).toBe(magicTreasure.theme.magicType)
    expect(output.every(Object.isFrozen)).toBe(true)
  })

  it('uses Sheet-style coin eligibility and contextual bulk quantities', () => {
    const zeroEntropy = {
      modulo: () => 0,
      unit: () => 0
    }
    const basePlan = plans().treasures[0]!
    const coin = selectNonMagicItems(
      {
        runId,
        seed,
        catalog,
        treasures: [{ ...basePlan, roles: ['compact_value'] }]
      },
      zeroEntropy
    )[0]!.items[0]!.definition
    expect(coin.components.coinDenominations.length).toBeGreaterThanOrEqual(2)
    expect(
      coin.components.coinDenominations.at(-1)?.quantity
    ).toBeGreaterThanOrEqual(5)
    expect(coin.unitValueCp).toBeLessThanOrEqual(basePlan.targetValueCp * 1.05)

    const bulk = selectNonMagicItems(
      {
        runId,
        seed,
        catalog,
        treasures: [{ ...basePlan, roles: ['complex_value'] }]
      },
      zeroEntropy
    )[0]!.items[0]!
    const bulkSource = catalog.items.find(
      (item) => item.id === bulk.definition.components.baseItemId
    )!
    expect(bulkSource.valueForm).toBe('Quantity_Good')
    expect(bulkSource.baseLb * bulk.quantity).toBeGreaterThanOrEqual(20)
  })

  it('packs every assignment into its own Treasure', () => {
    const selected = selectMagicItems(
      { runId, seed, treasures: nonMagic(), targets: oneCommon, catalog },
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
    const definitions = new Map(
      selected.flatMap((treasure) =>
        treasure.items.map((item) => [item.id, item.definition] as const)
      )
    )
    for (const treasure of output)
      for (const item of treasure.items) {
        if (item.containerId === null) continue
        const container = treasure.containers.find(
          (entry) => entry.id === item.containerId
        )!
        const sourceId = definitions.get(item.id)?.components.baseItemId
        if (!sourceId) continue
        const source = catalog.items.find((entry) => entry.id === sourceId)!
        const catalogContainer = catalog.containers.find(
          (entry) => entry.id === container.catalogContainerId
        )!
        expect(
          source.allowedContainerNames.includes(catalogContainer.name) ||
            catalogContainer.name === 'Pile'
        ).toBe(true)
      }
    expect(output.every(Object.isFrozen)).toBe(true)
  })

  it('aggregates totals and structured integrity observations', () => {
    const selected = selectMagicItems(
      { runId, seed, treasures: nonMagic(), targets: oneCommon, catalog },
      entropy
    )
    const treasures = packTreasures(
      { seed, treasures: selected, catalog },
      entropy
    )
    const output = aggregateReward({
      treasures,
      itemDefinitions: selected.flatMap((treasure) =>
        treasure.items.map((item) => item.definition)
      ),
      goldBudgetCp: 45_120,
      magicTargets: oneCommon,
      expectedTreasureCount: 2,
      profile: 'session',
      catalog
    })
    expect(output.normalValueCp).toBe(45_120)
    expect(output.magicCount).toBe(1)
    expect(
      output.audits.filter((audit) => audit.hard).every((audit) => audit.passed)
    ).toBe(true)
  })
})
