// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import type { SetStateAction } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useSessionMutationController } from '../../src/renderer/features/session/use-session-mutation-controller.js'
import type {
  LiveSessionSnapshot,
  SceneGroupCommandResult
} from '../../src/shared/contracts/live-session.js'
import type { SceneGroup } from '../../src/shared/contracts/scene.js'

describe('session mutation controller', () => {
  it('commits only the latest full-snapshot request when responses race', async () => {
    const initial = snapshot(1)
    const older = deferred<LiveSessionSnapshot>()
    const newer = deferred<LiveSessionSnapshot>()
    let committed = initial
    const setSnapshot = vi.fn((update: SetStateAction<LiveSessionSnapshot>) => {
      committed = typeof update === 'function' ? update(committed) : update
    })
    const controller = renderHook(() =>
      useSessionMutationController({
        snapshot: initial,
        setSnapshot,
        onError: vi.fn()
      })
    )

    const first = controller.result.current.mutateSnapshot(() => older.promise)
    const second = controller.result.current.mutateSnapshot(() => newer.promise)
    await act(async () => {
      newer.resolve(snapshot(3))
      await newer.promise
    })
    await act(async () => {
      older.resolve(snapshot(2))
      await older.promise
    })
    await Promise.all([first, second])

    expect(committed.revision).toBe(3)
    expect(setSnapshot).toHaveBeenCalledOnce()
  })

  it('coordinates group mutations per group and suppresses obsolete failures', async () => {
    const initial = snapshot(1)
    const older = deferred<SceneGroupCommandResult>()
    const newer = deferred<SceneGroupCommandResult>()
    const onError = vi.fn()
    const setSnapshot = vi.fn()
    const controller = renderHook(() =>
      useSessionMutationController({ snapshot: initial, setSnapshot, onError })
    )
    const group = { id: 'group-a' } as SceneGroup

    const first = controller.result.current.mutateGroup(
      () => older.promise,
      group
    )
    const second = controller.result.current.mutateGroup(
      () => newer.promise,
      group
    )
    newer.resolve(groupResult())
    await second
    older.reject(new Error('obsolete failure'))
    await first

    expect(setSnapshot).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports the current mutation failure', async () => {
    const onError = vi.fn()
    const controller = renderHook(() =>
      useSessionMutationController({
        snapshot: snapshot(1),
        setSnapshot: vi.fn(),
        onError
      })
    )

    await controller.result.current.mutateSnapshot(() =>
      Promise.reject(new Error('current failure'))
    )

    expect(onError).toHaveBeenCalledWith('Unbekannter Fehler')
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause?: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function snapshot(revision: number): LiveSessionSnapshot {
  return {
    revision,
    party: { revision, members: [] },
    scene: { revision, focusedSceneId: null, scenes: [] },
    combat: null
  } as unknown as LiveSessionSnapshot
}

function groupResult(): SceneGroupCommandResult {
  return {
    combat: null,
    scenePatch: null
  } as unknown as SceneGroupCommandResult
}
