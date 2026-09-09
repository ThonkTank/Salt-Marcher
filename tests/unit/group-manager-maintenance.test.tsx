// @vitest-environment jsdom
import type { ReactNode } from 'react'
import {
  act,
  cleanup,
  renderHook,
  render,
  screen,
  fireEvent,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  LiveSessionSnapshot,
  SceneGroupCommandResult
} from '../../src/shared/contracts/live-session.js'
import type { GroupRewardGeneratedRun } from '../../src/shared/contracts/session-generation.js'
import type { SceneGroup } from '../../src/shared/contracts/scene.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import { AsyncCommandCoordinator } from '../../src/renderer/async/async-command-coordinator.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import { applySceneGroupCommandResult } from '../../src/renderer/features/session/session-patches.js'
import { GroupManagerDraftRuntime } from '../../src/renderer/features/session/group-manager-draft-runtime.js'
import { createGroupManagerState } from '../../src/renderer/features/session/group-manager-state.js'
import { groupDraftStateFromGroup } from '../../src/renderer/features/session/group-draft.js'
import { GroupManagerView } from '../../src/renderer/features/session/group-manager-view.js'
import { useGroupManagerController } from '../../src/renderer/features/session/use-group-manager-controller.js'
import type { GroupManagerPorts } from '../../src/renderer/features/session/use-group-manager-capability-ports.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'

vi.mock(
  '../../src/renderer/features/session/use-group-manager-queries.js',
  () => ({
    useGroupManagerQueries: () => ({ searchBiomeOptions: vi.fn() })
  })
)
vi.mock(
  '../../src/renderer/features/creature-collection/creature-collection.js',
  () => ({
    CreatureCollectionManagerDialog: (props: { tools: ReactNode }) =>
      props.tools
  })
)
vi.mock('../../src/renderer/features/session/group-manager-catalog.js', () => ({
  GroupManagerCatalogTools: () => null,
  GroupManagerCatalogPane: () => null
}))
let resolution: MaintenanceDraftResolution | undefined
afterEach(() => {
  resolution?.release()
  resolution = undefined
  cleanup()
})

