import { describe, expect, it } from 'vitest'
import { itemDefinitionLineValueCp } from '../../src/shared/contracts/loot.js'
import { exactQuantityForBudget } from '../../src/core/session-generation/non-magic-selection-stage.js'
import { decimal } from '../../src/core/session-generation/rational.js'
import { calculateLedgerRewardBudget } from '../../src/core/session-generation/reward-budget-stage.js'
import { generatorLootRulesSchema } from '../../src/shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../src/shared/generator/default-loot-rules.js'
import {
  itemDefinitionSchema,
  itemReferenceSchema
} from '../../src/shared/contracts/loot.js'
import { ledgerRewardPartyMemberSchema } from '../../src/shared/contracts/session-generation.js'

describe('reward money boundaries', () => {
  it('keeps sub-copper catalog items eligible with an exact quantity', () => {
    expect(exactQuantityForBudget(decimal('0.2'), 1, 20, 0.05)).toBe(5)
    expect(exactQuantityForBudget(decimal('0.2'), 3, 20, 0.05)).toBe(15)
  })

  it('rounds only the exact rational line value using half-up', () => {
    const slingBullet = {
      unitValueCp: 0,
      exactUnitValueCp: { numerator: '1', denominator: '5' }
    }
    expect(itemDefinitionLineValueCp(slingBullet, 2)).toBe(0)
    expect(itemDefinitionLineValueCp(slingBullet, 3)).toBe(1)
    expect(
      itemDefinitionLineValueCp(
        {
          unitValueCp: 2,
          exactUnitValueCp: { numerator: '5', denominator: '2' }
        },
        1
      )
    ).toBe(3)
  })

  it('fails closed when a derived line value exceeds safe integers', () => {
    expect(() =>
      itemDefinitionLineValueCp({ unitValueCp: Number.MAX_SAFE_INTEGER }, 2)
    ).toThrow('item_value_overflow')
  })

  it('rejects unsafe editable XP and money values at contract boundaries', () => {
    expect(
      ledgerRewardPartyMemberSchema.safeParse({
        characterId: '00000000-0000-4000-8000-000000000001',
        level: 1,
        currentXp: Number.MAX_SAFE_INTEGER + 1,
        ledgerRevision: 0,
        currentNonMagicCp: 0,
        currentMagic: {
          Common: 0,
          Uncommon: 0,
          Rare: 0,
          'Very Rare': 0,
          Legendary: 0
        }
      }).success
    ).toBe(false)
    const reference = itemReferenceSchema.parse({
      kind: 'legacy',
      definitionId: 'unsafe-value'
    })
    expect(
      itemDefinitionSchema.safeParse({
        reference,
        name: 'Unsafe',
        unitValueCp: Number.MAX_SAFE_INTEGER + 1,
        unitCapacity: 0,
        stackable: false,
        magic: false,
        rarity: null,
        curse: null,
        components: {
          baseItemId: null,
          modifierId: null,
          componentId: null,
          magicItemId: null,
          magicVariantId: null,
          spellId: null,
          enspelledRuleId: null,
          curseId: null,
          coinDenominations: []
        }
      }).success
    ).toBe(false)
  })

  it('interpolates cumulative gold rationally and rounds half-up once', () => {
    const rules = structuredClone(defaultGeneratorLootRules)
    rules.progression[0]!.goldAtLevelCp = 0
    rules.progression[1]!.xpAtLevel = 2
    rules.progression[1]!.goldAtLevelCp = 1
    const result = calculateLedgerRewardBudget(
      {
        members: [
          {
            characterId: '00000000-0000-4000-8000-000000000001',
            level: 1,
            currentXp: 1,
            ledgerRevision: 0,
            currentNonMagicCp: 0,
            currentMagic: {
              Common: 0,
              Uncommon: 0,
              Rare: 0,
              'Very Rare': 0,
              Legendary: 0
            }
          }
        ],
        rewardXp: 0,
        rules: generatorLootRulesSchema.parse(rules),
        profile: 'session'
      },
      { modulo: () => 0, unit: () => 1 }
    )
    expect(result.rewardBasis.targetGoldCp).toBe(1)
  })
})
