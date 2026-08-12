// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SceneInspector } from '../../src/renderer/features/session-planner/scene-inspector.js'
import type {
  SaveSessionPlanInput,
  SessionPlannerScene,
  SessionPlannerWorkspace
} from '../../src/shared/contracts/session-planner.js'

afterEach(cleanup)

const sessionId = '01900000-0000-7000-8000-000000000001'
const sceneId = '01900000-0000-7000-8000-000000000002'

describe('Session Planner scene inspector', () => {
  it('converts a generated title to authored on the first edit', () => {
    const selected: SessionPlannerScene = {
      id: sceneId,
      titleKind: 'generated_encounter',
      title: null,
      notes: '',
      locationId: null,
      encounterPlanId: null,
      allocatedXp: 0,
      position: 0,
      restAfter: null,
      manualLootNotes: [],
      generatedRewards: []
    }
    const draft: SaveSessionPlanInput = {
      sessionId,
      expectedRevision: 0,
      participantIds: [],
      adventureDayFraction: '1',
      encounterCount: null,
      selectedSceneId: sceneId,
      scenes: [selected]
    }
    const patchScene = vi.fn()
    render(
      <SceneInspector
        workspace={workspace(selected)}
        draft={draft}
        selectedScene={selected}
        selectedProjection={undefined}
        encounterQuery=""
        encounterSearch={{ status: 'idle' }}
        setEncounterQuery={vi.fn()}
        mutate={vi.fn()}
        patchScene={patchScene}
        materializeReward={vi.fn()}
        distribute={vi.fn()}
      />
    )
    fireEvent.change(screen.getAllByRole('textbox')[0]!, {
      target: { value: 'Eigener Titel' }
    })
    expect(patchScene).toHaveBeenCalledWith(sceneId, {
      titleKind: 'authored',
      title: 'Eigener Titel'
    })
  })
})

function workspace(scene: SessionPlannerScene): SessionPlannerWorkspace {
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
      selectedSceneId: scene.id,
      scenes: [
        {
          ...scene,
          locationLabel: null,
          encounter: null,
          generatedRewards: []
        }
      ]
    },
    availableParticipants: [],
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
