// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  SessionPreparationReceipt,
  SessionPlannerWorkspace
} from '../../src/shared/contracts/session-planner.js'
import { AsyncCommandCoordinator } from '../../src/renderer/async/async-command-coordinator.js'
import { useSessionPreparation } from '../../src/renderer/features/session-planner/use-session-preparation.js'
import type { SessionPlannerAuthority } from '../../src/renderer/features/session-planner/use-session-planner-workspace.js'

const sessionId = '01900000-0000-7000-8000-000000000001'
const operationId = '01900000-0000-7000-8000-000000000002'

describe('Session preparation controller', () => {
  it('does not publish a start result after authored intent changed', async () => {
    const started = deferred<{
      status: 'accepted'
      receipt: SessionPreparationReceipt
    }>()
    const fixture = renderPreparation({
      startPreparation: () => started.promise
    })
    let request!: Promise<void>
    act(() => {
      request = fixture.result.current.requestPreparation(
        fixture.workspace,
        operationId,
        false,
        17
      )
    })

    fixture.setIntentRevision(2)
    fixture.rerender({ revision: 2 })
    started.resolve({ status: 'accepted', receipt: receipt('queued') })
    await act(async () => request)

    expect(fixture.result.current.stage).toBe('stale')
    expect(fixture.applyWorkspace).not.toHaveBeenCalled()
    expect(fixture.onError).not.toHaveBeenCalled()
  })

  it('drops a succeeded receipt when intent changes during refresh', async () => {
    const refreshed = deferred<SessionPlannerWorkspace>()
    const fixture = renderPreparation({
      startPreparation: () =>
        Promise.resolve({ status: 'accepted', receipt: receipt('queued') }),
      preparationReceipt: () =>
        Promise.resolve({ receipt: receipt('succeeded') }),
      read: () => refreshed.promise
    })
    await act(async () =>
      fixture.result.current.requestPreparation(
        fixture.workspace,
        operationId,
        false,
        17
      )
    )

    act(() => fixture.notice?.({ operationId, status: 'succeeded' }))
    await act(async () => Promise.resolve())
    fixture.setIntentRevision(2)
    fixture.rerender({ revision: 2 })
    refreshed.resolve(fixture.workspace)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fixture.applyWorkspace).not.toHaveBeenCalled()
    expect(fixture.result.current.stage).toBe('stale')
  })

  it('keeps current command failures visible', async () => {
    const fixture = renderPreparation({
      startPreparation: () => Promise.reject(new Error('start failed'))
    })
    await act(async () =>
      fixture.result.current.requestPreparation(
        fixture.workspace,
        operationId,
        false,
        17
      )
    )

    expect(fixture.result.current.stage).toBe('failed')
    expect(fixture.onError).toHaveBeenCalledOnce()
  })
})

function renderPreparation(overrides: {
  startPreparation: () => Promise<unknown>
  preparationReceipt?: () => Promise<unknown>
  read?: () => Promise<SessionPlannerWorkspace>
}) {
  const workspace = plannerWorkspace()
  let intentRevision = 1
  let notice:
    ((notice: { operationId: string; status: string }) => void) | undefined
  const authority = (): SessionPlannerAuthority => ({
    workspace,
    draft: null,
    dirty: false,
    intentRevision,
    authoredRevision: intentRevision - 1
  })
  const planner = {
    startPreparation: overrides.startPreparation,
    preparationReceipt:
      overrides.preparationReceipt ??
      (() => Promise.resolve({ receipt: null })),
    read: overrides.read ?? (() => Promise.resolve(workspace)),
    cancelPreparation: vi.fn(),
    onPreparationChanged: (
      listener: (value: { operationId: string; status: string }) => void
    ) => {
      notice = listener
      return () => {
        notice = undefined
      }
    }
  }
  const applyWorkspace = vi.fn()
  const onError = vi.fn()
  const coordinator = new AsyncCommandCoordinator()
  const hook = renderHook(
    (props: { revision: number }) => {
      void props.revision
      return useSessionPreparation({
        coordinator,
        planner: planner as never,
        read: authority,
        applyWorkspace,
        saveDraft: () => Promise.resolve(workspace),
        onError
      })
    },
    { initialProps: { revision: 1 } }
  )
  return {
    ...hook,
    workspace,
    applyWorkspace,
    onError,
    get notice() {
      return notice
    },
    setIntentRevision(value: number) {
      intentRevision = value
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

function receipt(
  status: SessionPreparationReceipt['status']
): SessionPreparationReceipt {
  return {
    operationId,
    sessionId,
    status,
    seed: 17,
    runId: status === 'succeeded' ? operationId : null,
    encounterBatchFingerprint: null,
    cancelRequested: false,
    committedPlannerRevision: status === 'succeeded' ? 2 : null,
    failure: null,
    updatedAt: '2026-08-22T00:00:00.000Z'
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
