// @vitest-environment jsdom
import {
  act,
  cleanup,
  renderHook,
  render,
  screen,
  fireEvent
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReferenceContextValue } from '../../src/renderer/features/reference/reference-context.js'
import {
  compileReferenceIndex,
  searchReferenceIndices
} from '../../src/renderer/features/reference/reference-matcher.js'
import { useDesktopSearch } from '../../src/renderer/features/scene-desktop/use-desktop-search.js'
import { DesktopSearch } from '../../src/renderer/features/scene-desktop/desktop-references.js'
import { ReferenceContext } from '../../src/renderer/features/reference/reference-context.js'
import { initialPartyWindow } from '../../src/renderer/features/scene-desktop/desktop-state.js'
import type { SceneDesktopWindow } from '../../src/shared/contracts/scene-desktop.js'
import type {
  ReferenceCandidate,
  ReferenceSearchPage
} from '../../src/shared/contracts/reference.js'

const candidate = (title: string, campaignId = 'A'): ReferenceCandidate => ({
  title,
  target: {
    scope: 'campaign',
    campaignId,
    entityKind: 'location',
    entityId: title
  }
})
const page = (title: string, campaignId = 'A'): ReferenceSearchPage => ({
  candidates: [candidate(title, campaignId)],
  total: 1,
  offset: 0
})
function context(
  searchCampaign: ReferenceContextValue['searchCampaign']
): ReferenceContextValue {
  return {
    campaignId: 'A',
    compiled: [],
    cacheRevision: 0,
    searchCampaign,
    loadDetail: vi.fn(),
    openReference: vi.fn(),
    openOverlay: vi.fn(),
    closeOverlayBranch: vi.fn(),
    scheduleOverlayClose: vi.fn(),
    cancelOverlayClose: vi.fn(),
    overlays: [],
    openSeparateReference: vi.fn()
  }
}
function deferred() {
  let resolve!: (value: ReferenceSearchPage) => void
  const promise = new Promise<ReferenceSearchPage>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}
