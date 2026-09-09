import { PlannerMaintenanceRuntime } from '../../src/renderer/features/session-planner/planner-maintenance-runtime.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  PlannerPreparationMaintenanceStatus,
  SessionPreparationReceipt,
  SessionPlannerWorkspace
} from '../../src/shared/contracts/session-planner.js'
import { AsyncCommandCoordinator } from '../../src/renderer/async/async-command-coordinator.js'
import { useSessionPreparation } from '../../src/renderer/features/session-planner/use-session-preparation.js'
import type { SessionPlannerAuthority } from '../../src/renderer/features/session-planner/use-session-planner-workspace.js'

const sessionId = '01900000-0000-7000-8000-000000000001'
const operationId = '01900000-0000-7000-8000-000000000002'

describe('Session preparation controller', () => {
  it.each(['queued', 'succeeded', null] as const)(
    'reconciles an interrupted start as %s without repeating it',
    async (state) => {
      const runtime = new PlannerMaintenanceRuntime()
      const startPreparation = vi
        .fn()
        .mockRejectedValue(new CapabilityError('outcome_unknown', false))
      const fresh = {
        ...plannerWorkspace(),
        session: {
          ...plannerWorkspace().session,
          revision: state === 'succeeded' ? 2 : 1
        }
      }
      const status = vi
        .fn<
          (
            ids: readonly string[]
          ) => Promise<PlannerPreparationMaintenanceStatus>
        >()
        .mockResolvedValueOnce({
          operations: [],
          workspace: plannerWorkspace()
        })
        .mockRejectedValueOnce(new Error('read failed'))
        .mockResolvedValue({
          operations: [{ operationId, receipt: state ? receipt(state) : null }],
          workspace: fresh
        })
      const fixture = renderPreparation({
        startPreparation,
        preparationMaintenanceStatus: status,
        failed: runtime.failed
      })
      await act(async () =>
        fixture.result.current.requestPreparation(
          fixture.workspace,
          operationId,
          false,
          17
        )
      )
      expect(runtime.uncertain()).toBe(true)
      expect(runtime.canReconcile()).toBe(true)
      await expect(runtime.reconcileUnknown()).rejects.toThrow('read failed')
      expect(runtime.uncertain()).toBe(true)
      expect(fixture.applyWorkspace).not.toHaveBeenCalled()
      await act(async () =>
        expect(runtime.reconcileUnknown()).resolves.toBe(true)
      )
      expect(runtime.uncertain()).toBe(false)
      expect(startPreparation).toHaveBeenCalledOnce()
      expect(status.mock.calls.slice(1)).toEqual([
        [[operationId]],
        [[operationId]]
      ])
      expect(fixture.applyWorkspace).toHaveBeenCalledWith(fresh)
      expect(fixture.result.current.hasActiveOperation()).toBe(
        state === 'queued'
      )
      if (!state)
        expect(fixture.result.current.stageMessage).toContain('nicht gestartet')
    }
  )

  it('preserves a local draft and rejects mismatched or omitted receipt rows', async () => {
    const runtime = new PlannerMaintenanceRuntime()
    const status = vi
      .fn<
        (ids: readonly string[]) => Promise<PlannerPreparationMaintenanceStatus>
      >()
      .mockResolvedValueOnce({ operations: [], workspace: plannerWorkspace() })
      .mockResolvedValueOnce({ operations: [], workspace: plannerWorkspace() })
      .mockResolvedValueOnce({
        operations: [
          {
            operationId,
            receipt: { ...receipt('succeeded'), sessionId: 'another' }
          }
        ],
        workspace: plannerWorkspace()
      })
      .mockResolvedValue({
        operations: [{ operationId, receipt: receipt('succeeded') }],
        workspace: plannerWorkspace()
      })
    const fixture = renderPreparation({
      startPreparation: vi
        .fn()
        .mockRejectedValue(new CapabilityError('outcome_unknown', false)),
      preparationMaintenanceStatus: status,
      failed: runtime.failed
    })
    fixture.setDirty()
    await act(async () =>
      fixture.result.current.requestPreparation(
        fixture.workspace,
        operationId,
        false,
        17
      )
    )
    await expect(runtime.reconcileUnknown()).rejects.toThrow(
      'Vorbereitungsquittung fehlt'
    )
    await expect(runtime.reconcileUnknown()).rejects.toThrow('anderen Sitzung')
    expect(runtime.uncertain()).toBe(true)
    await act(async () => {
      await runtime.drain()
    })
    expect(runtime.uncertain()).toBe(false)
    expect(fixture.applyWorkspace).not.toHaveBeenCalled()
  })

  it.each(['queued', 'canceled', null] as const)(
    'reads an interrupted cancellation as %s without reissuing it',
    async (state) => {
      const runtime = new PlannerMaintenanceRuntime()
      const cancelPreparation = vi
        .fn()
        .mockRejectedValue(new CapabilityError('outcome_unknown', false))
      const status = vi
        .fn<
          (
            ids: readonly string[]
          ) => Promise<PlannerPreparationMaintenanceStatus>
        >()
        .mockResolvedValueOnce({
          operations: [],
          workspace: plannerWorkspace()
        })
        .mockResolvedValue({
          operations: [{ operationId, receipt: state ? receipt(state) : null }],
          workspace: plannerWorkspace()
        })
      const fixture = renderPreparation({
        startPreparation: () =>
          Promise.resolve({ status: 'accepted', receipt: receipt('queued') }),
        cancelPreparation,
        preparationMaintenanceStatus: status,
        failed: runtime.failed
      })
      await act(async () =>
        fixture.result.current.requestPreparation(
          fixture.workspace,
          operationId,
          false,
          17
        )
      )
      await act(async () => fixture.result.current.cancelPreparation())
      expect(runtime.uncertain()).toBe(true)
      if (state) {
        await act(async () =>
          expect(runtime.reconcileUnknown()).resolves.toBe(true)
        )
        expect(runtime.uncertain()).toBe(false)
        expect(fixture.result.current.hasActiveOperation()).toBe(
          state === 'queued'
        )
        if (state === 'queued')
          expect(fixture.result.current.stageMessage).toContain(
            'Abbruch wurde nicht ausgeführt'
          )
      } else {
        await expect(runtime.reconcileUnknown()).rejects.toThrow(
          'Vorbereitungsquittung fehlt'
        )
        expect(runtime.uncertain()).toBe(true)
      }
      expect(cancelPreparation).toHaveBeenCalledOnce()
    }
  )

  it('discovers detached work on mount and settles it without an active UI target', async () => {
    const status = vi
      .fn<
        (ids: readonly string[]) => Promise<PlannerPreparationMaintenanceStatus>
      >()
      .mockResolvedValueOnce({
        operations: [
          { operationId, receipt: { ...receipt('queued'), sessionId: 'other' } }
        ],
        workspace: plannerWorkspace()
      })
      .mockResolvedValue({
        operations: [
          {
            operationId,
            receipt: { ...receipt('succeeded'), sessionId: 'other' }
          }
        ],
        workspace: plannerWorkspace()
      })
    const fixture = renderPreparation({
      startPreparation: vi.fn(),
      preparationMaintenanceStatus: status
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(fixture.result.current.hasActiveOperation()).toBe(true)
    await act(async () => {
      await fixture.result.current.settleForMaintenance('save')
    })
    expect(status.mock.calls).toEqual([[[]], [[operationId]]])
    expect(fixture.result.current.hasActiveOperation()).toBe(false)
    expect(fixture.planner.cancelPreparation).not.toHaveBeenCalled()
  })

  it('keeps failed discovery unresolved until a successful maintenance status read', async () => {
    const status = vi
      .fn<
        (ids: readonly string[]) => Promise<PlannerPreparationMaintenanceStatus>
      >()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ operations: [], workspace: plannerWorkspace() })
    const fixture = renderPreparation({
      startPreparation: vi.fn(),
      preparationMaintenanceStatus: status
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(fixture.result.current.hasActiveOperation()).toBe(true)
    expect(fixture.onError).toHaveBeenCalledOnce()
    await act(async () => {
      await fixture.result.current.settleForMaintenance('save')
    })
    expect(fixture.result.current.hasActiveOperation()).toBe(false)
  })

  it('requires explicit replacement approval on save and only dismisses it on discard', async () => {
    const status = vi
      .fn<
        (ids: readonly string[]) => Promise<PlannerPreparationMaintenanceStatus>
      >()
      .mockResolvedValueOnce({ operations: [], workspace: plannerWorkspace() })
      .mockResolvedValue({
        operations: [{ operationId, receipt: null }],
        workspace: plannerWorkspace()
      })
    const fixture = renderPreparation({
      startPreparation: () =>
        Promise.resolve({
          status: 'confirmation_required',
          parameters: { sceneCount: 2 }
        }),
      preparationMaintenanceStatus: status
    })
    await act(async () =>
      fixture.result.current.requestPreparation(
        fixture.workspace,
        operationId,
        false,
        17
      )
    )
    await expect(
      fixture.result.current.settleForMaintenance('save')
    ).rejects.toThrow('bestätigen oder abbrechen')
    await act(async () => {
      await fixture.result.current.settleForMaintenance('discard')
    })
    expect(fixture.result.current.confirmation).toBeNull()
    expect(fixture.result.current.hasActiveOperation()).toBe(false)
    expect(fixture.planner.cancelPreparation).not.toHaveBeenCalled()
  })

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

  it('retains an accepted background preparation after the UI target becomes stale', async () => {
    const fixture = renderPreparation({
      startPreparation: () =>
        Promise.resolve({ status: 'accepted', receipt: receipt('queued') })
    })
    await act(async () =>
      fixture.result.current.requestPreparation(
        fixture.workspace,
        operationId,
        false,
        17
      )
    )
    expect(fixture.result.current.hasActiveOperation()).toBe(true)
    fixture.setIntentRevision(2)
    fixture.rerender({ revision: 2 })
    expect(fixture.result.current.stage).toBe('stale')
    expect(fixture.result.current.hasActiveOperation()).toBe(true)
  })

  it('releases a preparation only after its terminal cancellation receipt', async () => {
    const fixture = renderPreparation({
      startPreparation: () =>
        Promise.resolve({ status: 'accepted', receipt: receipt('queued') }),
      cancelPreparation: () => Promise.resolve({ receipt: receipt('canceled') })
    })
    await act(async () =>
      fixture.result.current.requestPreparation(
        fixture.workspace,
        operationId,
        false,
        17
      )
    )
    expect(fixture.result.current.hasActiveOperation()).toBe(true)
    await act(async () => fixture.result.current.cancelPreparation())
    expect(fixture.result.current.hasActiveOperation()).toBe(false)
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

  it('dismisses replacement confirmation without canceling missing durable work', async () => {
    const fixture = renderPreparation({
      startPreparation: () =>
        Promise.resolve({
          status: 'confirmation_required',
          parameters: { sceneCount: 2 }
        })
    })
    await act(async () =>
      fixture.result.current.requestPreparation(
        fixture.workspace,
        operationId,
        false,
        17
      )
    )

    expect(fixture.result.current.stage).toBe('confirming-replacement')
    await act(async () => fixture.result.current.cancelPreparation())

    expect(fixture.result.current.stage).toBe('ready')
    expect(fixture.result.current.confirmation).toBeNull()
    expect(fixture.planner.cancelPreparation).not.toHaveBeenCalled()
    expect(fixture.onError).not.toHaveBeenCalled()
  })
})

function renderPreparation(overrides: {
  startPreparation: () => Promise<unknown>
  failed?: PlannerMaintenanceRuntime['failed']
  preparationMaintenanceStatus?: (
    ids: readonly string[]
  ) => Promise<PlannerPreparationMaintenanceStatus>
  preparationReceipt?: () => Promise<unknown>
  cancelPreparation?: () => Promise<unknown>
  read?: () => Promise<SessionPlannerWorkspace>
}) {
  const workspace = plannerWorkspace()
  let intentRevision = 1
  let dirty = false
  let notice:
    ((notice: { operationId: string; status: string }) => void) | undefined
  const authority = (): SessionPlannerAuthority => ({
    workspace,
    draft: dirty
      ? {
          sessionId,
          expectedRevision: workspace.session.revision,
          participantIds: [],
          adventureDayFraction: '0.5',
          encounterCount: 5,
          selectedSceneId: null,
          scenes: []
        }
      : null,
    dirty,
    intentRevision,
    authoredRevision: intentRevision - 1
  })
  const planner = {
    preparationMaintenanceStatus:
      overrides.preparationMaintenanceStatus ??
      (() => Promise.resolve({ operations: [], workspace })),
    startPreparation: overrides.startPreparation,
    preparationReceipt:
      overrides.preparationReceipt ??
      (() => Promise.resolve({ receipt: null })),
    read: overrides.read ?? (() => Promise.resolve(workspace)),
    cancelPreparation: overrides.cancelPreparation ?? vi.fn(),
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
        ...(overrides.failed ? { failed: overrides.failed } : {}),
        onError
      })
    },
    { initialProps: { revision: 1 } }
  )
  return {
    ...hook,
    workspace,
    planner,
    applyWorkspace,
    onError,
    get notice() {
      return notice
    },
    setIntentRevision(value: number) {
      intentRevision = value
    },
    setDirty() {
      dirty = true
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
