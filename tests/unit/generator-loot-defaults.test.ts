import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultGeneratorLootRules } from '../../src/shared/generator/default-loot-rules.js'
import {
  lootRuleFieldMetadata,
  lootRuleGroupLabel,
  validateLootRuleDraft
} from '../../src/shared/generator/loot-rule-metadata.js'

const catalogRoot = join(
  process.cwd(),
  'resources/sessiongeneration/catalog-2026-08-16'
)

describe('default generator loot rules', () => {
  it('matches the checked progression, mix, policy, quantity and coin tables', () => {
    const progression = rows('DB_Progression.tsv').map((row) => ({
      level: number(row, 'Level'),
      xpAtLevel: number(row, 'XP_At_Level'),
      goldAtLevelCp: number(row, 'Gold_At_Level_GP') * 100,
      magicPerXp: {
        Common: number(row, 'Common_Per_XP'),
        Uncommon: number(row, 'Uncommon_Per_XP'),
        Rare: number(row, 'Rare_Per_XP'),
        'Very Rare': number(row, 'Very_Rare_Per_XP'),
        Legendary: number(row, 'Legendary_Per_XP')
      }
    }))
    expect(defaultGeneratorLootRules.progression).toEqual(progression)

    const mix = rows('DB_LootMix.tsv')
    expect(defaultGeneratorLootRules.mix.roles).toEqual({
      compactValue: share(mix, 'ROLE', 'nonmagic', 'compact_value'),
      complexValue: share(mix, 'ROLE', 'nonmagic', 'complex_value'),
      useful: share(mix, 'ROLE', 'nonmagic', 'useful'),
      flavor: share(mix, 'ROLE', 'nonmagic', 'flavor')
    })
    expect(defaultGeneratorLootRules.mix.compactForms).toEqual(
      formShares(mix, 'compact_value')
    )
    expect(defaultGeneratorLootRules.mix.complexForms).toEqual(
      formShares(mix, 'complex_value')
    )

    const policies = Object.fromEntries(
      rows('DB_LootSelectionPolicy.tsv').map((row) => [
        policyKey(row['Path_ID']!),
        {
          fitWeight: number(row, 'Fit_Weight'),
          themeWeight: number(row, 'Theme_Weight'),
          jitterWeight: number(row, 'Jitter_Weight'),
          duplicatePenalty: number(row, 'Duplicate_Penalty'),
          nearBestGap: number(row, 'Near_Best_Gap_Pct'),
          shortlistSize: number(row, 'Shortlist_Size'),
          minFit: number(row, 'Min_Fit_Pct'),
          maxOverfit: number(row, 'Max_Overfit_Pct'),
          variantShortlistSize: number(row, 'Variant_Shortlist_Size'),
          minBaseExtraCp: number(row, 'Min_Base_Extra_CP'),
          preferredBaseExtraCp: number(row, 'Preferred_Base_Extra_CP')
        }
      ])
    )
    expect(defaultGeneratorLootRules.selection).toEqual(policies)

    const quantities = new Map(
      rows('DB_LootQuantityRules.tsv').map((row) => [
        row['Rule_ID'],
        number(row, 'Max_Qty')
      ])
    )
    expect(defaultGeneratorLootRules.quantityLimits).toEqual({
      carrier: {
        quantityGood: quantities.get('qty:carrier:quantity'),
        artObject: quantities.get('qty:carrier:art'),
        gemstone: quantities.get('qty:carrier:gem'),
        ingot: quantities.get('qty:carrier:ingot'),
        tradeGood: quantities.get('qty:carrier:trade'),
        fallback: quantities.get('qty:carrier:default')
      },
      useful: {
        quantityGood: quantities.get('qty:useful:quantity'),
        ammunition: quantities.get('qty:useful:ammunition'),
        potion: quantities.get('qty:useful:potion'),
        poison: quantities.get('qty:useful:poison'),
        hazardItem: quantities.get('qty:useful:hazard'),
        fallback: quantities.get('qty:useful:default')
      },
      flavor: {
        quantityGood: quantities.get('qty:flavor:quantity'),
        fallback: quantities.get('qty:flavor:default')
      }
    })

    const denominations = rows('DB_CoinDenominations.tsv').reduce<
      Record<
        string,
        { valueCp: number; singularLabel: string; pluralLabel: string }
      >
    >((result, row) => {
      result[row['Denomination_ID']!] = {
        valueCp: number(row, 'Unit_CP'),
        singularLabel: row['Singular_Label']!,
        pluralLabel: row['Plural_Label']!
      }
      return result
    }, {})
    expect(defaultGeneratorLootRules.coins.denominations).toEqual(denominations)
    const denominationByValue = new Map(
      Object.entries(denominations).map(([id, value]) => [value.valueCp, id])
    )
    const profiles = Object.fromEntries(
      rows('DB_CoinProfiles.tsv').map((row) => [
        profileKey(row['Profile_ID']!),
        {
          denominations: ['Unit_1_CP', 'Unit_2_CP', 'Unit_3_CP']
            .map((column) => number(row, column))
            .filter((value) => value > 0)
            .map((value) => denominationByValue.get(value)),
          minLowCount: number(row, 'Min_Low_Count'),
          maxLowCount: number(row, 'Max_Low_Count'),
          maxMiddleCount: number(row, 'Max_Middle_Count'),
          maxBudgetCp: number(row, 'Max_Budget_CP'),
          allowedContainerIds: row['Allowed_Containers']!.split(',').map(
            (name) =>
              `container:${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`
          )
        }
      ])
    )
    expect(defaultGeneratorLootRules.coins.profiles).toEqual(profiles)
  })

  it('pins the remaining editable Sheet control cells', () => {
    expect(defaultGeneratorLootRules.treasure).toEqual({
      slotMin: 6,
      slotTarget: 8,
      slotMax: 10,
      encounterTreasureRatio: 0.75,
      treasuresPerAdventureDay: 3,
      treasureCountVariance: 1,
      overstockShare: 0.2,
      channels: { quest: 0.4, encounter: 0.4, environment: 0.2 },
      enhancedCapMin: 1,
      enhancedCapMax: 2,
      enhancedCapMultiplier: 2
    })
    expect(defaultGeneratorLootRules.packing).toEqual({
      coinsPerCapacityUnit: 50,
      contextBulkMinLb: 20,
      loosePlacementMaxQty: 1,
      looseNonAmountMinCapacity: 2,
      pileMinQty: 5,
      containerMaxCountFactor: 4,
      minimumFillRatio: 0.25
    })
    expect(defaultGeneratorLootRules.magic).toEqual({
      curseChance: 0.2,
      overstockShare: 0.2
    })
    expect(defaultGeneratorLootRules.balance).toEqual({
      categoryStrength: 0.5,
      roleStrength: 1.5,
      minimumRoleWeight: 0.01
    })
    expect(defaultGeneratorLootRules.audit).toEqual({
      normalBudgetTolerance: 0.15
    })
  })

  it('provides editor metadata for every group and field', () => {
    const missing: string[] = []
    const visit = (value: unknown, path: readonly (string | number)[]) => {
      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, [...path, index]))
        return
      }
      if (value && typeof value === 'object') {
        for (const [key, entry] of Object.entries(value)) {
          if (entry && typeof entry === 'object' && !lootRuleGroupLabel(key))
            missing.push([...path, key].join('.'))
          visit(entry, [...path, key])
        }
        return
      }
      if (!lootRuleFieldMetadata(path, value)) missing.push(path.join('.'))
    }
    visit(defaultGeneratorLootRules, [])
    expect(missing).toEqual([])
    expect(validateLootRuleDraft(defaultGeneratorLootRules)).toEqual([])
  })

  it('reports stable field paths for share, order, and uniqueness errors', () => {
    const invalid = structuredClone(defaultGeneratorLootRules)
    invalid.mix.roles.compactValue = 0.9
    invalid.treasure.slotTarget = invalid.treasure.slotMax + 1
    invalid.coins.profiles.ppGp.denominations = ['pp', 'pp']
    expect(
      validateLootRuleDraft(invalid).map((issue) => ({
        code: issue.code,
        path: issue.path
      }))
    ).toEqual(
      expect.arrayContaining([
        { code: 'share_sum', path: ['mix', 'roles'] },
        { code: 'invalid_order', path: ['treasure', 'slotMax'] },
        {
          code: 'duplicate_value',
          path: ['coins', 'profiles', 'ppGp', 'denominations']
        }
      ])
    )
  })
})

