import { describe, expect, it } from 'vitest'
import {
  generationRuleOwnership,
  ruleClassifications
} from '../../src/core/session-generation/rule-classification.js'

describe('generation rule ownership', () => {
  it('uses one closed class and named owner for every registered rule', () => {
    expect(new Set(generationRuleOwnership.map((rule) => rule.id)).size).toBe(
      generationRuleOwnership.length
    )
    for (const rule of generationRuleOwnership) {
      expect(ruleClassifications).toContain(rule.classification)
      expect(rule.owner).not.toHaveLength(0)
      expect(rule.rationale).not.toHaveLength(0)
      expect(Object.isFrozen(rule)).toBe(true)
    }
    expect(
      new Set(generationRuleOwnership.map((rule) => rule.classification))
    ).toEqual(new Set(ruleClassifications))
  })
})
