import { describe, expect, it } from 'vitest'
import { itemDefinitionLineValueCp } from '../../src/shared/contracts/loot.js'
import { exactQuantityForBudget } from '../../src/core/session-generation/non-magic-selection-stage.js'
import { decimal } from '../../src/core/session-generation/rational.js'

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
})
