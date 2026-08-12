import type { SessionPlannerScene } from '../../../shared/contracts/session-planner.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'

export function emptyPlannerScene(
  id: string,
  position: number
): SessionPlannerScene {
  return {
    id,
    titleKind: 'authored',
    title: formatMessage('planner.sceneDefault', { number: position + 1 }),
    notes: '',
    locationId: null,
    encounterPlanId: null,
    allocatedXp: 0,
    position,
    restAfter: null,
    manualLootNotes: [],
    generatedRewards: []
  }
}

export function normalizePlannerScenes(
  scenes: readonly SessionPlannerScene[]
): SessionPlannerScene[] {
  return scenes.map((scene, position) => ({
    ...scene,
    position,
    restAfter: position === scenes.length - 1 ? null : scene.restAfter
  }))
}

export function plannerSceneTitle(
  scene: SessionPlannerScene,
  position: number
): string {
  if (scene.titleKind === 'authored') return scene.title ?? ''
  if (scene.titleKind === 'generated_encounter')
    return formatMessage('planner.generatedEncounterTitle', {
      number: position + 1
    })
  if (scene.titleKind === 'generated_quest_rewards')
    return message('planner.generatedQuestRewardsTitle')
  return message('planner.generatedEnvironmentRewardsTitle')
}
