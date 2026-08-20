// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { groupDraftStateFromGroup } from '../../src/renderer/features/session/group-draft.js'
import {
  activeGroupSession,
  createGroupManagerState,
  type GroupManagerAction
} from '../../src/renderer/features/session/group-manager-state.js'
import { useGroupManagerCommands } from '../../src/renderer/features/session/use-group-manager-commands.js'
import type { GroupManagerPorts } from '../../src/renderer/features/session/use-group-manager-capability-ports.js'
import type {
  LiveSessionSnapshot,
  SceneGroupCommandResult
} from '../../src/shared/contracts/live-session.js'

describe('group manager commands', () => {
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
    const controller = renderHook(() => useGroupManagerCommands(input))

    const first = controller.result.current.save()
    const second = controller.result.current.save()
    await act(async () => {
      newer.resolve(groupResult(3))
      await second
    })
    older.reject(new Error('obsolete failure'))
    await first

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
