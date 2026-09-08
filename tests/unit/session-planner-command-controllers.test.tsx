import { CapabilityError } from '../../src/shared/errors/capability-error.js'
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
        planner: { executeCommand: () => saved.promise } as never,
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
          executeCommand: () => Promise.reject(new Error('save failed'))
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

  it.each(['write', 'refresh', 'absent', 'newer-local', 'placed'] as const)(
    'reconciles reward %s without replay and opens only a current treasure',
    async (mode) => {
      const fixture = authorityFixture(false)
      const old = { id: 'treasure-1', label: 'Original' }
      const latest = { ...old, label: 'Later work' }
      const acceptGenerated = vi.fn().mockResolvedValue(old)
      if (mode !== 'refresh' && mode !== 'placed')
        acceptGenerated.mockRejectedValueOnce(
          new CapabilityError('outcome_unknown', true)
        )
      const generatedAcceptanceStatus = vi
        .fn()
        .mockRejectedValueOnce(new Error('read unavailable'))
        .mockResolvedValue({
          receipt: mode === 'absent' ? null : old,
          treasure: mode === 'absent' ? null : latest
        })
      const workspaceRead = vi.fn().mockResolvedValue(fixture.workspace)
      if (mode === 'refresh')
        workspaceRead.mockRejectedValueOnce(new Error('refresh failed'))
      const failed = vi.fn()
      const applyWorkspace = vi.fn()
      const { result } = renderHook(() =>
        useSessionRewardMaterialization({
          coordinator: new AsyncCommandCoordinator(),
          loot: { acceptGenerated, generatedAcceptanceStatus } as never,
          planner: { read: workspaceRead } as never,
          read: fixture.read,
          applyWorkspace,
          saveDraft: () => Promise.resolve(fixture.workspace),
          failed,
          onError: vi.fn()
        })
      )
      await act(async () => {
        await result.current.materializeReward(
          'run',
          'generated',
          'Label',
          true,
          mode === 'placed' ? (old as never) : null
        )
      })
      expect(failed).toHaveBeenCalledOnce()
      expect(failed.mock.calls[0]![0]).toMatchObject({
        code: 'outcome_unknown'
      })
      const reconcile = failed.mock.calls[0]![1] as () => Promise<boolean>
      if (mode === 'newer-local')
        fixture.author({ ...fixture.draft, adventureDayFraction: '0.5' })
      if (mode !== 'placed')
        await act(async () => {
          await expect(reconcile()).rejects.toThrow('read unavailable')
        })
      await act(async () => {
        expect(await reconcile()).toBe(true)
      })
      expect(acceptGenerated).toHaveBeenCalledTimes(mode === 'placed' ? 0 : 1)
      const original: unknown =
        mode === 'placed'
          ? generatedAcceptanceStatus.mock.calls[0]![0]
          : acceptGenerated.mock.calls[0]![0]
      for (const call of generatedAcceptanceStatus.mock.calls)
        expect(call[0]).toEqual(original)
      if (mode === 'newer-local') {
        expect(applyWorkspace).not.toHaveBeenCalled()
        expect(result.current.treasureEditor).toBe(false)
      } else {
        expect(applyWorkspace).toHaveBeenCalledWith(fixture.workspace)
        expect(result.current.treasureEditor).toBe(
          mode === 'absent' ? false : latest
        )
      }
    }
  )
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
