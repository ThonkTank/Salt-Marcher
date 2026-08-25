// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { useLootSceneController } from '../../src/renderer/features/loot/use-loot-scene-controller.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type {
  LootInboxPage,
  LootSceneProjection,
  Treasure
} from '../../src/shared/contracts/loot.js'

const sceneA = '01900000-0000-7000-8000-000000000001'
const sceneB = '01900000-0000-7000-8000-000000000002'

describe('Loot scene controller', () => {
  it('discards a delayed old-scene read after a scene switch', async () => {
    const first = deferred<LootSceneProjection>()
    const second = deferred<LootSceneProjection>()
    const scene = vi.fn(({ sceneId }: { sceneId: string }) =>
      sceneId === sceneA ? first.promise : second.promise
    )
    const api = lootApi({ scene })
    const onError = vi.fn()
    const hook = renderHook(
      ({ sceneId }) =>
        useLootSceneController({ sceneId, locationId: null, onError }),
      {
        initialProps: { sceneId: sceneA },
        wrapper: provider(api)
      }
    )
    await waitFor(() => expect(scene).toHaveBeenCalledWith({ sceneId: sceneA }))
    hook.rerender({ sceneId: sceneB })
    await waitFor(() => expect(scene).toHaveBeenCalledWith({ sceneId: sceneB }))
    await act(async () => second.resolve(projection(sceneB, 2)))
    expect(hook.result.current.scene.sceneId).toBe(sceneB)
    await act(async () => first.resolve(projection(sceneA, 1)))
    expect(hook.result.current.scene.sceneId).toBe(sceneB)
    expect(hook.result.current.revision).toBe(2)
  })

  it('loads Inbox only on demand, appends pages, and refreshes on invalidation', async () => {
    let revision = 1
    let changed: ((notice: { revision: number }) => void) | undefined
    const scene = vi.fn(({ sceneId }: { sceneId: string }) =>
      Promise.resolve(projection(sceneId, revision))
    )
    const firstTreasure = treasure(
      '01900000-0000-7000-8000-000000000010',
      'Erster Fund'
    )
    const secondTreasure = treasure(
      '01900000-0000-7000-8000-000000000011',
      'Zweiter Fund'
    )
    const inbox = vi.fn(
      ({ cursor }: { cursor: string | null }): Promise<LootInboxPage> =>
        Promise.resolve(
          cursor === null
            ? {
                revision: 1,
                entries: [entry(firstTreasure)],
                nextCursor: 'next'
              }
            : {
                revision: 2,
                entries: [entry(firstTreasure), entry(secondTreasure)],
                nextCursor: null
              }
        )
    )
    const api = lootApi({
      scene,
      inbox,
      onChanged: (listener) => {
        changed = listener as (notice: { revision: number }) => void
        return () => undefined
      }
    })
    const onError = vi.fn()
    const hook = renderHook(
      () =>
        useLootSceneController({
          sceneId: sceneA,
          locationId: null,
          onError
        }),
      { wrapper: provider(api) }
    )
    await waitFor(() => expect(hook.result.current.revision).toBe(1))
    expect(inbox).not.toHaveBeenCalled()

    await act(async () => hook.result.current.openInbox())
    expect(inbox).toHaveBeenCalledWith({ cursor: null, limit: 20 })
    expect(
      hook.result.current.inbox.entries.map(({ treasure }) => treasure.id)
    ).toEqual([firstTreasure.id])
    await act(async () => hook.result.current.loadMore())
    expect(
      hook.result.current.inbox.entries.map(({ treasure }) => treasure.id)
    ).toEqual([firstTreasure.id, secondTreasure.id])

    revision = 3
    act(() =>
      changed?.({
        revision: 3
      })
    )
    await waitFor(() => expect(hook.result.current.revision).toBe(3))
    expect(scene).toHaveBeenCalledTimes(2)
    expect(inbox).toHaveBeenCalledTimes(3)
  })
})

function lootApi(overrides: Partial<SaltMarcherApi['loot']>): SaltMarcherApi {
  return {
    session: { onChanged: vi.fn(() => () => undefined) },
    loot: {
      scene: vi.fn(({ sceneId }: { sceneId: string }) =>
        Promise.resolve(projection(sceneId, 0))
      ),
      inbox: vi.fn(() =>
        Promise.resolve({
          revision: 0,
          entries: [],
          nextCursor: null
        })
      ),
      onChanged: vi.fn(() => () => undefined),
      ...overrides
    }
  } as unknown as SaltMarcherApi
}

function provider(api: SaltMarcherApi) {
  return function TestCapabilityProvider(props: { children: ReactNode }) {
    return <CapabilityProvider api={api}>{props.children}</CapabilityProvider>
  }
}

function projection(sceneId: string, revision: number): LootSceneProjection {
  return {
    revision,
    sceneId,
    locationId: null,
    locationTreasures: [],
    groupTreasures: []
  }
}

function entry(found: Treasure): LootInboxPage['entries'][number] {
  return { treasure: found, reason: 'unplaced', lastKnownLabel: null }
}

function treasure(id: string, label: string): Treasure {
  return {
    id,
    revision: 0,
    label,
    anchor: { kind: 'unplaced' },
    source: { kind: 'manual' },
    items: [],
    containers: [],
    totalValueCp: 0,
    allocatedValueCp: 0,
    distributionState: 'open',
    createdAt: '2026-08-09T10:00:00.000Z',
    updatedAt: '2026-08-09T10:00:00.000Z'
  }
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve(value: T) {
      resolvePromise(value)
      return Promise.resolve()
    }
  }
}