const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(150)
  })
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('desktop note search', () => {
  it('honors early Enter once results settle and does not silently select among several matches', async () => {
    vi.useFakeTimers()
    for (const candidates of [
      [candidate('Only')],
      [candidate('First'), candidate('Second')]
    ]) {
      const search = vi
        .fn()
        .mockResolvedValue({ candidates, total: candidates.length, offset: 0 })
      const dispatch = vi.fn()
      render(
        <ReferenceContext.Provider value={context(search)}>
          <DesktopSearch
            window={{
              ...initialPartyWindow,
              kind: 'search',
              id: 'search',
              query: 'secret',
              scrollTop: 0
            }}
            dispatch={dispatch}
          />
        </ReferenceContext.Provider>
      )
      screen.getByRole('searchbox').focus()
      fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' })
      expect(dispatch).not.toHaveBeenCalled()
      await tick()
      if (candidates.length === 1)
        expect(dispatch).toHaveBeenCalledWith({
          type: 'open-reference',
          entry: { ...candidates[0], scrollTop: 0 }
        })
      else expect(dispatch).not.toHaveBeenCalled()
      expect(dispatch).toHaveBeenCalledTimes(candidates.length === 1 ? 1 : 0)
      cleanup()
    }
  })
  it('cancels queued Enter on a changed query, Campaign, note revision, hidden window, blur or Escape', async () => {
    vi.useFakeTimers()
    for (const cancellation of [
      'query',
      'campaign',
      'revision',
      'hidden',
      'blur',
      'escape'
    ]) {
      const pending = deferred()
      const search = vi.fn().mockReturnValue(pending.promise)
      const dispatch = vi.fn()
      const reference = context(search)
      const window: Extract<SceneDesktopWindow, { kind: 'search' }> = {
        ...initialPartyWindow,
        kind: 'search' as const,
        id: 'search',
        query: 'secret',
        scrollTop: 0
      }
      const view = (ref: ReferenceContextValue, frame = window) => (
        <ReferenceContext.Provider value={ref}>
          <DesktopSearch window={frame} dispatch={dispatch} />
        </ReferenceContext.Provider>
      )
      const rendered = render(view(reference))
      const input = screen.getByRole('searchbox')
      input.focus()
      fireEvent.keyDown(input, { key: 'Enter' })
      await tick()
      if (cancellation === 'query')
        rendered.rerender(view(reference, { ...window, query: 'other' }))
      if (cancellation === 'campaign')
        rendered.rerender(view({ ...reference, campaignId: 'B' }))
      if (cancellation === 'revision')
        rendered.rerender(view({ ...reference, cacheRevision: 1 }))
      if (cancellation === 'hidden')
        rendered.rerender(view(reference, { ...window, minimized: true }))
      if (cancellation === 'blur') fireEvent.blur(input)
      if (cancellation === 'escape') fireEvent.keyDown(input, { key: 'Escape' })
      await act(async () => {
        pending.resolve(page('Only'))
        await pending.promise
      })
      await tick()
      expect(dispatch, cancellation).not.toHaveBeenCalled()
      cleanup()
    }
  })
  it('never opens an incomplete or failed search, or an IME confirmation', async () => {
    vi.useFakeTimers()
    for (const mode of ['failed', 'more', 'ime']) {
      const search =
        mode === 'failed'
          ? vi.fn().mockRejectedValue(new Error('read failed'))
          : vi.fn().mockResolvedValue({
              ...page('Only'),
              total: mode === 'more' ? 2 : 1
            })
      const dispatch = vi.fn()
      render(
        <ReferenceContext.Provider value={context(search)}>
          <DesktopSearch
            window={{
              ...initialPartyWindow,
              kind: 'search',
              id: 'search',
              query: 'secret',
              scrollTop: 0
            }}
            dispatch={dispatch}
          />
        </ReferenceContext.Provider>
      )
      const input = screen.getByRole('searchbox')
      input.focus()
      fireEvent.keyDown(input, { key: 'Enter', isComposing: mode === 'ime' })
      await tick()
      expect(dispatch, mode).not.toHaveBeenCalled()
      cleanup()
    }
  })
  it('does not show no-results while pending and discards late query and Campaign responses', async () => {
    vi.useFakeTimers()
    const old = deferred(),
      next = deferred(),
      other = deferred()
    const search = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise)
    const reference = context(search)
    const hook = renderHook(({ ref, query }) => useDesktopSearch(ref, query), {
      initialProps: { ref: reference, query: 'old' }
    })
    expect(hook.result.current.loading).toBe(true)
    await tick()
    hook.rerender({ ref: reference, query: 'next' })
    await tick()
    await act(async () => {
      next.resolve(page('New'))
      await next.promise
    })
    expect(hook.result.current.results.map((entry) => entry.title)).toEqual([
      'New'
    ])
    await act(async () => {
      old.resolve(page('Stale'))
      await old.promise
    })
    expect(hook.result.current.results.map((entry) => entry.title)).toEqual([
      'New'
    ])
    const searchB = vi.fn().mockReturnValue(other.promise)
    hook.rerender({
      ref: { ...reference, campaignId: 'B', searchCampaign: searchB },
      query: 'next'
    })
    expect(hook.result.current.results).toEqual([])
    expect(hook.result.current.loading).toBe(true)
    await tick()
    await act(async () => {
      other.resolve(page('Other', 'B'))
      await other.promise
    })
    expect(hook.result.current.results.map((entry) => entry.title)).toEqual([
      'Other'
    ])
  })

  it('keeps static lookup usable on a Campaign read failure and retries explicitly', async () => {
    vi.useFakeTimers()
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline read failed'))
      .mockResolvedValueOnce(page('Kai'))
    const reference = {
      ...context(search),
      compiled: [
        compileReferenceIndex({
          scope: 'static',
          revision: '1',
          terms: [
            {
              term: 'Kai',
              matchMode: 'folded',
              candidates: [
                {
                  title: 'Kai',
                  target: {
                    scope: 'srd',
                    catalogId: 'srd-5.1',
                    definitionKind: 'rule',
                    definitionId: 'kai'
                  }
                }
              ]
            }
          ]
        })
      ]
    }
    const hook = renderHook(() => useDesktopSearch(reference, 'Kai'))
    await tick()
    expect(hook.result.current.failed).toBe(true)
    expect(hook.result.current.results).toHaveLength(1)
    act(() => hook.result.current.retry())
    await tick()
    expect(hook.result.current.failed).toBe(false)
    expect(hook.result.current.results).toHaveLength(2)
  })

  it('loads further note results and refreshes after a saved-note change', async () => {
    vi.useFakeTimers()
    const first = Array.from({ length: 100 }, (_, i) =>
      candidate(`Record ${i}`)
    )
    const search = vi
      .fn()
      .mockResolvedValueOnce({ candidates: first, total: 101, offset: 0 })
      .mockResolvedValueOnce({
        candidates: [candidate('Last')],
        total: 101,
        offset: 100
      })
      .mockResolvedValueOnce({ candidates: [], total: 0, offset: 0 })
    const reference = context(search)
    const hook = renderHook(({ ref }) => useDesktopSearch(ref, 'secret'), {
      initialProps: { ref: reference }
    })
    await tick()
    expect(hook.result.current.more).toBe(true)
    await act(async () => {
      hook.result.current.loadMore()
      await Promise.resolve()
    })
    expect(search).toHaveBeenLastCalledWith('secret', 100)
    expect(hook.result.current.results).toHaveLength(101)
    expect(hook.result.current.more).toBe(false)
    hook.rerender({ ref: { ...reference, cacheRevision: 1 } })
    expect(hook.result.current.results).toEqual([])
    await tick()
    expect(hook.result.current.results).toEqual([])
  })

  it('normalizes title search and retains matches beyond one hundred', () => {
    const index = compileReferenceIndex({
      scope: 'campaign',
      revision: '1',
      terms: Array.from({ length: 105 }, (_, i) => ({
        term: `Überfall ${i}`,
        matchMode: 'exact',
        candidates: [candidate(`Überfall ${i}`)]
      }))
    })
    expect(searchReferenceIndices([index], 'U\u0308BERFALL')).toHaveLength(105)
  })
})
