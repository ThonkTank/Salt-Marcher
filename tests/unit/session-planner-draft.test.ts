import { describe, expect, it } from 'vitest'
import {
  plannerDraftReducer,
  projectPlannerDraft
} from '../../src/renderer/features/session-planner/planner-draft.js'
import type { SavedEncounterPlanSummary } from '../../src/shared/contracts/encounter-plans.js'
import type {
  SaveSessionPlanInput,
  SessionPlannerWorkspace
} from '../../src/shared/contracts/session-planner.js'

const sessionId = '01900000-0000-7000-8000-000000000001'
const sceneA = '01900000-0000-7000-8000-000000000002'
const sceneB = '01900000-0000-7000-8000-000000000003'
const participantA = '01900000-0000-7000-8000-000000000004'
const participantB = '01900000-0000-7000-8000-000000000005'
const planId = '01900000-0000-7000-8000-000000000006'
const runId = '01900000-0000-7000-8000-000000000007'

describe('Session Planner draft model', () => {
  it('reduces immutable scene patches', () => {
    const draft = baseDraft()
    const updated = plannerDraftReducer(draft, {
      type: 'patch-scene',
      sceneId: sceneA,
      patch: { title: 'Ungespeichert' }
    })!
    expect(updated).not.toBe(draft)
    expect(updated.scenes[0]!.title).toBe('Ungespeichert')
    expect(draft.scenes[0]!.title).toBe('A')
  })

  it('projects unsaved participants, fraction, attached summary, XP, and reward origin', () => {
    const summary: SavedEncounterPlanSummary = {
      id: planId,
      titleKind: 'generated_encounter',
      authoredName: null,
      generatedEncounterNumber: 4,
      creatureCount: 2,
      baseXp: 100,
      adjustedXp: 150,
      difficulty: 'MEDIUM',
      creatures: [{ quantity: 2, name: 'Testwesen' }]
    }
    const workspace = baseWorkspace()
    const draft: SaveSessionPlanInput = {
      ...baseDraft(),
      participantIds: [participantA, participantB],
      adventureDayFraction: '0.5',
      scenes: [
        { ...baseDraft().scenes[0]!, encounterPlanId: planId },
        {
          ...baseDraft().scenes[1]!,
          generatedRewards: [
            {
              runId,
              generatedTreasureId: 'treasure-1',
              rewardChannel: 'quest',
              anchorEncounterNumber: null,
              treasureOrdinal: 1,
              position: 0
            }
          ]
        }
      ]
    }
    const projection = projectPlannerDraft({
      draft,
      workspace,
      encounterSummaries: new Map([[planId, summary]])
    })
    expect(projection.budget).toMatchObject({
      xpBudget: 500,
      plannedXp: 150,
      remainingXp: 350
    })
    expect(projection.scenes[0]!.encounter).toEqual({
      status: 'ready',
      summary
    })
    expect(projection.scenes[1]!.generatedRewards[0]).toMatchObject({
      status: 'ready',
      runId,
      generatedTreasureId: 'treasure-1'
    })
  })
})

function baseDraft(): SaveSessionPlanInput {
  return {
    sessionId,
    expectedRevision: 0,
    participantIds: [],
    adventureDayFraction: '1',
    encounterCount: null,
    selectedSceneId: sceneA,
    scenes: [scene(sceneA, 'A', 0), scene(sceneB, 'B', 1)]
  }
}

function scene(id: string, title: string, position: number) {
  return {
    id,
    titleKind: 'authored' as const,
    title,
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

function baseWorkspace(): SessionPlannerWorkspace {
  const reward = {
    runId,
    generatedTreasureId: 'treasure-1',
    rewardChannel: 'quest' as const,
    anchorEncounterNumber: null,
    treasureOrdinal: 1,
    position: 0,
    status: 'ready' as const,
    generatedTreasure: null,
    placedTreasure: null
  }
  return {
    currentSessionId: sessionId,
    sessions: [{ id: sessionId, name: 'Test', revision: 0 }],
    session: {
      id: sessionId,
      revision: 0,
      name: 'Test',
      participantIds: [],
      adventureDayFraction: '1',
      encounterCount: null,
      selectedSceneId: sceneA,
      scenes: [
        {
          ...scene(sceneA, 'A', 0),
          locationLabel: null,
          encounter: null,
          generatedRewards: [reward]
        },
        {
          ...scene(sceneB, 'B', 1),
          locationLabel: null,
          encounter: null,
          generatedRewards: []
        }
      ]
    },
    availableParticipants: [
      {
        id: participantA,
        name: 'A',
        level: 3,
        fullDayXp: 400,
        partyMember: true
      },
      {
        id: participantB,
        name: 'B',
        level: 4,
        fullDayXp: 600,
        partyMember: true
      }
    ],
    availableLocations: [],
    preparation: null,
    budget: {
      xpBudget: 0,
      plannedXp: 0,
      remainingXp: 0,
      recommendedShortRests: 0,
      recommendedLongRests: 0
    }
  }
}
