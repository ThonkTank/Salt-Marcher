import { describe, expect, it } from 'vitest'
import { mapGeneratedScenes } from '../../src/utility/session-planner/session-generated-scene-mapper.js'
import type { CommittedGeneratedEncounterBatchResult } from '../../src/shared/contracts/encounter-plans.js'
import type { PersistedSessionGeneratedRun } from '../../src/shared/contracts/session-generation.js'

describe('generated session scene mapper', () => {
  it('maps encounter and channel rewards without worker or database state', () => {
    const run = {
      id: '018f47db-e17a-7000-8000-000000000001',
      originFingerprint: 'a'.repeat(64),
      input: { adventureDayFraction: '0.6' },
      treasures: [
        {
          id: 'treasure:encounter',
          rewardChannel: 'encounter',
          anchorEncounterNumber: 1
        },
        {
          id: 'treasure:quest',
          rewardChannel: 'quest',
          anchorEncounterNumber: null
        }
      ]
    } as unknown as PersistedSessionGeneratedRun
    const committed = {
      status: 'SUCCESS',
      mappings: [
        {
          encounterNumber: 1,
          planId: '018f47db-e17a-7000-8000-000000000002',
          summary: { adjustedXp: 400 }
        }
      ]
    } as unknown as Extract<
      CommittedGeneratedEncounterBatchResult,
      { status: 'SUCCESS' }
    >

    const scenes = mapGeneratedScenes(run, committed)

    expect(scenes).toHaveLength(2)
    expect(scenes[0]).toMatchObject({
      titleKind: 'generated_encounter',
      allocatedXp: 400,
      generatedRewards: [{ generatedTreasureId: 'treasure:encounter' }]
    })
    expect(scenes[1]).toMatchObject({
      titleKind: 'generated_quest_rewards',
      generatedRewards: [{ generatedTreasureId: 'treasure:quest' }]
    })
  })
})