describe('group maintenance owner', () => {
  it('retains partial saves and retries only the remaining group with the latest scene revision', async () => {
    const runtime = dirtyRuntime()
    const saveGroup = vi
      .fn<GroupManagerPorts['scene']['saveGroup']>()
      .mockImplementationOnce(saveResult)
      .mockRejectedValueOnce(new Error('second failed'))
      .mockImplementation(saveResult)
    const ports = mockPorts(saveGroup)
    const coordinator = new AsyncCommandCoordinator()
    await expect(runtime.saveAll(ports, coordinator, vi.fn())).rejects.toThrow(
      'B edited'
    )
    expect(runtime.snapshot().snapshot.scene.revision).toBe(2)
    expect(runtime.snapshot().state.sessions['a']?.sourceRevision).toBe(2)
    expect(runtime.isDirty()).toBe(true)
    await expect(runtime.saveAll(ports, coordinator, vi.fn())).resolves.toBe(
      true
    )
    expect(saveGroup.mock.calls.map((call) => [call[1], call[6]])).toEqual([
      ['a', 1],
      ['b', 2],
      ['b', 2]
    ])
    expect(runtime.snapshot().snapshot.scene.revision).toBe(3)
    expect(runtime.isDirty()).toBe(false)
  })

  it('discards remaining drafts while preserving a confirmed partial save', async () => {
    const runtime = dirtyRuntime()
    const saveGroup = vi
      .fn<GroupManagerPorts['scene']['saveGroup']>()
      .mockImplementationOnce(saveResult)
      .mockRejectedValue(new Error('failed'))
    const coordinator = new AsyncCommandCoordinator()
    await expect(
      runtime.saveAll(mockPorts(saveGroup), coordinator, vi.fn())
    ).rejects.toThrow()
    await runtime.discardAll(coordinator)
    expect(runtime.isDirty()).toBe(false)
    expect(
      runtime
        .snapshot()
        .snapshot.scene.scenes[0]?.groups.find((group) => group.id === 'a')
        ?.name
    ).toBe('A edited')
    expect(
      runtime
        .snapshot()
        .snapshot.scene.scenes[0]?.groups.find((group) => group.id === 'b')
        ?.name
    ).toBe('B')
    expect(saveGroup).toHaveBeenCalledTimes(2)
  })

  it('waits for the complete pending controller operation before collecting drafts', async () => {
    const runtime = runtimeFor(snapshot())
    const gate = deferred<void>()
    const operation = runtime.run(async () => {
      await gate.promise
      runtime.dispatch({
        kind: 'mutate-group',
        mutation: { kind: 'name', update: 'After generation' }
      })
    })
    const saveGroup = vi
      .fn<GroupManagerPorts['scene']['saveGroup']>()
      .mockImplementation(saveResult)
    const saved = runtime.saveAll(
      mockPorts(saveGroup),
      new AsyncCommandCoordinator(),
      vi.fn()
    )
    await Promise.resolve()
    expect(saveGroup).not.toHaveBeenCalled()
    gate.resolve()
    await operation
    expect(await saved).toBe(true)
    expect(saveGroup.mock.calls[0]?.[2]).toBe('After generation')
  })

  it('commits an unmodified generated reward and does not repeat it on a second resolution', async () => {
    const runtime = runtimeFor(snapshot())
    runtime.dispatch({
      kind: 'loot-generated',
      key: 'a',
      run: { id: 'run', treasures: [] } as unknown as GroupRewardGeneratedRun,
      draft: { label: 'Kein zusätzlicher Loot', items: [], containers: [] },
      seed: 1
    })
    const saveGroup = vi
      .fn<GroupManagerPorts['scene']['saveGroup']>()
      .mockImplementation(saveResult)
    const commitGroupReward = vi
      .fn<GroupManagerPorts['loot']['commitGroupReward']>()
      .mockResolvedValue({
        treasure: null,
        groupResult: await saveResult(
          'scene',
          'a',
          'A',
          '',
          'hostile',
          [],
          1,
          1
        )
      })
    const ports = {
      ...mockPorts(saveGroup),
      loot: { ...mockPorts(saveGroup).loot, commitGroupReward }
    } satisfies GroupManagerPorts
    const coordinator = new AsyncCommandCoordinator()
    expect(await runtime.saveAll(ports, coordinator, vi.fn())).toBe(true)
    expect(await runtime.saveAll(ports, coordinator, vi.fn())).toBe(true)
    expect(commitGroupReward).toHaveBeenCalledOnce()
    expect(saveGroup).not.toHaveBeenCalled()
    expect(runtime.isDirty()).toBe(false)
  })

  it('waits before discarding and keeps the snapshot confirmed by a pending save', async () => {
    const runtime = dirtyRuntime()
    const gate = deferred<void>()
    const operation = runtime.run(async () => {
      await gate.promise
      runtime.acceptSnapshot({ ...snapshot(), revision: 7 })
    })
    const discarded = vi.fn()
    const discard = runtime
      .discardAll(new AsyncCommandCoordinator())
      .then(discarded)
    await Promise.resolve()
    expect(discarded).not.toHaveBeenCalled()
    gate.resolve()
    await operation
    await discard
    expect(runtime.snapshot().snapshot.revision).toBe(7)
    expect(runtime.isDirty()).toBe(false)
  })

  it('retries only receipt reads and refreshes later work before releasing an unknown loot commit', async () => {
    const runtime = runtimeFor(snapshot())
    runtime.dispatch({
      kind: 'loot-generated',
      key: 'a',
      run: { id: 'run', treasures: [] } as unknown as GroupRewardGeneratedRun,
      draft: { label: 'No loot', items: [], containers: [] },
      seed: 1
    })
    const commitGroupReward = vi
      .fn<GroupManagerPorts['loot']['commitGroupReward']>()
      .mockRejectedValue(new CapabilityError('outcome_unknown', false))
    const receipt = {
      treasure: null,
      groupResult: await saveResult('scene', 'a', 'A', '', 'hostile', [], 1, 1)
    }
    const groupRewardReceipt = vi
      .fn<GroupManagerPorts['loot']['groupRewardReceipt']>()
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValue(receipt)
    const fresh = snapshot()
    const current = {
      ...fresh,
      revision: 7,
      scene: {
        ...fresh.scene,
        revision: 7,
        scenes: [
          {
            ...fresh.scene.scenes[0]!,
            groups: [group('a', 'Later persisted work', 3), group('b', 'B')]
          }
        ]
      }
    }
    const read = vi
      .fn<GroupManagerPorts['session']['read']>()
      .mockRejectedValueOnce(new Error('snapshot unavailable'))
      .mockResolvedValue(current)
    const ports = {
      ...mockPorts(vi.fn()),
      loot: {
        ...mockPorts(vi.fn()).loot,
        commitGroupReward,
        groupRewardReceipt
      },
      session: { read }
    } satisfies GroupManagerPorts
    const coordinator = new AsyncCommandCoordinator()
    await expect(runtime.saveAll(ports, coordinator, vi.fn())).rejects.toThrow()
    expect(runtime.canReconcile()).toBe(true)
    await expect(runtime.reconcileUnknown()).rejects.toThrow('read failed')
    await expect(runtime.reconcileUnknown()).rejects.toThrow(
      'snapshot unavailable'
    )
    expect(runtime.snapshot().state.sessions['a']?.sourceRevision).toBe(1)
    expect(runtime.snapshot().uncertain).toBe(true)
    expect(await runtime.saveAll(ports, coordinator, vi.fn())).toBe(true)
    expect(runtime.snapshot().snapshot).toBe(current)
    expect(runtime.snapshot().state.sessions['a']?.group.name).toBe(
      'Later persisted work'
    )
    expect(runtime.snapshot().uncertain).toBe(false)
    expect(commitGroupReward).toHaveBeenCalledOnce()
    expect(groupRewardReceipt).toHaveBeenCalledTimes(3)
    for (const [request] of groupRewardReceipt.mock.calls)
      expect(request).toBe(commitGroupReward.mock.calls[0]?.[0])
  })

  it('exposes an explicit read retry after canceled maintenance without closing the editor', async () => {
    const initial = snapshot()
    const props = {
      snapshot: initial,
      group: initial.scene.scenes[0]!.groups[0]!,
      close: vi.fn(),
      saved: vi.fn(),
      lootChanged: vi.fn(),
      inspect: vi.fn(),
      onError: vi.fn(),
      reinforcementMode: false
    }
    const commitGroupReward = vi
      .fn<GroupManagerPorts['loot']['commitGroupReward']>()
      .mockRejectedValue(new CapabilityError('outcome_unknown', false))
    const result = await saveResult('scene', 'a', 'A', '', 'hostile', [], 1, 1)
    const receipt = { treasure: null, groupResult: result }
    const groupRewardReceipt = vi
      .fn<GroupManagerPorts['loot']['groupRewardReceipt']>()
      .mockRejectedValueOnce(new Error('receipt unavailable'))
      .mockResolvedValue(receipt)
    const fresh = {
      ...initial,
      revision: 2,
      scene: {
        ...initial.scene,
        revision: 2,
        scenes: [
          {
            ...initial.scene.scenes[0]!,
            groups: [group('a', 'A', 2), group('b', 'B')]
          }
        ]
      }
    }
    const read = vi
      .fn<GroupManagerPorts['session']['read']>()
      .mockResolvedValue(fresh)
    const ports = {
      ...mockPorts(vi.fn()),
      loot: {
        ...mockPorts(vi.fn()).loot,
        commitGroupReward,
        groupRewardReceipt
      },
      session: { read }
    } satisfies GroupManagerPorts
    const hook = renderHook(() => useGroupManagerController(props, ports))
    act(() =>
      hook.result.current.dispatch({
        kind: 'loot-generated',
        key: 'a',
        run: { id: 'run', treasures: [] } as unknown as GroupRewardGeneratedRun,
        draft: { label: 'No loot', items: [], containers: [] },
        seed: 1
      })
    )
    act(() => {
      resolution = maintenanceDraftCoordinator.begin()
    })
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    act(() => {
      resolution!.release()
      resolution = undefined
    })
    expect(hook.result.current.canReconcile).toBe(true)
    await act(async () => {
      await hook.result.current.retryUnknown()
    })
    expect(props.onError).toHaveBeenCalledOnce()
    act(() => hook.result.current.setName('Blocked edit'))
    expect(hook.result.current.group.name).toBe('A')
    await act(async () => {
      await hook.result.current.retryUnknown()
    })
    expect(hook.result.current.uncertain).toBe(false)
    expect(props.saved).not.toHaveBeenCalled()
    expect(props.close).not.toHaveBeenCalled()
    expect(commitGroupReward).toHaveBeenCalledOnce()
    act(() => hook.result.current.setName('Allowed edit'))
    expect(hook.result.current.group.name).toBe('Allowed edit')
  })

  it('lets the user click the rendered retry button and disables it while reading', async () => {
    const initial = snapshot()
    const props = {
      snapshot: initial,
      group: initial.scene.scenes[0]!.groups[0]!,
      close: vi.fn(),
      saved: vi.fn(),
      lootChanged: vi.fn(),
      inspect: vi.fn(),
      onError: vi.fn(),
      reinforcementMode: false
    }
    const commitGroupReward = vi
      .fn<GroupManagerPorts['loot']['commitGroupReward']>()
      .mockRejectedValue(new CapabilityError('outcome_unknown', false))
    const receipt = {
      treasure: null,
      groupResult: await saveResult('scene', 'a', 'A', '', 'hostile', [], 1, 1)
    }
    const groupRewardReceipt = vi
      .fn<GroupManagerPorts['loot']['groupRewardReceipt']>()
      .mockResolvedValue(receipt)
    const gate = deferred<LiveSessionSnapshot>()
    const read = vi
      .fn<GroupManagerPorts['session']['read']>()
      .mockReturnValue(gate.promise)
    const ports = {
      ...mockPorts(vi.fn()),
      loot: {
        ...mockPorts(vi.fn()).loot,
        commitGroupReward,
        groupRewardReceipt
      },
      session: { read }
    } satisfies GroupManagerPorts
    function Harness() {
      const controller = useGroupManagerController(props, ports)
      return (
        <>
          <button
            onClick={() =>
              controller.dispatch({
                kind: 'loot-generated',
                key: 'a',
                run: {
                  id: 'run',
                  treasures: []
                } as unknown as GroupRewardGeneratedRun,
                draft: { label: 'No loot', items: [], containers: [] },
                seed: 1
              })
            }
          >
            Prepare reward
          </button>
          <GroupManagerView controller={controller} />
        </>
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByText('Prepare reward'))
    act(() => {
      resolution = maintenanceDraftCoordinator.begin()
    })
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    act(() => {
      resolution!.release()
      resolution = undefined
    })
    const button = screen.getByRole('button', {
      name: 'Speicherstand erneut prüfen'
    })
    fireEvent.click(button)
    expect(button).toHaveProperty('disabled', true)
    await act(async () => {
      gate.resolve({
        ...initial,
        revision: 2,
        scene: {
          ...initial.scene,
          revision: 2,
          scenes: [
            {
              ...initial.scene.scenes[0]!,
              groups: [group('a', 'A', 2), group('b', 'B')]
            }
          ]
        }
      })
      await gate.promise
    })
    expect(
      screen.queryByRole('button', { name: 'Speicherstand erneut prüfen' })
    ).toBeNull()
    expect(commitGroupReward).toHaveBeenCalledOnce()
    expect(groupRewardReceipt).toHaveBeenCalledOnce()
    expect(props.saved).not.toHaveBeenCalled()
  })

  it('recovers a lost new-group response without creating another group', async () => {
    const initial = snapshot()
    const runtime = new GroupManagerDraftRuntime(
      createGroupManagerState({
        activeKey: 'new',
        initialGroup: null,
        prospectiveGroupId: 'prospective',
        locationId: null
      }),
      initial
    )
    runtime.dispatch({
      kind: 'mutate-group',
      mutation: { kind: 'name', update: 'New group' }
    })
    const saveGroup = vi
      .fn<GroupManagerPorts['scene']['saveGroup']>()
      .mockRejectedValue(new CapabilityError('outcome_unknown', false))
    const receipt = await saveResult(
      'scene',
      null,
      'New group',
      '',
      'hostile',
      [],
      1,
      null
    )
    const groupSaveReceipt = vi
      .fn<GroupManagerPorts['scene']['groupSaveReceipt']>()
      .mockResolvedValue(receipt)
    const fresh = {
      ...initial,
      revision: 2,
      scene: {
        ...initial.scene,
        revision: 2,
        scenes: [
          {
            ...initial.scene.scenes[0]!,
            groups: [
              ...initial.scene.scenes[0]!.groups,
              receipt.scenePatch.upsertedGroups[0]!
            ]
          }
        ]
      }
    }
    const base = mockPorts(saveGroup)
    const ports = {
      ...base,
      scene: { ...base.scene, groupSaveReceipt },
      session: {
        read: vi
          .fn<GroupManagerPorts['session']['read']>()
          .mockResolvedValue(fresh)
      }
    }
    const coordinator = new AsyncCommandCoordinator()
    await expect(runtime.saveAll(ports, coordinator, vi.fn())).rejects.toThrow()
    expect(await runtime.saveAll(ports, coordinator, vi.fn())).toBe(true)
    expect(saveGroup).toHaveBeenCalledOnce()
    expect(groupSaveReceipt.mock.calls[0]?.[0].commandId).toBe(
      saveGroup.mock.calls[0]?.[8]
    )
    expect(runtime.snapshot().state.sessions['new']).toBeUndefined()
    expect(runtime.snapshot().state.sessions['created']?.sourceRevision).toBe(1)
    expect(runtime.snapshot().snapshot).toBe(fresh)
  })

  it('keeps unknown state when receipt reads fail without replaying or discarding', async () => {
    const runtime = dirtyRuntime()
    const saveGroup = vi
      .fn<GroupManagerPorts['scene']['saveGroup']>()
      .mockRejectedValue(new CapabilityError('outcome_unknown', false))
    const base = mockPorts(saveGroup)
    const ports = {
      ...base,
      scene: {
        ...base.scene,
        groupSaveReceipt: () => Promise.reject(new Error('receipt unavailable'))
      }
    }
    const coordinator = new AsyncCommandCoordinator()
    await expect(runtime.saveAll(ports, coordinator, vi.fn())).rejects.toThrow()
    await expect(runtime.saveAll(ports, coordinator, vi.fn())).rejects.toThrow(
      'receipt unavailable'
    )
    await expect(runtime.discardAll(coordinator)).rejects.toThrow(
      'receipt unavailable'
    )
    expect(saveGroup).toHaveBeenCalledOnce()
    expect(runtime.isDirty()).toBe(true)
  })

  it.each(['save', 'discard'] as const)(
    'resolves an absent normal save and allows %s without acknowledging the draft',
    async (next) => {
      const runtime = dirtyRuntime()
      const saveGroup = vi
        .fn<GroupManagerPorts['scene']['saveGroup']>()
        .mockRejectedValueOnce(new CapabilityError('outcome_unknown', false))
        .mockImplementation(saveResult)
      const base = mockPorts(saveGroup)
      const read = vi
        .fn<GroupManagerPorts['session']['read']>()
        .mockRejectedValueOnce(new Error('snapshot unavailable'))
        .mockResolvedValue(snapshot())
      const ports = { ...base, session: { read } }
      const coordinator = new AsyncCommandCoordinator()
      await expect(
        runtime.saveAll(ports, coordinator, vi.fn())
      ).rejects.toThrow()
      await expect(runtime.reconcileUnknown()).rejects.toThrow(
        'snapshot unavailable'
      )
      expect(runtime.snapshot().uncertain).toBe(true)
      expect(await runtime.reconcileUnknown()).toBe(true)
      expect(runtime.snapshot().uncertain).toBe(false)
      expect(runtime.isDirty()).toBe(true)
      expect(runtime.snapshot().state.sessions['a']?.group.name).toBe(
        'A edited'
      )
      expect(runtime.snapshot().state.sessions['a']?.sourceRevision).toBe(1)
      expect(runtime.snapshot().state.sessions['a']?.group.message).toContain(
        'nicht gespeichert'
      )
      expect(saveGroup).toHaveBeenCalledOnce()
      if (next === 'save') {
        expect(await runtime.saveAll(ports, coordinator, vi.fn())).toBe(true)
        expect(saveGroup).toHaveBeenCalledTimes(3)
      } else {
        expect(await runtime.discardAll(coordinator)).toBe(true)
        expect(saveGroup).toHaveBeenCalledOnce()
      }
    }
  )

  it('allows discarding an absent reward commit without writing or acknowledging generated loot', async () => {
    const runtime = runtimeFor(snapshot())
    runtime.dispatch({
      kind: 'loot-generated',
      key: 'a',
      run: { id: 'run', treasures: [] } as unknown as GroupRewardGeneratedRun,
      draft: { label: 'No loot', items: [], containers: [] },
      seed: 1
    })
    const commitGroupReward = vi
      .fn<GroupManagerPorts['loot']['commitGroupReward']>()
      .mockRejectedValue(new CapabilityError('outcome_unknown', false))
    const groupRewardReceipt = vi
      .fn<GroupManagerPorts['loot']['groupRewardReceipt']>()
      .mockResolvedValue(null)
    const saveGroup = vi.fn<GroupManagerPorts['scene']['saveGroup']>()
    const ports = {
      ...mockPorts(saveGroup),
      loot: {
        ...mockPorts(saveGroup).loot,
        commitGroupReward,
        groupRewardReceipt
      },
      session: { read: () => Promise.resolve(snapshot()) }
    }
    const coordinator = new AsyncCommandCoordinator()
    await expect(runtime.saveAll(ports, coordinator, vi.fn())).rejects.toThrow()
    expect(await runtime.reconcileUnknown()).toBe(true)
    expect(runtime.isDirty()).toBe(true)
    expect(
      runtime.snapshot().state.sessions['a']?.loot.committedSignature
    ).toBeNull()
    expect(runtime.snapshot().state.sessions['a']?.loot.error).toContain(
      'nicht gespeichert'
    )
    await runtime.discardAll(coordinator)
    expect(runtime.isDirty()).toBe(false)
    expect(commitGroupReward).toHaveBeenCalledOnce()
    expect(saveGroup).not.toHaveBeenCalled()
  })

  it('waits for a normal save started before maintenance without closing early or saving twice', async () => {
    const initial = snapshot()
    const gate = deferred<SceneGroupCommandResult>()
    const saveGroup = vi
      .fn<GroupManagerPorts['scene']['saveGroup']>()
      .mockReturnValue(gate.promise)
    const props = {
      snapshot: initial,
      group: initial.scene.scenes[0]!.groups[0]!,
      close: vi.fn(),
      saved: vi.fn(),
      lootChanged: vi.fn(),
      inspect: vi.fn(),
      onError: vi.fn(),
      reinforcementMode: false
    }
    const ports = mockPorts(saveGroup)
    const hook = renderHook(() => useGroupManagerController(props, ports))
    act(() => hook.result.current.setName('Saved before maintenance'))
    act(() => hook.result.current.save())
    act(() => hook.result.current.confirmPendingIntent())
    act(() => {
      resolution = maintenanceDraftCoordinator.begin()
    })
    let resolving!: ReturnType<MaintenanceDraftResolution['resolve']>
    act(() => {
      resolving = resolution!.resolve('save')
    })
    expect(props.saved).not.toHaveBeenCalled()
    await act(async () => {
      gate.resolve(
        await saveResult(
          'scene',
          'a',
          'Saved before maintenance',
          '',
          'hostile',
          [],
          1,
          1
        )
      )
      expect(await resolving).toEqual([])
    })
    expect(saveGroup).toHaveBeenCalledOnce()
    expect(props.saved).toHaveBeenCalledOnce()
  })

  it('publishes confirmed partial work when maintenance is canceled and remaining drafts are discarded', async () => {
    const initial = snapshot()
    const saveGroup = vi
      .fn<GroupManagerPorts['scene']['saveGroup']>()
      .mockImplementationOnce(saveResult)
      .mockRejectedValue(new Error('failed'))
    const props = {
      snapshot: initial,
      group: initial.scene.scenes[0]!.groups[0]!,
      close: vi.fn(),
      saved: vi.fn(),
      lootChanged: vi.fn(),
      inspect: vi.fn(),
      onError: vi.fn(),
      reinforcementMode: false
    }
    const ports = mockPorts(saveGroup)
    const hook = renderHook(() => useGroupManagerController(props, ports))
    act(() => hook.result.current.setName('A edited'))
    act(() => hook.result.current.activate('b'))
    act(() => hook.result.current.setName('B edited'))
    act(() => {
      resolution = maintenanceDraftCoordinator.begin()
    })
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    act(() => {
      resolution!.release()
      resolution = undefined
    })
    act(() => hook.result.current.close())
    act(() => hook.result.current.confirmPendingIntent())
    expect(props.saved).toHaveBeenCalledOnce()
    expect(props.saved.mock.calls[0]?.[0]).toMatchObject({
      scene: { revision: 2 }
    })
    expect(saveGroup).toHaveBeenCalledTimes(2)
  })

  it('resolves every group through the registered owner and blocks direct edits under maintenance', async () => {
    const initial = snapshot()
    const saved = vi.fn()
    const saveGroup = vi
      .fn<GroupManagerPorts['scene']['saveGroup']>()
      .mockImplementationOnce(saveResult)
      .mockRejectedValueOnce(new Error('second failed'))
      .mockImplementation(saveResult)
    const props = {
      snapshot: initial,
      group: initial.scene.scenes[0]!.groups[0]!,
      close: vi.fn(),
      saved,
      lootChanged: vi.fn(),
      inspect: vi.fn(),
      onError: vi.fn(),
      reinforcementMode: false
    }
    const ports = mockPorts(saveGroup)
    const hook = renderHook(() => useGroupManagerController(props, ports))
    act(() => hook.result.current.setName('A edited'))
    act(() => hook.result.current.activate('b'))
    act(() => hook.result.current.setName('B edited'))
    act(() => {
      resolution = maintenanceDraftCoordinator.begin()
    })
    act(() => {
      hook.result.current.setName('Blocked')
      hook.result.current.activate('a')
      hook.result.current.close()
    })
    expect(hook.result.current.group.name).toBe('B edited')
    expect(hook.result.current.selection).toBe('b')
    expect(props.close).not.toHaveBeenCalled()
    await act(async () => {
      const failures = await resolution!.resolve('save')
      expect(failures).toHaveLength(1)
      expect(failures[0]?.label).toBe('Gruppenverwaltung')
    })
    expect(saved).not.toHaveBeenCalled()
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(saved).toHaveBeenCalledOnce()
    expect(saveGroup.mock.calls.map((call) => call[1])).toEqual(['a', 'b', 'b'])
    expect(saved.mock.calls[0]?.[0]).toMatchObject({ scene: { revision: 3 } })
  })
})

describe('group archive lifecycle', () => {
  it.each(['save', 'discard', 'cancel'] as const)(
    'resolves changed drafts with %s before archiving',
    async (choice) => {
      const f = archiveFixture()
      act(() => f.controller().setName('Edited before archive'))
      act(() => f.controller().archive())
      await screen.findByRole('alertdialog', { name: 'Gruppe archivieren' })
      expect(f.execute).not.toHaveBeenCalled()
      expect(f.props.saved).not.toHaveBeenCalled()
      fireEvent.click(
        screen.getByText(
          choice === 'save'
            ? 'Speichern und fortfahren'
            : choice === 'discard'
              ? 'Verwerfen und fortfahren'
              : 'Abbrechen'
        )
      )
      if (choice === 'cancel') {
        await waitFor(() =>
          expect(screen.queryByRole('alertdialog')).toBeNull()
        )
        expect(f.controller().group.name).toBe('Edited before archive')
        expect(f.execute).not.toHaveBeenCalled()
        return
      }
      await waitFor(() => expect(f.props.saved).toHaveBeenCalledOnce())
      expect(f.saveGroup).toHaveBeenCalledTimes(choice === 'save' ? 1 : 0)
      expect(f.execute).toHaveBeenCalledOnce()
      expect(f.execute.mock.calls[0]?.[0].command).toEqual({
        kind: 'archive',
        input: {
          sceneId: 'scene',
          groupId: 'a',
          archived: true,
          expectedGroupRevision: choice === 'save' ? 2 : 1
        }
      })
      expect(f.current().scene.scenes[0]!.groups[0]!.name).toBe(
        choice === 'save' ? 'Edited before archive' : 'A'
      )
      expect(f.current().scene.scenes[0]!.groups[0]!.archived).toBe(true)
    }
  )
  it('keeps the archive unsubmitted when saving the draft fails', async () => {
    const f = archiveFixture()
    f.saveGroup.mockRejectedValue(new Error('save failed'))
    act(() => f.controller().setName('Keep me'))
    act(() => f.controller().archive())
    fireEvent.click(await screen.findByText('Speichern und fortfahren'))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Gruppenverwaltung'
      )
    )
    expect(f.execute).not.toHaveBeenCalled()
    expect(f.props.saved).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Abbrechen'))
    expect(f.controller().group.name).toBe('Keep me')
  })
  it.each([false, true])(
    'holds a lost archive reply through status failure (detached=%s)',
    async (detached) => {
      const f = archiveFixture()
      const write = f.execute.getMockImplementation()!
      f.execute.mockImplementation(async (input) => {
        await write(input)
        throw new Error('lost reply')
      })
      f.status.mockRejectedValueOnce(new Error('status unavailable'))
      act(() => f.controller().archive())
      await screen.findByText('Speicherstatus erneut prüfen')
      act(() => f.controller().setName('Blocked edit'))
      expect(f.controller().group.name).toBe('A')
      if (detached) f.view.unmount()
      act(() => {
        resolution = maintenanceDraftCoordinator.begin()
      })
      await act(async () => {
        expect((await resolution!.resolve('discard')).length).toBeGreaterThan(0)
      })
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
      await act(async () => {
        expect(await resolution!.resolve('discard')).toEqual([])
      })
      expect(f.status).toHaveBeenLastCalledWith(f.execute.mock.calls[0]![0])
      expect(f.execute).toHaveBeenCalledOnce()
      expect(f.props.saved).not.toHaveBeenCalled()
      expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
      expect(f.current().scene.scenes[0]!.groups[0]!.archived).toBe(true)
    }
  )
})

