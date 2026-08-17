import { createHash } from 'node:crypto'
import {
  decimal,
  floor,
  multiply,
  rational
} from '../../core/session-generation/rational.js'
import type { CommittedGeneratedEncounterBatchResult } from '../../shared/contracts/encounter-plans.js'
import type { SessionPlannerScene } from '../../shared/contracts/session-planner.js'
import type { PersistedSessionGeneratedRun } from '../../shared/contracts/session-generation.js'

/** Pure final mapping from persisted generation output into authored scenes. */
export function mapGeneratedScenes(
  run: PersistedSessionGeneratedRun,
  committed: Extract<
    CommittedGeneratedEncounterBatchResult,
    { status: 'SUCCESS' }
  >
): readonly SessionPlannerScene[] {
  const scenes: SessionPlannerScene[] = committed.mappings.map(
    (mapping, position) => ({
      id: deterministicUuid(
        `${run.originFingerprint}|encounter|${mapping.encounterNumber}`
      ),
      titleKind: 'generated_encounter',
      title: null,
      notes: '',
      locationId: null,
      encounterPlanId: mapping.planId,
      allocatedXp: mapping.summary.adjustedXp,
      position,
      restAfter: null,
      manualLootNotes: [],
      generatedRewards: []
    })
  )
  const byEncounter = new Map(
    committed.mappings.map((mapping, position) => [
      mapping.encounterNumber,
      scenes[position]!
    ])
  )
  const channelScenes = new Map<'quest' | 'environment', SessionPlannerScene>()
  for (const [treasureIndex, treasure] of run.treasures.entries()) {
    let scene: SessionPlannerScene | undefined
    if (treasure.rewardChannel === 'encounter')
      scene = treasure.anchorEncounterNumber
        ? byEncounter.get(treasure.anchorEncounterNumber)
        : undefined
    else {
      scene = channelScenes.get(treasure.rewardChannel)
      if (!scene) {
        scene = {
          id: deterministicUuid(
            `${run.originFingerprint}|reward|${treasure.rewardChannel}`
          ),
          titleKind:
            treasure.rewardChannel === 'quest'
              ? 'generated_quest_rewards'
              : 'generated_environment_rewards',
          title: null,
          notes: '',
          locationId: null,
          encounterPlanId: null,
          allocatedXp: 0,
          position: scenes.length,
          restAfter: null,
          manualLootNotes: [],
          generatedRewards: []
        }
        channelScenes.set(treasure.rewardChannel, scene)
        scenes.push(scene)
      }
    }
    if (!scene) throw new Error('generated_reward_anchor_missing')
    scene.generatedRewards.push({
      runId: run.id,
      generatedTreasureId: treasure.id,
      rewardChannel: treasure.rewardChannel,
      anchorEncounterNumber: treasure.anchorEncounterNumber,
      treasureOrdinal: treasureIndex + 1,
      position: scene.generatedRewards.length
    })
  }
  const restCount = Math.min(
    scenes.length - 1,
    floor(multiply(decimal(run.input.adventureDayFraction), rational(2n)))
  )
  for (let rest = 1; rest <= restCount; rest += 1) {
    const position = Math.min(
      scenes.length - 2,
      Math.floor((rest * scenes.length) / (restCount + 1))
    )
    scenes[position] = { ...scenes[position]!, restAfter: 'short' }
  }
  return scenes.map((scene, position) => ({ ...scene, position }))
}

function deterministicUuid(value: string): string {
  const bytes = createHash('sha256').update(value).digest().subarray(0, 16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x50
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
