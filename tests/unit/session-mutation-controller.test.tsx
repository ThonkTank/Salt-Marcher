// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode, type SetStateAction } from 'react'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
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
    const controller = renderHook(
      () =>
        useSessionMutationController({
          snapshot: initial,
          setSnapshot,
          onError: vi.fn()
        }),
      { wrapper: campaignContext(() => committed).Wrapper }
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
    const controller = renderHook(
      () =>
        useSessionMutationController({
          snapshot: initial,
          setSnapshot,
          onError
        }),
      { wrapper: campaignContext(() => initial).Wrapper }
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
    const controller = renderHook(
      () =>
        useSessionMutationController({
          snapshot: snapshot(1),
          setSnapshot: vi.fn(),
          onError
        }),
      { wrapper: campaignContext(() => snapshot(1)).Wrapper }
    )

    await controller.result.current.mutateSnapshot(() =>
      Promise.reject(new Error('current failure'))
    )

    expect(onError).toHaveBeenCalledWith('Unbekannter Fehler')
  })
  it('reads the current projection when a delayed action executes', async () => {
    let current = snapshot(1)
    const context = campaignContext(() => current)
    const controller = renderHook(
      () =>
        useSessionMutationController({
          snapshot: snapshot(1),
          setSnapshot: vi.fn(),
          onError: vi.fn()
        }),
      { wrapper: context.Wrapper }
    )
    current = snapshot(9)
    const operation = vi.fn((value: LiveSessionSnapshot) =>
      Promise.resolve(value)
    )
    await controller.result.current.mutateSnapshot(operation)
    expect(operation).toHaveBeenCalledWith(current)
  })
  it.each(['before', 'during'] as const)(
    'rejects a campaign change %s a write',
    async (when) => {
      const context = campaignContext(() => snapshot(1))
      const reply = deferred<LiveSessionSnapshot>()
      const operation = vi.fn(() => reply.promise)
      const setSnapshot = vi.fn()
      const onError = vi.fn()
      const controller = renderHook(
        () =>
          useSessionMutationController({
            snapshot: snapshot(1),
            setSnapshot,
            onError
          }),
        { wrapper: context.Wrapper }
      )
      if (when === 'before') context.changeCampaign()
      const pending = controller.result.current.mutateSnapshot(operation)
      if (when === 'during') context.changeCampaign()
      reply.resolve(snapshot(2))
      await pending
      expect(operation).toHaveBeenCalledTimes(when === 'before' ? 0 : 1)
      expect(setSnapshot).not.toHaveBeenCalled()
      expect(onError).toHaveBeenCalledOnce()
    }
  )
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

function campaignContext(session: () => LiveSessionSnapshot) {
  let campaignId = 'campaign'
  const context = {
    campaignWorkspace: {
      snapshot: () => ({
        sessionCampaignId: campaignId,
        campaigns: { activeCampaignId: campaignId },
        session: session()
      })
    }
  } as unknown as CapabilityContextValue
  return {
    changeCampaign: () => {
      campaignId = 'different-campaign'
    },
    Wrapper: ({ children }: { children: ReactNode }) =>
      createElement(CapabilityContext.Provider, { value: context }, children)
  }
}
