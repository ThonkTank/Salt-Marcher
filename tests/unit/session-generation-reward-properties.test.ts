import { join } from 'node:path'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createGenerationCatalogIndex } from '../../src/core/session-generation/generation-catalog-index.js'
import { generateRewardProposal } from '../../src/core/session-generation/reward-proposal-pipeline.js'
import { generatorLootRulesSchema } from '../../src/shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../src/shared/generator/default-loot-rules.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
import { sha256EncounterEntropy } from '../../src/utility/session-generation/sha256-entropy.js'

const catalogIndex = createGenerationCatalogIndex(
  new BundledEncounterCatalogProvider(
    join(process.cwd(), 'resources/sessiongeneration/catalog-2026-08-16')
  ).loadFull()
)

const validRulesArbitrary = fc
  .record({
    slotMin: fc.integer({ min: 1, max: 4 }),
    slotTargetDelta: fc.integer({ min: 0, max: 4 }),
    slotMaxDelta: fc.integer({ min: 0, max: 4 }),
    encounterShare: fc.integer({ min: 0, max: 100 }),
    overstockShare: fc.integer({ min: 0, max: 50 }),
    pileMinQty: fc.integer({ min: 1, max: 20 }),
    loosePlacementMaxQty: fc.integer({ min: 0, max: 5 }),
    minimumFillRatio: fc.integer({ min: 0, max: 100 }),
    normalBudgetTolerance: fc.integer({ min: 0, max: 100 }),
    seed: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
    rewardXp: fc.integer({ min: 0, max: 100_000 })
  })
  .map((sample) => {
    const slotTarget = sample.slotMin + sample.slotTargetDelta
    const slotMax = slotTarget + sample.slotMaxDelta
    const rules = structuredClone(defaultGeneratorLootRules)
    rules.treasure.slotMin = sample.slotMin
    rules.treasure.slotTarget = slotTarget
    rules.treasure.slotMax = slotMax
    rules.treasure.encounterTreasureRatio = sample.encounterShare / 100
    rules.treasure.overstockShare = sample.overstockShare / 100
    rules.packing.pileMinQty = sample.pileMinQty
    rules.packing.loosePlacementMaxQty = sample.loosePlacementMaxQty
    rules.packing.minimumFillRatio = sample.minimumFillRatio / 100
    rules.audit.normalBudgetTolerance = sample.normalBudgetTolerance / 100
    return {
      rules: generatorLootRulesSchema.parse(rules),
      seed: sample.seed,
      rewardXp: sample.rewardXp
    }
  })

describe('reward pipeline properties', () => {
  it('never emits a schema-valid proposal with a failed hard invariant', () => {
    fc.assert(
      fc.property(validRulesArbitrary, ({ rules, seed, rewardXp }) => {
        const result = generateRewardProposal(
          {
            runId: '00000000-0000-4000-8000-000000000099',
            seed,
            members: [
              {
                characterId: '00000000-0000-4000-8000-000000000001',
                level: 3,
                currentXp: 900,
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
            rewardXp,
            rules,
            catalogIndex,
            planPolicy: {
              kind: 'session',
              adventureDayFraction: '0.6',
              encounterNumbers: [1, 2]
            }
          },
          sha256EncounterEntropy
        )

        if (result.status === 'unresolvable') {
          expect(result.issues).toEqual([
            {
              code: 'hard_audit_failed',
              parameters: { stage: 'reward_aggregation' }
            }
          ])
          return
        }
        expect(
          result.proposal.audits.every((audit) => !audit.hard || audit.passed)
        ).toBe(true)
        expect(Number.isSafeInteger(result.proposal.goldBudgetCp)).toBe(true)
        expect(Object.isFrozen(result.proposal)).toBe(true)
      }),
      { numRuns: 30 }
    )
  })
})
