// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedEncounterPlanSummary } from '../../src/shared/contracts/encounter-plans.js'
import { AsyncCommandCoordinator } from '../../src/renderer/async/async-command-coordinator.js'
import { useEncounterPlanSearch } from '../../src/renderer/features/session-planner/use-encounter-plan-search.js'

const sessionId = '01900000-0000-7000-8000-000000000001'
const sceneA = '01900000-0000-7000-8000-0000000000a1'
const sceneB = '01900000-0000-7000-8000-0000000000b1'
const planA = '01900000-0000-7000-8000-0000000000c1'
const planB = '01900000-0000-7000-8000-0000000000d1'

describe('Session Planner Encounter search', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('publishes only the newest query when responses finish out of order', async () => {
    const older = deferred<ReturnType<typeof searchResult>>()
    const newer = deferred<ReturnType<typeof searchResult>>()
    const search = vi.fn((query: string) =>
      query === 'older' ? older.promise : newer.promise
    )
    const fixture = renderSearch({ search })

    act(() => fixture.result.current.setQuery('older'))
    await advanceDebounce()
    act(() => fixture.result.current.setQuery('newer'))
    expect(fixture.result.current.state).toEqual({ status: 'idle' })
    await advanceDebounce()

    newer.resolve(searchResult(planB, 'Newest'))
    await flush()
    expect(fixture.result.current.state).toMatchObject({
      status: 'ready',
      hits: [{ planId: planB }]
    })

    older.resolve(searchResult(planA, 'Obsolete'))
    await flush()
    expect(fixture.result.current.state).toMatchObject({
      status: 'ready',
      hits: [{ planId: planB }]
    })
  })

  it('invalidates a pending response on scene or authored-intent change', async () => {
    const pending = deferred<ReturnType<typeof searchResult>>()
    const search = vi.fn(() => pending.promise)
    const fixture = renderSearch({ search })

    act(() => fixture.result.current.setQuery('harbor'))
    await advanceDebounce()
    fixture.rerender({ sceneId: sceneB, intentRevision: 2 })
    expect(fixture.result.current.state).toEqual({ status: 'idle' })

    pending.resolve(searchResult(planA, 'Obsolete'))
    await flush()
    expect(fixture.result.current.state).toEqual({ status: 'idle' })
    expect(fixture.cacheSummaries).not.toHaveBeenCalled()
  })

  it('does no read for short queries and hides canceled failures', async () => {
    const pending = deferred<ReturnType<typeof searchResult>>()
    const search = vi.fn(() => pending.promise)
    const fixture = renderSearch({ search })

    act(() => fixture.result.current.setQuery('x'))
    await advanceDebounce()
    expect(search).not.toHaveBeenCalled()

    act(() => fixture.result.current.setQuery('valid'))
    await advanceDebounce()
    act(() => fixture.result.current.setQuery(''))
    pending.reject(new Error('obsolete transport failure'))
    await flush()
    expect(fixture.result.current.state).toEqual({ status: 'idle' })
  })

  it('shows a failure for the current query', async () => {
    const search = vi.fn(() => Promise.reject(new Error('current failure')))
    const fixture = renderSearch({ search })

    act(() => fixture.result.current.setQuery('valid'))
    await advanceDebounce()
    await flush()
    expect(fixture.result.current.state).toEqual({ status: 'failed' })
  })
})

function renderSearch(options: {
  search: (query: string) => Promise<ReturnType<typeof searchResult>>
}) {
  const coordinator = new AsyncCommandCoordinator()
  const cacheSummaries = vi.fn()
  const summaries = vi.fn((planIds: readonly string[]) =>
    Promise.resolve({
      entries: planIds.map((planId) => ({
        status: 'READY' as const,
        planId,
        summary: summary(planId)
      }))
    })
  )
  const encounters = { search: options.search, summaries } as never
  const hook = renderHook(
    (props: { sceneId: string; intentRevision: number }) =>
      useEncounterPlanSearch({
        coordinator,
        encounters,
        sessionId,
        sessionRevision: 1,
        selectedSceneId: props.sceneId,
        intentRevision: props.intentRevision,
        cacheSummaries
      }),
    { initialProps: { sceneId: sceneA, intentRevision: 1 } }
  )
  return { ...hook, cacheSummaries }
}

async function advanceDebounce(): Promise<void> {
  await act(async () => vi.advanceTimersByTimeAsync(180))
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve()
  })
}

function searchResult(planId: string, authoredName: string) {
  return {
    hits: [
      {
        planId,
        titleKind: 'authored' as const,
        authoredName,
        generatedEncounterNumber: null,
        creatures: [{ quantity: 1, name: 'Bandit' }]
      }
    ],
    hasMore: false
  }
}

function summary(id: string): SavedEncounterPlanSummary {
  return {
    id,
    titleKind: 'authored',
    authoredName: id,
    generatedEncounterNumber: null,
    creatureCount: 1,
    baseXp: 100,
    adjustedXp: 150,
    difficulty: 'MEDIUM',
    creatures: [{ quantity: 1, name: 'Bandit' }]
  }
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
