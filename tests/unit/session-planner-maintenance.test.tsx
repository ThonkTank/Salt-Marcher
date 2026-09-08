// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionPlannerWorkspace } from '../../src/shared/contracts/session-planner.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import { AsyncCommandCoordinator } from '../../src/renderer/async/async-command-coordinator.js'
import { useSessionPlannerWorkspace } from '../../src/renderer/features/session-planner/use-session-planner-workspace.js'
import { useSessionPlannerSessionCommands } from '../../src/renderer/features/session-planner/use-session-planner-session-commands.js'
import {
  usePlannerMaintenance,
  usePlannerMaintenanceRuntime
} from '../../src/renderer/features/session-planner/use-planner-maintenance.js'
import type { SessionPlannerPort } from '../../src/renderer/features/session-planner/use-session-planner-ports.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'

let resolution: MaintenanceDraftResolution | undefined
afterEach(() => {
  resolution?.release()
  resolution = undefined
  cleanup()
})
const initial: SessionPlannerWorkspace = {
  currentSessionId: 'session',
  sessions: [{ id: 'session', name: 'Session', revision: 1 }],
  session: {
    id: 'session',
    name: 'Session',
    revision: 1,
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
function setup(
  save = vi.fn<SessionPlannerPort['save']>().mockImplementation((draft) =>
    Promise.resolve({
      ...initial,
      session: {
        ...initial.session,
        ...draft,
        revision: draft.expectedRevision + 1,
        scenes: []
      }
    })
  )
) {
  const coordinator = new AsyncCommandCoordinator()
  const planner = {
    read: () => Promise.resolve(initial),
    save
  } as unknown as SessionPlannerPort
  const onError = vi.fn()
  const hook = renderHook(() => {
    const runtime = usePlannerMaintenanceRuntime()
    const workspace = useSessionPlannerWorkspace({
      coordinator,
      planner,
      onError
    })
    const sessions = useSessionPlannerSessionCommands({
      coordinator,
      planner,
      read: workspace.read,
      applyWorkspace: workspace.applyWorkspace,
      mergeCatalog: workspace.mergeCatalog,
      resetEncounterQuery: vi.fn(),
      onError,
      failed: runtime.failed
    })
    const maintenance = usePlannerMaintenance({
      runtime,
      coordinator,
      read: workspace.read,
      applyWorkspace: workspace.applyWorkspace,
      saveDraft: sessions.saveDraft,
      readUnresolved: () => (sessions.hasOpenDialog() ? 'Dialog offen' : null)
    })
    return {
      runtime,
      workspace,
      sessions,
      maintenance,
      mutate: maintenance.edit(workspace.mutate),
      save: maintenance.command(sessions.saveDraft, null)
    }
  })
  return { ...hook, save }
}
async function load() {
  await act(async () => {
    await Promise.resolve()
  })
}
function begin() {
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
}
async function resolve(choice: 'save' | 'discard') {
  let failures!: Awaited<ReturnType<MaintenanceDraftResolution['resolve']>>
  await act(async () => {
    failures = await resolution!.resolve(choice)
  })
  return failures
}

describe('Session Planner maintenance owner', () => {
  it('saves the real planner draft through the normal session command and blocks new input immediately', async () => {
    const hook = setup()
    await load()
    act(() =>
      hook.result.current.mutate((draft) => ({ ...draft, encounterCount: 3 }))
    )
    const mutate = hook.result.current.mutate
    act(() => {
      resolution = maintenanceDraftCoordinator.begin()
      mutate((draft) => ({ ...draft, encounterCount: 9 }))
    })
    expect(await resolve('save')).toEqual([])
    expect(hook.save).toHaveBeenCalledOnce()
    expect(hook.save.mock.calls[0]?.[0].encounterCount).toBe(3)
    expect(hook.result.current.workspace.read().dirty).toBe(false)
  })
  it('discards only the local draft and unlocks editing after cancel', async () => {
    const hook = setup()
    await load()
    act(() =>
      hook.result.current.mutate((draft) => ({ ...draft, encounterCount: 3 }))
    )
    begin()
    expect(await resolve('discard')).toEqual([])
    expect(hook.result.current.workspace.read().draft?.encounterCount).toBe(1)
    expect(hook.save).not.toHaveBeenCalled()
    act(() => {
      resolution!.release()
      resolution = undefined
    })
    act(() =>
      hook.result.current.mutate((draft) => ({ ...draft, encounterCount: 4 }))
    )
    expect(hook.result.current.workspace.read().draft?.encounterCount).toBe(4)
  })
  it('retains the draft on failure and attributes the failed owner', async () => {
    const save = vi
      .fn<SessionPlannerPort['save']>()
      .mockRejectedValue(new Error('save failed'))
    const hook = setup(save)
    await load()
    act(() =>
      hook.result.current.mutate((draft) => ({ ...draft, encounterCount: 3 }))
    )
    begin()
    expect(await resolve('save')).toMatchObject([{ label: 'Sitzungsplanung' }])
    expect(hook.result.current.workspace.read().dirty).toBe(true)
    expect(await resolve('discard')).toEqual([])
    expect(save).toHaveBeenCalledOnce()
  })
  it('keeps an unknown write blocked instead of replaying or discarding it', async () => {
    const save = vi
      .fn<SessionPlannerPort['save']>()
      .mockRejectedValue(new CapabilityError('outcome_unknown', false))
    const hook = setup(save)
    await load()
    act(() =>
      hook.result.current.mutate((draft) => ({ ...draft, encounterCount: 3 }))
    )
    begin()
    expect(await resolve('save')).toHaveLength(1)
    const failures = await resolve('discard')
    expect(failures).toHaveLength(1)
    expect(failures[0]?.label).toBe('Sitzungsplanung')
    expect(failures[0]?.message).toContain('unbekannt')
    expect(save).toHaveBeenCalledOnce()
    expect(hook.result.current.workspace.read().dirty).toBe(true)
  })
  it('waits for the whole action and detects a dialog opened by its final continuation', async () => {
    const hook = setup()
    await load()
    let finish!: () => void
    const gate = new Promise<void>((done) => {
      finish = done
    })
    let operation!: Promise<void>
    act(() => {
      operation = hook.result.current.runtime.run(async () => {
        await gate
        hook.result.current.sessions.setNameDialog('create')
      })
    })
    begin()
    let result!: Promise<
      Awaited<ReturnType<MaintenanceDraftResolution['resolve']>>
    >
    const settled = vi.fn()
    act(() => {
      result = resolution!.resolve('discard')
      void result.then(settled)
    })
    await load()
    expect(settled).not.toHaveBeenCalled()
    await act(async () => {
      finish()
      await operation
      await result
    })
    expect(await result).toMatchObject([
      { label: 'Sitzungsplanung', message: 'Dialog offen' }
    ])
    expect(hook.save).not.toHaveBeenCalled()
  })
  it('waits for an existing save and preserves its confirmed state when discarding', async () => {
    let finish!: (value: SessionPlannerWorkspace) => void
    const gate = new Promise<SessionPlannerWorkspace>((done) => {
      finish = done
    })
    const save = vi.fn<SessionPlannerPort['save']>().mockReturnValue(gate)
    const hook = setup(save)
    await load()
    act(() =>
      hook.result.current.mutate((draft) => ({ ...draft, encounterCount: 3 }))
    )
    let operation!: Promise<SessionPlannerWorkspace | null>
    act(() => {
      operation = hook.result.current.save()
    })
    act(() =>
      hook.result.current.mutate((draft) => ({ ...draft, encounterCount: 9 }))
    )
    begin()
    let result!: Promise<
      Awaited<ReturnType<MaintenanceDraftResolution['resolve']>>
    >
    act(() => {
      result = resolution!.resolve('discard')
    })
    await act(async () => {
      finish({
        ...initial,
        session: { ...initial.session, revision: 2, encounterCount: 3 }
      })
      await operation
      await result
    })
    expect(await result).toEqual([])
    expect(save).toHaveBeenCalledOnce()
    expect(hook.result.current.workspace.read().draft?.encounterCount).toBe(3)
    expect(hook.result.current.workspace.read().dirty).toBe(false)
  })
})
