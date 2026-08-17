import { describe, expect, it } from 'vitest'
import { evaluatePacking } from '../../src/core/session-generation/packing-policy.js'
import { defaultGeneratorLootRules } from '../../src/shared/generator/default-loot-rules.js'

const base = {
  capacity: 4,
  quantity: 2,
  allowedContainerIds: ['container:pouch'],
  placement: null,
  unitKind: 'count'
} as const

describe('reward packing policy', () => {
  it('uses stable IDs for loose, related-container, and invalid decisions', () => {
    expect(
      evaluatePacking(base, 'container:pouch', defaultGeneratorLootRules)
    ).toEqual({ valid: true, placement: 'container', violationCode: null })
    expect(
      evaluatePacking(base, 'container:renamed', defaultGeneratorLootRules)
    ).toMatchObject({ valid: false, violationCode: 'container_not_allowed' })
    expect(
      evaluatePacking(base, null, defaultGeneratorLootRules)
    ).toMatchObject({
      valid: false,
      violationCode: 'loose_placement_not_allowed'
    })
  })

  it('allows pile only at the configured quantity boundary and never for liquid', () => {
    const atPile = {
      ...base,
      quantity: defaultGeneratorLootRules.packing.pileMinQty
    }
    expect(
      evaluatePacking(atPile, 'container:pile', defaultGeneratorLootRules)
    ).toMatchObject({ valid: true, placement: 'pile' })
    expect(
      evaluatePacking(
        { ...atPile, quantity: atPile.quantity - 1 },
        'container:pile',
        defaultGeneratorLootRules
      )
    ).toMatchObject({ valid: false, violationCode: 'container_not_allowed' })
    expect(
      evaluatePacking(
        { ...atPile, unitKind: 'liquid_pint' },
        'container:pile',
        defaultGeneratorLootRules
      )
    ).toMatchObject({ valid: false, violationCode: 'container_not_allowed' })
  })

  it('treats worn and handheld single items as explicit loose placements', () => {
    for (const placement of ['worn', 'handheld'] as const)
      expect(
        evaluatePacking(
          { ...base, quantity: 1, placement },
          null,
          defaultGeneratorLootRules
        )
      ).toMatchObject({ valid: true, placement: 'loose' })
  })
})
