import { describe, expect, it } from 'vitest'
import { shuffledSuiteOrder } from '../../scripts/e2e-suite-order.js'

describe('E2E suite order', () => {
  it('creates a deterministic permutation without losing suite identity', () => {
    const suites = ['campaignCreate', 'dialogs', 'loot', 'travel'] as const
    const first = shuffledSuiteOrder(suites, 20260817)
    const second = shuffledSuiteOrder(suites, 20260817)
    expect(first).toEqual(second)
    expect(first).not.toEqual(suites)
    expect(first.toSorted()).toEqual([...suites].toSorted())
  })

  it('rejects invalid seeds', () => {
    expect(() => shuffledSuiteOrder(['campaignCreate'], -1)).toThrow(
      'non-negative safe integer'
    )
    expect(() => shuffledSuiteOrder(['campaignCreate'], Number.NaN)).toThrow(
      'non-negative safe integer'
    )
  })
})