function archiveFixture() {
  let current = snapshot()
  let receipt: SceneGroupCommandResult | null = null
  const saveGroup = vi
    .fn<GroupManagerPorts['scene']['saveGroup']>()
    .mockImplementation(async (...args) => {
      const result = await saveResult(...args)
      current = applySceneGroupCommandResult(current, result)
      return result
    })
  const execute = vi
    .fn<GroupManagerPorts['lifecycle']['execute']>()
    .mockImplementation((input) => {
      const original = current.scene.scenes[0]!.groups[0]!
      const result: SceneGroupCommandResult = {
        combat: null,
        scenePatch: {
          sceneId: 'scene',
          sceneRevision: current.scene.revision + 1,
          upsertedGroups: [
            {
              ...original,
              archived: true,
              revision: input.command.input.expectedGroupRevision + 1
            }
          ],
          removedGroupIds: []
        }
      }
      receipt = result
      current = applySceneGroupCommandResult(current, result)
      return Promise.resolve(result)
    })
  const status = vi
    .fn<GroupManagerPorts['lifecycle']['status']>()
    .mockImplementation(() => Promise.resolve({ receipt, snapshot: current }))
  const ports = {
    ...mockPorts(saveGroup),
    lifecycle: {
      execute,
      status,
      current: () => current,
      refresh: () => Promise.resolve(current)
    }
  }
  const props = {
    snapshot: current,
    group: current.scene.scenes[0]!.groups[0]!,
    close: vi.fn(),
    saved: vi.fn(),
    lootChanged: vi.fn(),
    inspect: vi.fn(),
    onError: vi.fn(),
    reinforcementMode: false
  }
  let controller!: ReturnType<typeof useGroupManagerController>
  function View() {
    controller = useGroupManagerController(props, ports)
    return (
      <>
        {controller.archiveDialog}
        {controller.lifecycleNotice}
      </>
    )
  }
  const view = render(
    <ModalLayerProvider>
      <View />
    </ModalLayerProvider>
  )
  return {
    view,
    controller: () => controller,
    props,
    saveGroup,
    execute,
    status,
    current: () => current
  }
}