type Row = Readonly<Record<string, string>>

function rows(file: string): readonly Row[] {
  const [header, ...lines] = readFileSync(join(catalogRoot, file), 'utf8')
    .trimEnd()
    .split(/\r?\n/)
  const columns = header!.split('\t')
  return lines.map((line) =>
    Object.fromEntries(
      line.split('\t').map((value, index) => [columns[index]!, value])
    )
  )
}

function number(row: Row, column: string): number {
  return Number(row[column])
}

function share(
  rows: readonly Row[],
  level: string,
  parent: string,
  option: string
): number {
  return number(
    rows.find(
      (row) =>
        row['Mix_Level'] === level &&
        row['Parent_ID'] === parent &&
        row['Option_ID'] === option
    )!,
    'Share'
  )
}

function formShares(
  rows: readonly Row[],
  parent: string
): Record<string, number> {
  return rows
    .filter((row) => row['Mix_Level'] === 'FORM' && row['Parent_ID'] === parent)
    .reduce<Record<string, number>>((result, row) => {
      result[row['Option_ID']!] = number(row, 'Share')
      return result
    }, {})
}

function policyKey(path: string): string {
  return path.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function profileKey(profile: string): string {
  return profile
    .split('_')
    .map((part, index) =>
      index === 0 ? part : part.slice(0, 1).toUpperCase() + part.slice(1)
    )
    .join('')
}
