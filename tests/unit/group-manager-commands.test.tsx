// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { groupDraftStateFromGroup } from '../../src/renderer/features/session/group-draft.js'
import {
  activeGroupSession,
  createGroupManagerState,
  groupManagerReducer,
  type GroupManagerAction
} from '../../src/renderer/features/session/group-manager-state.js'
import type { GroupRewardGeneratedRun } from '../../src/shared/contracts/session-generation.js'
import { groupLootDraftSignature } from '../../src/renderer/features/loot/group-loot-draft.js'
import { useGroupManagerCommands } from '../../src/renderer/features/session/use-group-manager-commands.js'
import { AsyncCommandCoordinator } from '../../src/renderer/async/async-command-coordinator.js'
import type { GroupManagerPorts } from '../../src/renderer/features/session/use-group-manager-capability-ports.js'
import type {
  LiveSessionSnapshot,
  SceneGroupCommandResult
} from '../../src/shared/contracts/live-session.js'

describe('group manager commands', () => {
  it('acknowledges the run and exact treasure draft submitted for commit', async () => {
    const input = commandInput(vi.fn(), vi.fn(), vi.fn())
    const draft = { label: 'Beute', items: [], containers: [] }
    const state = groupManagerReducer(input.state, {
      kind: 'loot-generated',
      key: 'group-a',
      run: {
        id: 'run-a',
        treasures: [{ id: 'treasure-a' }]
      } as GroupRewardGeneratedRun,
      draft,
      seed: 1
    })
    const commitGroupReward = vi.fn().mockResolvedValue({
      treasure: null,
      groupResult: groupResult(2)
    })
    const controller = renderHook(() =>
      useGroupManagerCommands(
        {
          ...input,
          state,
          session: activeGroupSession(state),
          ports: {
            ...input.ports,
            loot: { commitGroupReward }
          } as unknown as GroupManagerPorts
        },
        new AsyncCommandCoordinator()
      )
    )
    await act(async () => {
      await controller.result.current.commitLoot()
    })
    expect(commitGroupReward).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-a',
        treasureDraft: { label: 'Beute', items: [], containers: [] }
      })
    )
    expect(input.dispatch).toHaveBeenCalledWith({
      kind: 'loot-committed',
      key: 'group-a',
      runId: 'run-a',
      signature: groupLootDraftSignature(draft)
    })
    expect(input.saved).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 2 })
    )
  })

  it('counts loot commands for an inactive group but not catalog reads', async () => {
    const coordinator = new AsyncCommandCoordinator()
    const catalogGate = deferred<void>()
    const lootGate = deferred<void>()
    const catalog = coordinator.run({
      scope: 'group-manager.loot-catalog',
      mode: 'latest-only',
      execute: () => catalogGate.promise
    })
    const input = commandInput(vi.fn(), vi.fn(), vi.fn())
    const controller = renderHook(() =>
      useGroupManagerCommands(input, coordinator)
    )
    expect(controller.result.current.pending).toBe(false)
    const loot = coordinator.run({
      scope: 'group-manager.loot',
      entityKey: 'inactive-group',
      mode: 'latest-only',
      execute: () => lootGate.promise
    })
    controller.rerender()
    expect(controller.result.current.pending).toBe(true)
    lootGate.resolve()
    await loot
    controller.rerender()
    expect(controller.result.current.pending).toBe(false)
    catalogGate.resolve()
    await catalog
  })

  it('does not acknowledge a currently failed save', async () => {
    const saveGroup = vi.fn().mockRejectedValue(new Error('write failed'))
    const saved = vi.fn()
    const dispatch = vi.fn<(action: GroupManagerAction) => void>()
    const input = commandInput(saveGroup, saved, dispatch)
    const controller = renderHook(() =>
      useGroupManagerCommands(input, new AsyncCommandCoordinator())
    )
    await act(async () => {
      expect(await controller.result.current.save()).toBeNull()
    })
    expect(saved).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'group-message', key: 'group-a' })
    )
  })
  it('does not acknowledge a draft whose creatures are unavailable', async () => {
    const saveGroup = vi.fn()
    const saved = vi.fn()
    const dispatch = vi.fn<(action: GroupManagerAction) => void>()
    const input = commandInput(saveGroup, saved, dispatch)
    const controller = renderHook(() =>
      useGroupManagerCommands(
        {
          ...input,
          entries: [{ creatureId: 'missing', quantity: 1, deadQuantity: 0 }]
        },
        new AsyncCommandCoordinator()
      )
    )
    await act(async () => {
      expect(await controller.result.current.save()).toBeNull()
    })
    expect(saveGroup).not.toHaveBeenCalled()
    expect(saved).not.toHaveBeenCalled()
  })
  it('does not acknowledge saving without an active group', async () => {
    const saveGroup = vi.fn()
    const input = commandInput(saveGroup, vi.fn(), vi.fn())
    const controller = renderHook(() =>
      useGroupManagerCommands(
        { ...input, state: { ...input.state, activeKey: null } },
        new AsyncCommandCoordinator()
      )
    )
    expect(await controller.result.current.save()).toBeNull()
    expect(saveGroup).not.toHaveBeenCalled()
  })

  it('publishes only the latest save and suppresses an obsolete failure', async () => {
    const older = deferred<SceneGroupCommandResult>()
    const newer = deferred<SceneGroupCommandResult>()
    const saveGroup = vi
      .fn()
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise)
    const saved = vi.fn()
    const dispatch = vi.fn<(action: GroupManagerAction) => void>()
    const input = commandInput(saveGroup, saved, dispatch)
    const coordinator = new AsyncCommandCoordinator()
    const controller = renderHook(() =>
      useGroupManagerCommands(input, coordinator)
    )

    const first = controller.result.current.save()
    const second = controller.result.current.save()
    await act(async () => {
      newer.resolve(groupResult(3))
      expect(await second).toMatchObject({ revision: 3 })
    })
    controller.rerender()
    expect(controller.result.current.pending).toBe(true)
    expect(controller.result.current.busy).toBe(true)
    older.reject(new Error('obsolete failure'))
    expect(await first).toBeNull()
    controller.rerender()
    expect(controller.result.current.pending).toBe(false)
    expect(controller.result.current.busy).toBe(false)

    expect(saved).toHaveBeenCalledOnce()
    expect(saved.mock.calls[0]?.[0]).toMatchObject({ revision: 3 })
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'group-message' })
    )
  })
})