function group(id: string, name: string, revision = 1): SceneGroup {
  return {
    id,
    name,
    revision,
    note: '',
    disposition: 'hostile',
    archived: false,
    baseXp: 0,
    position: 0,
    entries: []
  }
}
function snapshot(): LiveSessionSnapshot {
  return {
    revision: 1,
    party: { revision: 1, members: [] },
    combat: null,
    scene: {
      revision: 1,
      focusedSceneId: 'scene',
      scenes: [
        {
          id: 'scene',
          title: 'Scene',
          locationId: null,
          locationName: null,
          partyMemberIds: [],
          groups: [group('a', 'A'), group('b', 'B')]
        }
      ]
    }
  } as unknown as LiveSessionSnapshot
}
function runtimeFor(initial: LiveSessionSnapshot) {
  return new GroupManagerDraftRuntime(
    createGroupManagerState({
      activeKey: 'a',
      initialGroup: initial.scene.scenes[0]!.groups[0]!,
      prospectiveGroupId: 'new-id',
      locationId: null
    }),
    initial
  )
}
function dirtyRuntime() {
  const initial = snapshot()
  const runtime = runtimeFor(initial)
  runtime.dispatch({
    kind: 'mutate-group',
    mutation: { kind: 'name', update: 'A edited' }
  })
  runtime.dispatch({
    kind: 'activate',
    key: 'b',
    fallback: groupDraftStateFromGroup(initial.scene.scenes[0]!.groups[1]),
    sourceRevision: 1
  })
  runtime.dispatch({
    kind: 'mutate-group',
    mutation: { kind: 'name', update: 'B edited' }
  })
  return runtime
}
function saveResult(
  ...args: Parameters<GroupManagerPorts['scene']['saveGroup']>
): Promise<SceneGroupCommandResult> {
  const [sceneId, id, name, , , , expectedRevision, expectedGroupRevision] =
    args
  return Promise.resolve({
    combat: null,
    scenePatch: {
      sceneId,
      sceneRevision: expectedRevision + 1,
      upsertedGroups: [
        group(id ?? 'created', name, (expectedGroupRevision ?? 0) + 1)
      ],
      removedGroupIds: []
    }
  } as SceneGroupCommandResult)
}
function mockPorts(
  saveGroup: GroupManagerPorts['scene']['saveGroup']
): GroupManagerPorts {
  return {
    lifecycle: {
      execute: vi.fn(),
      status: vi.fn(),
      refresh: vi.fn(),
      current: vi.fn()
    },
    runtime: { e2e: true },
    scene: { saveGroup, groupSaveReceipt: () => Promise.resolve(null) },
    loot: {},
    creatures: {},
    campaignRules: {}
  } as unknown as GroupManagerPorts
}
function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
