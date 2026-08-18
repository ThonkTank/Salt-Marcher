// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import type { SetStateAction } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useSessionMutationController } from '../../src/renderer/features/session/use-session-mutation-controller.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'

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
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function snapshot(revision: number): LiveSessionSnapshot {
  return {
    revision,
    party: { revision, members: [] },
    scene: { revision, focusedSceneId: null, scenes: [] },
    combat: null
  } as unknown as LiveSessionSnapshot
}
