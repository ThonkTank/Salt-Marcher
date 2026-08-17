import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { calculateLedgerRewardBudget } from '../../src/core/session-generation/reward-budget-stage.js'
import { unitValue } from '../../src/core/session-generation/reward-units.js'
import { defaultGeneratorLootRules } from '../../src/shared/generator/default-loot-rules.js'
import { REWARD_ENGINE_VERSION } from '../../src/shared/contracts/session-generation.js'
import { sha256EncounterEntropy } from '../../src/utility/session-generation/sha256-entropy.js'
import { createRewardRandom } from '../../src/core/session-generation/reward-random.js'

const fixture = JSON.parse(
  readFileSync(
    'tests/fixtures/session-generation/reward-v3-oracles.json',
    'utf8'
  )
) as {
  schemaVersion: number
  rewardEngineVersion: string
  cases: Array<{
    id: string
    input: Parameters<typeof calculateLedgerRewardBudget>[0]
    intermediate: {
      postRewardXpByMember: number[]
      targetGoldCp: number
      currentGoldCp: number
      goldDeficitCp: number
    }
    expected: {
      goldBudgetCp: number
      magicTargets: Record<string, number>
    }
  }>
}

describe('Reward v3 local rule oracles', () => {
  it('pins inputs, formula intermediates, and outputs without the live Sheet', () => {
    expect(fixture.schemaVersion).toBe(1)
    expect(fixture.rewardEngineVersion).toBe(REWARD_ENGINE_VERSION)
    for (const oracle of fixture.cases) {
      const output = calculateLedgerRewardBudget(
        { ...oracle.input, rules: defaultGeneratorLootRules },
        createRewardRandom(
          (oracle.input as typeof oracle.input & { seed: number }).seed,
          sha256EncounterEntropy
        )
      )
      expect(
        output.rewardBasis.members.map(
          (member) => member.currentXp + member.projectedXp
        ),
        oracle.id
      ).toEqual(oracle.intermediate.postRewardXpByMember)
      expect(output.rewardBasis.targetGoldCp, oracle.id).toBe(
        oracle.intermediate.targetGoldCp
      )
      expect(output.rewardBasis.currentGoldCp, oracle.id).toBe(
        oracle.intermediate.currentGoldCp
      )
      expect(output.rewardBasis.goldDeficitCp, oracle.id).toBe(
        oracle.intermediate.goldDeficitCp
      )
      expect(unitValue(output.goldBudgetCp), oracle.id).toBe(
        oracle.expected.goldBudgetCp
      )
      expect(output.magicTargets, oracle.id).toEqual(
        oracle.expected.magicTargets
      )
    }
  })
})