function commandInput(
  saveGroup: ReturnType<typeof vi.fn>,
  saved: (snapshot: LiveSessionSnapshot) => void,
  dispatch: (action: GroupManagerAction) => void
) {
  const state = createGroupManagerState({
    activeKey: 'group-a',
    initialGroup: null,
    prospectiveGroupId: 'prospective',
    locationId: null
  })
  const snapshot = sessionSnapshot()
  return {
    snapshot,
    focused: snapshot.scene.scenes[0]!,
    state,
    session: activeGroupSession(state),
    group: groupDraftStateFromGroup(null),
    entries: [],
    selectedPersistedGroup: undefined,
    rewardGroupId: 'group-a',
    canGenerate: false,
    ports: {
      runtime: { e2e: true },
      scene: { saveGroup }
    } as unknown as GroupManagerPorts,
    dispatch,
    saved,
    lootChanged: vi.fn()
  }
}

function sessionSnapshot(): LiveSessionSnapshot {
  return {
    revision: 1,
    party: { revision: 1, members: [] },
    scene: {
      revision: 1,
      focusedSceneId: 'scene-a',
      scenes: [
        {
          id: 'scene-a',
          locationId: null,
          partyMemberIds: [],
          groups: []
        }
      ]
    },
    combat: null
  } as unknown as LiveSessionSnapshot
}

function groupResult(revision: number): SceneGroupCommandResult {
  return {
    combat: null,
    scenePatch: {
      sceneId: 'scene-a',
      sceneRevision: revision,
      upsertedGroups: [],
      removedGroupIds: []
    }
  } as SceneGroupCommandResult
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
