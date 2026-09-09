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
  ),
  settlePreparations?: (
    choice: 'save' | 'discard'
  ) => Promise<SessionPlannerWorkspace>,
  overrides: Partial<SessionPlannerPort> = {},
  dependencies?: () => readonly string[]
) {
  const coordinator = new AsyncCommandCoordinator()
  const semanticPlanner = {
    commandStatus: vi
      .fn()
      .mockRejectedValue(
        new Error('Befehlsausgang unbekannt: Abgleich nicht erreichbar.')
      ),
    read: () => Promise.resolve(initial),
    save,
    ...overrides
  } as unknown as SessionPlannerPort
  const executeCommand = vi.fn<SessionPlannerPort['executeCommand']>(
    async ({ command }) => {
      switch (command.kind) {
        case 'save':
          return semanticPlanner.save(command.input)
        case 'create':
          return semanticPlanner.create(command.input.name)
        case 'open':
          return semanticPlanner.open(command.input.sessionId)
        case 'switch':
          return semanticPlanner.switch(
            command.input.targetSessionId,
            command.input.source
          )
        case 'rename':
          return semanticPlanner.rename(
            command.input.sessionId,
            command.input.expectedRevision,
            command.input.name
          )
        case 'delete':
          return semanticPlanner.delete(
            command.input.sessionId,
            command.input.expectedRevision
          )
      }
    }
  )
  const planner: SessionPlannerPort = { ...semanticPlanner, executeCommand }
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
      onError,
      coordinator,
      read: workspace.read,
      applyWorkspace: workspace.applyWorkspace,
      saveDraft: sessions.saveDraft,
      ...(settlePreparations ? { settlePreparations } : {}),
      dialogs: {
        isOpen: sessions.hasOpenDialog,
        settle: sessions.settleDialogs
      },
      ...(dependencies ? { dependencies } : {}),
      readUnresolved: () => null
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
  return { ...hook, save, planner }
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
  it.each(['treasure', 'distribution'])(
    'blocks a still-loading %s child and settles it before saving the parent draft',
    async (kind) => {
      let open = true
      let childDone = false
      const hook = setup(undefined, undefined, {}, () =>
        open ? [`loading-${kind}`] : []
      )
      await load()
      expect(hook.result.current.workspace.dirty).toBe(false)
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
      act(() =>
        hook.result.current.mutate((draft) => ({
          ...draft,
          adventureDayFraction: '0.5'
        }))
      )
      begin()
      expect(await resolve('save')).toMatchObject([
        { label: 'Sitzungsplanung' }
      ])
      expect(hook.save).not.toHaveBeenCalled()
      const close = maintenanceDraftCoordinator.register(`loading-${kind}`, {
        label: 'Schatz',
        isDirty: () => !childDone,
        save: () => {
          expect(hook.save).not.toHaveBeenCalled()
          childDone = true
          open = false
          return Promise.resolve(true)
        }
      })
      try {
        expect(await resolve('save')).toEqual([])
        expect(hook.save).toHaveBeenCalledOnce()
        expect(hook.result.current.workspace.dirty).toBe(false)
      } finally {
        close()
      }
    }
  )
  it.each(['save', 'create', 'open', 'switch', 'rename', 'delete'] as const)(
    'reconciles %s using the original command and latest workspace without replay',
    async (kind) => {
      const fresh = {
        ...initial,
        session: { ...initial.session, revision: 9, name: 'Later work' }
      }
      const status = vi
        .fn<SessionPlannerPort['commandStatus']>()
        .mockRejectedValueOnce(new Error('read unavailable'))
        .mockResolvedValue({ receipt: initial, workspace: fresh })
      const hook = setup(undefined, undefined, { commandStatus: status })
      await load()
      vi.mocked(hook.planner.executeCommand).mockRejectedValueOnce(
        new CapabilityError('outcome_unknown', true)
      )
      if (kind === 'save' || kind === 'switch')
        act(() =>
          hook.result.current.mutate((draft) => ({
            ...draft,
            adventureDayFraction: '0.5'
          }))
        )
      if (kind === 'create' || kind === 'rename')
        act(() => {
          hook.result.current.sessions.setNameDialog(kind)
          hook.result.current.sessions.setName('Requested name')
        })
      if (kind === 'delete')
        act(() => hook.result.current.sessions.setDeleteConfirm(true))
      await act(async () => {
        await hook.result.current.runtime.run(async () => {
          const sessions = hook.result.current.sessions
          if (kind === 'save') await sessions.saveDraft()
          else if (kind === 'create' || kind === 'rename')
            await sessions.submitName()
          else if (kind === 'delete') await sessions.deleteSession()
          else await sessions.openSession('other-session')
        })
      })
      expect(hook.result.current.maintenance.uncertain).toBe(true)
      expect(hook.result.current.maintenance.canReconcile).toBe(true)
      const original = vi.mocked(hook.planner.executeCommand).mock.calls[0]![0]
      expect(original.command.kind).toBe(kind)
      await act(async () => {
        await hook.result.current.maintenance.retryUnknown()
      })
      expect(hook.result.current.maintenance.uncertain).toBe(true)
      await act(async () => {
        await hook.result.current.maintenance.retryUnknown()
      })
      expect(status.mock.calls).toEqual([[original], [original]])
      expect(hook.planner.executeCommand).toHaveBeenCalledOnce()
      expect(hook.result.current.maintenance.uncertain).toBe(false)
      expect(hook.result.current.workspace.read().workspace).toEqual(fresh)
      expect(hook.result.current.workspace.read().dirty).toBe(false)
      expect(hook.result.current.sessions.nameDialog).toBeNull()
      expect(hook.result.current.sessions.deleteConfirm).toBe(false)
    }
  )

  it.each(['save', 'discard'] as const)(
    'reconciles a confirmed save before central %s',
    async (choice) => {
      const fresh = { ...initial, session: { ...initial.session, revision: 5 } }
      const status = vi
        .fn<SessionPlannerPort['commandStatus']>()
        .mockResolvedValue({ receipt: initial, workspace: fresh })
      const hook = setup(undefined, undefined, { commandStatus: status })
      await load()
      act(() =>
        hook.result.current.mutate((draft) => ({
          ...draft,
          adventureDayFraction: '0.5'
        }))
      )
      vi.mocked(hook.planner.executeCommand).mockRejectedValueOnce(
        new CapabilityError('outcome_unknown', true)
      )
      await act(async () => {
        await hook.result.current.save()
      })
      begin()
      expect(await resolve(choice)).toEqual([])
      expect(hook.planner.executeCommand).toHaveBeenCalledOnce()
      expect(hook.result.current.workspace.read().workspace).toEqual(fresh)
    }
  )

  it('keeps an absent save dirty and only writes on the next explicit save', async () => {
    const status = vi
      .fn<SessionPlannerPort['commandStatus']>()
      .mockResolvedValue({ receipt: null, workspace: initial })
    const hook = setup(undefined, undefined, { commandStatus: status })
    await load()
    act(() =>
      hook.result.current.mutate((draft) => ({
        ...draft,
        adventureDayFraction: '0.5'
      }))
    )
    vi.mocked(hook.planner.executeCommand).mockRejectedValueOnce(
      new CapabilityError('outcome_unknown', true)
    )
    await act(async () => {
      await hook.result.current.save()
    })
    await act(async () => {
      await hook.result.current.maintenance.retryUnknown()
    })
    expect(hook.planner.executeCommand).toHaveBeenCalledOnce()
    expect(hook.result.current.workspace.read().dirty).toBe(true)
    expect(hook.result.current.maintenance.uncertain).toBe(false)
    begin()
    expect(await resolve('save')).toEqual([])
    expect(hook.planner.executeCommand).toHaveBeenCalledTimes(2)
  })

  it('preserves newer local edits while acknowledging the original saved command', async () => {
    const fresh = { ...initial, session: { ...initial.session, revision: 4 } }
    const status = vi
      .fn<SessionPlannerPort['commandStatus']>()
      .mockResolvedValue({ receipt: initial, workspace: fresh })
    const hook = setup(undefined, undefined, { commandStatus: status })
    await load()
    act(() =>
      hook.result.current.mutate((draft) => ({
        ...draft,
        adventureDayFraction: '0.5'
      }))
    )
    vi.mocked(hook.planner.executeCommand).mockRejectedValueOnce(
      new CapabilityError('outcome_unknown', true)
    )
    await act(async () => {
      await hook.result.current.save()
    })
    // An external editor continuation can still have newer authored state.
    act(() =>
      hook.result.current.workspace.mutate((draft) => ({
        ...draft,
        adventureDayFraction: '0.75'
      }))
    )
    await act(async () => {
      await hook.result.current.maintenance.retryUnknown()
    })
    expect(
      hook.result.current.workspace.read().draft?.adventureDayFraction
    ).toBe('0.75')
    expect(hook.result.current.workspace.read().dirty).toBe(true)
    expect(hook.planner.executeCommand).toHaveBeenCalledOnce()
  })

  it.each(['create', 'rename'] as const)(
    'saves the draft before %s and retains the final workspace',
    async (operation) => {
      const final = {
        ...initial,
        session: {
          ...initial.session,
          id: operation === 'create' ? 'new-session' : 'session',
          name: 'Neue Küste',
          revision: 3
        }
      }
      const command = vi.fn().mockResolvedValue(final)
      const hook = setup(undefined, () => Promise.resolve(initial), {
        [operation]: command
      })
      await load()
      act(() => {
        hook.result.current.mutate((draft) => ({ ...draft, encounterCount: 3 }))
        hook.result.current.sessions.setNameDialog(operation)
        hook.result.current.sessions.setName('Neue Küste')
        resolution = maintenanceDraftCoordinator.begin()
      })
      expect(await resolve('save')).toEqual([])
      expect(hook.save).toHaveBeenCalledOnce()
      expect(command).toHaveBeenCalledOnce()
      expect(hook.save.mock.invocationCallOrder[0]).toBeLessThan(
        command.mock.invocationCallOrder[0]!
      )
      if (operation === 'rename')
        expect(command).toHaveBeenCalledWith('session', 2, 'Neue Küste')
      else expect(command).toHaveBeenCalledWith('Neue Küste')
      expect(hook.result.current.workspace.read().workspace).toBe(final)
      expect(hook.result.current.sessions.hasOpenDialog()).toBe(false)
    }
  )

  it('retains a confirmed draft save when rename fails and retries only the rename', async () => {
    const renamed = {
      ...initial,
      session: {
        ...initial.session,
        revision: 3,
        name: 'Küste',
        encounterCount: 3
      }
    }
    const rename = vi
      .fn()
      .mockRejectedValueOnce(new Error('rename failed'))
      .mockResolvedValue(renamed)
    const hook = setup(undefined, undefined, { rename })
    await load()
    act(() => {
      hook.result.current.mutate((draft) => ({ ...draft, encounterCount: 3 }))
      hook.result.current.sessions.setNameDialog('rename')
      hook.result.current.sessions.setName('Küste')
    })
    begin()
    expect(await resolve('save')).toMatchObject([{ label: 'Sitzungsplanung' }])
    expect(hook.result.current.workspace.read().dirty).toBe(false)
    expect(
      hook.result.current.workspace.read().workspace?.session.encounterCount
    ).toBe(3)
    expect(hook.result.current.sessions.nameDialog).toBe('rename')
    expect(await resolve('save')).toEqual([])
    expect(hook.save).toHaveBeenCalledOnce()
    expect(rename).toHaveBeenCalledTimes(2)
    expect(rename).toHaveBeenNthCalledWith(2, 'session', 2, 'Küste')
    expect(hook.result.current.workspace.read().workspace).toBe(renamed)
  })

  it.each(['create', 'rename'] as const)(
    'discards %s and the draft without issuing a command',
    async (operation) => {
      const command = vi.fn()
      const hook = setup(undefined, undefined, { [operation]: command })
      await load()
      act(() => {
        hook.result.current.mutate((draft) => ({ ...draft, encounterCount: 3 }))
        hook.result.current.sessions.setNameDialog(operation)
        hook.result.current.sessions.setName('Ungespeichert')
      })
      begin()
      expect(await resolve('discard')).toEqual([])
      expect(hook.save).not.toHaveBeenCalled()
      expect(command).not.toHaveBeenCalled()
      expect(hook.result.current.sessions.hasOpenDialog()).toBe(false)
      expect(hook.result.current.workspace.read().draft?.encounterCount).toBe(1)
    }
  )

  it.each(['save', 'discard'] as const)(
    'closes an unconfirmed deletion during %s without deleting the session',
    async (choice) => {
      const remove = vi.fn()
      const hook = setup(undefined, undefined, { delete: remove })
      await load()
      act(() => hook.result.current.sessions.setDeleteConfirm(true))
      begin()
      expect(await resolve(choice)).toEqual([])
      expect(remove).not.toHaveBeenCalled()
      expect(hook.result.current.sessions.deleteConfirm).toBe(false)
    }
  )

  it('keeps an empty name for correction and permits explicit discard', async () => {
    const create = vi.fn()
    const hook = setup(undefined, undefined, { create })
    await load()
    act(() => hook.result.current.sessions.setNameDialog('create'))
    begin()
    const failures = await resolve('save')
    expect(failures[0]?.message).toContain('Sitzungsnamen')
    expect(hook.result.current.sessions.nameDialog).toBe('create')
    expect(create).not.toHaveBeenCalled()
    expect(await resolve('discard')).toEqual([])
  })

  it('keeps dialog input when maintenance is canceled', async () => {
    const hook = setup()
    await load()
    act(() => {
      hook.result.current.sessions.setNameDialog('rename')
      hook.result.current.sessions.setName('Noch offen')
    })
    begin()
    act(() => {
      resolution!.release()
      resolution = undefined
    })
    expect(hook.result.current.sessions.nameDialog).toBe('rename')
    expect(hook.result.current.sessions.name).toBe('Noch offen')
  })

  it('does not redirect an open rename to a different session returned by preparation settlement', async () => {
    const other = { ...initial, session: { ...initial.session, id: 'other' } }
    const rename = vi.fn()
    const hook = setup(undefined, () => Promise.resolve(other), { rename })
    await load()
    act(() => {
      hook.result.current.sessions.setNameDialog('rename')
      hook.result.current.sessions.setName('Falsches Ziel')
    })
    begin()
    expect(await resolve('save')).toHaveLength(1)
    expect(rename).not.toHaveBeenCalled()
    expect(hook.result.current.sessions.hasOpenDialog()).toBe(true)
    expect(await resolve('discard')).toEqual([])
  })

  it('does not retry or discard a rename with an unknown outcome', async () => {
    const rename = vi
      .fn()
      .mockRejectedValue(new CapabilityError('outcome_unknown', false))
    const hook = setup(undefined, undefined, { rename })
    await load()
    act(() => {
      hook.result.current.sessions.setNameDialog('rename')
      hook.result.current.sessions.setName('Unklar')
    })
    begin()
    expect(await resolve('save')).toHaveLength(1)
    expect(await resolve('save')).toHaveLength(1)
    expect(await resolve('discard')).toHaveLength(1)
    expect(rename).toHaveBeenCalledOnce()
    expect(hook.result.current.sessions.hasOpenDialog()).toBe(true)
  })

  it.each(['save', 'discard'] as const)(
    'preserves the fresh persisted preparation while resolving %s',
    async (choice) => {
      const fresh = {
        ...initial,
        session: { ...initial.session, revision: 2, encounterCount: 7 }
      }
      const settle = vi.fn().mockResolvedValue(fresh)
      const hook = setup(undefined, settle)
      await load()
      act(() =>
        hook.result.current.mutate((draft) => ({ ...draft, encounterCount: 3 }))
      )
      begin()
      const failures = await resolve(choice)
      expect(settle).toHaveBeenCalledWith(choice)
      expect(hook.save).not.toHaveBeenCalled()
      if (choice === 'save') {
        expect(failures).toHaveLength(1)
        expect(failures[0]?.message).toContain('Entwurf bleibt erhalten')
        expect(hook.result.current.workspace.read().draft?.encounterCount).toBe(
          3
        )
        expect(hook.result.current.workspace.read().dirty).toBe(true)
      } else {
        expect(failures).toEqual([])
        expect(hook.result.current.workspace.read().draft?.encounterCount).toBe(
          7
        )
        expect(hook.result.current.workspace.read().workspace).toBe(fresh)
      }
    }
  )

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
  it('waits for the whole action and discards a dialog opened by its final continuation', async () => {
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
    expect(await result).toEqual([])
    expect(hook.result.current.sessions.hasOpenDialog()).toBe(false)
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
