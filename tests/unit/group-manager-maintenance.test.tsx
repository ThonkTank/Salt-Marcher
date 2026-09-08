// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  LiveSessionSnapshot,
  SceneGroupCommandResult
} from '../../src/shared/contracts/live-session.js'
import type { GroupRewardGeneratedRun } from '../../src/shared/contracts/session-generation.js'
import type { SceneGroup } from '../../src/shared/contracts/scene.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import { AsyncCommandCoordinator } from '../../src/renderer/async/async-command-coordinator.js'
import { GroupManagerDraftRuntime } from '../../src/renderer/features/session/group-manager-draft-runtime.js'
import { createGroupManagerState } from '../../src/renderer/features/session/group-manager-state.js'
import { groupDraftStateFromGroup } from '../../src/renderer/features/session/group-draft.js'
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

  it('does not replay or discard an unknown write outcome', async () => {
    const runtime = dirtyRuntime()
    const saveGroup = vi
      .fn<GroupManagerPorts['scene']['saveGroup']>()
      .mockRejectedValue(new CapabilityError('outcome_unknown', false))
    const coordinator = new AsyncCommandCoordinator()
    await expect(
      runtime.saveAll(mockPorts(saveGroup), coordinator, vi.fn())
    ).rejects.toThrow()
    await expect(
      runtime.saveAll(mockPorts(saveGroup), coordinator, vi.fn())
    ).rejects.toThrow('unbekannt')
    await expect(runtime.discardAll(coordinator)).rejects.toThrow('unbekannt')
    expect(saveGroup).toHaveBeenCalledOnce()
    expect(runtime.isDirty()).toBe(true)
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
    runtime: { e2e: true },
    scene: { saveGroup },
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
