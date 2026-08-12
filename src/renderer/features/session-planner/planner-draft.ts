import type { SavedEncounterPlanSummary } from '../../../shared/contracts/encounter-plans.js'
import type {
  SaveSessionPlanInput,
  SessionPlannerScene,
  SessionPlannerWorkspace
} from '../../../shared/contracts/session-planner.js'

export type PlannerDraftAction =
  | Readonly<{ type: 'replace'; draft: SaveSessionPlanInput | null }>
  | Readonly<{
      type: 'update'
      update: (draft: SaveSessionPlanInput) => SaveSessionPlanInput
    }>
  | Readonly<{
      type: 'patch-scene'
      sceneId: string
      patch: Partial<SessionPlannerScene>
    }>

export function plannerDraftReducer(
  draft: SaveSessionPlanInput | null,
  action: PlannerDraftAction
): SaveSessionPlanInput | null {
  if (action.type === 'replace') return action.draft
  if (!draft) return draft
  if (action.type === 'update') return action.update(draft)
  return {
    ...draft,
    scenes: draft.scenes.map((scene) =>
      scene.id === action.sceneId ? { ...scene, ...action.patch } : scene
    )
  }
}

export type PlannerDraftProjection = Readonly<{
  scenes: SessionPlannerWorkspace['session']['scenes']
  budget: SessionPlannerWorkspace['budget']
}>

export function projectPlannerDraft(input: {
  draft: SaveSessionPlanInput
  workspace: SessionPlannerWorkspace
  encounterSummaries: ReadonlyMap<string, SavedEncounterPlanSummary>
}): PlannerDraftProjection {
  const encounterById = new Map<string, SavedEncounterPlanSummary>()
  const rewardByOrigin = new Map<
    string,
    SessionPlannerWorkspace['session']['scenes'][number]['generatedRewards'][number]
  >()
  for (const scene of input.workspace.session.scenes) {
    if (scene.encounter?.status === 'ready')
      encounterById.set(scene.encounter.summary.id, scene.encounter.summary)
    for (const reward of scene.generatedRewards)
      rewardByOrigin.set(
        rewardKey(reward.runId, reward.generatedTreasureId),
        reward
      )
  }
  for (const [id, summary] of input.encounterSummaries)
    encounterById.set(id, summary)
  const locations = new Map(
    input.workspace.availableLocations.map(({ id, label }) => [id, label])
  )
  const scenes = input.draft.scenes.map((scene) => ({
    ...scene,
    locationLabel: scene.locationId
      ? (locations.get(scene.locationId) ?? null)
      : null,
    encounter: scene.encounterPlanId
      ? encounterById.has(scene.encounterPlanId)
        ? {
            status: 'ready' as const,
            summary: encounterById.get(scene.encounterPlanId)!
          }
        : { status: 'missing' as const }
      : null,
    generatedRewards: scene.generatedRewards.map(
      (reward) =>
        rewardByOrigin.get(
          rewardKey(reward.runId, reward.generatedTreasureId)
        ) ?? {
          ...reward,
          status: 'missing' as const,
          generatedTreasure: null,
          placedTreasure: null
        }
    )
  }))
  const fullDayXp = new Map(
    input.workspace.availableParticipants.map(({ id, fullDayXp }) => [
      id,
      fullDayXp
    ])
  )
  const dayBudget = input.draft.participantIds.reduce(
    (sum, id) => sum + (fullDayXp.get(id) ?? 0),
    0
  )
  const fraction = Number(input.draft.adventureDayFraction)
  const safeFraction = Number.isFinite(fraction) ? Math.max(0, fraction) : 0
  const xpBudget = Math.round(dayBudget * safeFraction)
  const plannedXp = scenes.reduce(
    (sum, scene) =>
      sum +
      (scene.encounter?.status === 'ready'
        ? scene.encounter.summary.adjustedXp
        : 0),
    0
  )
  return {
    scenes,
    budget: {
      xpBudget,
      plannedXp,
      remainingXp: xpBudget - plannedXp,
      recommendedShortRests: Math.floor(safeFraction * 2),
      recommendedLongRests: Math.floor(safeFraction)
    }
  }
}

function rewardKey(runId: string, generatedTreasureId: string): string {
  return `${runId}:${generatedTreasureId}`
}
