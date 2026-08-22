// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  SaveSessionPlanInput,
  SessionPlannerWorkspace
} from '../../src/shared/contracts/session-planner.js'
import { AsyncCommandCoordinator } from '../../src/renderer/async/async-command-coordinator.js'
import { useSessionPlannerSessionCommands } from '../../src/renderer/features/session-planner/use-session-planner-session-commands.js'
import { useSessionRewardMaterialization } from '../../src/renderer/features/session-planner/use-session-reward-materialization.js'
import type { SessionPlannerAuthority } from '../../src/renderer/features/session-planner/use-session-planner-workspace.js'

const sessionId = '01900000-0000-7000-8000-000000000001'

describe('Session Planner command controllers', () => {
  it('does not replace newer authored state with a delayed save result', async () => {
    const saved = deferred<SessionPlannerWorkspace>()
    const fixture = authorityFixture()
    const applyWorkspace = vi.fn()
    const mergeCatalog = vi.fn()
    const onError = vi.fn()
    const { result } = renderHook(() =>
      useSessionPlannerSessionCommands({
        coordinator: new AsyncCommandCoordinator(),
        planner: { save: () => saved.promise } as never,
        read: fixture.read,
        applyWorkspace,
        mergeCatalog,
        resetEncounterQuery: vi.fn(),
        onError
      })
    )
    let command!: Promise<SessionPlannerWorkspace | null>
    act(() => {
      command = result.current.saveDraft()
    })
    fixture.author({ ...fixture.draft, adventureDayFraction: '0.5' })
    saved.resolve({ ...fixture.workspace, sessions: [] })

    await act(async () => expect(command).resolves.toBeNull())
    expect(applyWorkspace).not.toHaveBeenCalled()
    expect(mergeCatalog).toHaveBeenCalledWith([])
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports a current Session command failure', async () => {
    const fixture = authorityFixture()
    const onError = vi.fn()
    const { result } = renderHook(() =>
      useSessionPlannerSessionCommands({
        coordinator: new AsyncCommandCoordinator(),
        planner: {
          save: () => Promise.reject(new Error('save failed'))
        } as never,
        read: fixture.read,
        applyWorkspace: vi.fn(),
        mergeCatalog: vi.fn(),
        resetEncounterQuery: vi.fn(),
        onError
      })
    )

    await act(async () =>
      expect(result.current.saveDraft()).resolves.toBeNull()
    )
    expect(onError).toHaveBeenCalledOnce()
  })

  it('reuses the Reward command identity and publishes only current authority', async () => {
    const fixture = authorityFixture(false)
    const first = deferred<never>()
    const commandIds: string[] = []
    const treasure = { id: 'treasure-1' }
    const acceptGenerated = vi.fn((input: { commandId: string }) => {
      commandIds.push(input.commandId)
      return commandIds.length === 1 ? first.promise : Promise.resolve(treasure)
    })
    const applyWorkspace = vi.fn()
    const onError = vi.fn()
    const coordinator = new AsyncCommandCoordinator()
    const { result } = renderHook(() =>
      useSessionRewardMaterialization({
        coordinator,
        loot: { acceptGenerated } as never,
        planner: { read: () => Promise.resolve(fixture.workspace) } as never,
        read: fixture.read,
        applyWorkspace,
        saveDraft: () => Promise.resolve(fixture.workspace),
        onError
      })
    )
    const invoke = () =>
      result.current.materializeReward(
        'run-1',
        'generated-1',
        'Reward',
        true,
        null
      )
    let failed!: Promise<void>
    act(() => {
      failed = invoke()
    })
    first.reject(new Error('lost response'))
    await act(async () => failed)
    expect(onError).toHaveBeenCalledOnce()

    await act(async () => invoke())
    expect(commandIds[1]).toBe(commandIds[0])
    expect(applyWorkspace).toHaveBeenCalledWith(fixture.workspace)
    expect(result.current.treasureEditor).toBe(treasure)
  })
})

function authorityFixture(dirty = true) {
  const workspace = plannerWorkspace()
  const draft: SaveSessionPlanInput = {
    sessionId,
    expectedRevision: 1,
    participantIds: [],
    adventureDayFraction: '1',
    encounterCount: 1,
    selectedSceneId: null,
    scenes: []
  }
  let authority: SessionPlannerAuthority = {
    workspace,
    draft,
    dirty,
    intentRevision: 1,
    authoredRevision: 0
  }
  return {
    workspace,
    draft,
    read: () => authority,
    author(next: SaveSessionPlanInput) {
      authority = {
        ...authority,
        draft: next,
        dirty: true,
        intentRevision: authority.intentRevision + 1,
        authoredRevision: authority.authoredRevision + 1
      }
    }
  }
}

function plannerWorkspace(): SessionPlannerWorkspace {
  return {
    currentSessionId: sessionId,
    sessions: [{ id: sessionId, name: 'Session', revision: 1 }],
    session: {
      id: sessionId,
      revision: 1,
      name: 'Session',
      participantIds: [],
      adventureDayFraction: '1',
      encounterCount: 1,
      selectedSceneId: null,
      scenes: []
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

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  let reject!: (cause?: unknown) => void
  const promise = new Promise<Value>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
