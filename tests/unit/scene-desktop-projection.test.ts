import { describe, expect, it, vi } from 'vitest'
import {
  DesktopProjection,
  desktopProjection
} from '../../src/renderer/features/scene-desktop/desktop-projection.js'
import { initialDesktopState } from '../../src/renderer/features/scene-desktop/desktop-state.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type {
  SceneDesktopScope,
  SceneDesktopSnapshot
} from '../../src/shared/contracts/scene-desktop.js'

const scope = {
  campaignId: '00000000-0000-4000-8000-000000000001',
  sceneId: '00000000-0000-4000-8000-000000000002'
}
const empty = { ...initialDesktopState(), windows: [] }
const stored = (
  revision = 0,
  state: SceneDesktopSnapshot['state'] = null,
  identity: SceneDesktopScope = scope
): SceneDesktopSnapshot => ({ ...identity, revision, state })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function mockApi() {
  return {
    read: vi
      .fn<SaltMarcherApi['sceneDesktop']['read']>()
      .mockResolvedValue(stored()),
    save: vi.fn<SaltMarcherApi['sceneDesktop']['save']>()
  }
}

describe('scene desktop projection', () => {
  it('retains a transient scoped focus request until the mounted frame consumes it', async () => {
    const api = mockApi()
    const source = desktopProjection(api, scope)
    const target = desktopProjection(api, { ...scope, sceneId: 'other' })
    const unsubscribe = source.subscribe(() => {})
    unsubscribe()
    source.requestFocus('characters')
    await source.load()
    expect(source.snapshot().focusWindowId).toBe('characters')
    expect(target.snapshot().focusWindowId).toBeNull()
    source.acknowledgeFocus('map')
    expect(source.snapshot().focusWindowId).toBe('characters')
    source.acknowledgeFocus('characters')
    expect(source.snapshot().focusWindowId).toBeNull()
    expect(api.save).not.toHaveBeenCalled()
  })

  it('does not resume a delayed write after an earlier save reports a conflict', async () => {
    vi.useFakeTimers()
    try {
      const api = mockApi()
      let rejectSave!: (error: Error) => void
      api.save.mockReturnValue(
        new Promise((_, reject) => {
          rejectSave = reject
        })
      )
      const model = new DesktopProjection(api, scope)
      await model.load()
      model.dispatch({ type: 'open-search' })
      model.dispatch({ type: 'query', value: 'unsaved' })
      api.read.mockResolvedValue(stored(5, empty))
      rejectSave(new Error('conflict'))
      await vi.advanceTimersByTimeAsync(500)
      expect(model.snapshot().error).toBeInstanceOf(Error)
      expect(api.save).toHaveBeenCalledTimes(1)
      model.reload()
      await vi.runAllTimersAsync()
      expect(model.snapshot().state).toEqual(empty)
      expect(api.save).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('debounces search edits in the original scope after its last subscriber leaves', async () => {
    vi.useFakeTimers()
    try {
      const api = mockApi()
      api.save.mockImplementation((input) =>
        Promise.resolve(stored(input.expectedRevision + 1, input.state, input))
      )
      const model = new DesktopProjection(api, scope)
      await model.load()
      model.dispatch({ type: 'open-search' })
      await vi.runAllTimersAsync()
      api.save.mockClear()
      const unsubscribe = model.subscribe(() => {})
      model.dispatch({ type: 'query', value: 'Long' })
      model.dispatch({ type: 'query', value: 'Longsword' })
      unsubscribe()
      expect(api.save).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(200)
      expect(api.save).toHaveBeenCalledTimes(1)
      const saved = api.save.mock.calls[0]![0]
      expect(saved.campaignId).toBe(scope.campaignId)
      expect(saved.sceneId).toBe(scope.sceneId)
      expect(
        saved.state.windows.find((window) => window.kind === 'search')?.query
      ).toBe('Longsword')
      expect(model.snapshot().saving).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('deduplicates loading, distinguishes missing from closed, and never writes defaults', async () => {
    const api = mockApi()
    const request = deferred<SceneDesktopSnapshot>()
    api.read.mockReturnValueOnce(request.promise)
    const model = desktopProjection(api, scope)
    expect(desktopProjection(api, scope)).toBe(model)
    const first = model.load()
    expect(model.load()).toBe(first)
    request.resolve(stored())
    await first
    expect(model.snapshot().state).toEqual(initialDesktopState())
    expect(api.save).not.toHaveBeenCalled()
    const reopened = new DesktopProjection(
      { ...api, read: vi.fn().mockResolvedValue(stored(1, empty)) },
      scope
    )
    await reopened.load()
    expect(reopened.snapshot().state).toEqual(empty)
  })

  it('keeps delayed writes scoped after switching scene and coalesces intent serially', async () => {
    const api = mockApi()
    const pending = deferred<SceneDesktopSnapshot>()
    api.save
      .mockReturnValueOnce(pending.promise)
      .mockImplementation((input) =>
        Promise.resolve(stored(input.expectedRevision + 1, input.state, input))
      )
    const source = desktopProjection(api, scope)
    await source.load()
    source.dispatch({ type: 'minimize', id: 'overview' })
    source.dispatch({ type: 'open-overview' })
    source.dispatch({ type: 'close', id: 'overview' })
    const targetScope = {
      ...scope,
      sceneId: '00000000-0000-4000-8000-000000000003'
    }
    api.read.mockResolvedValue(stored(0, null, targetScope))
    const target = desktopProjection(api, targetScope)
    await target.load()
    expect(api.save).toHaveBeenCalledTimes(1)
    pending.resolve(
      stored(1, {
        ...initialDesktopState(),
        windows: initialDesktopState().windows.map((window) => ({
          ...window,
          minimized: true
        }))
      })
    )
    await vi.waitFor(() => expect(source.snapshot().saving).toBe(false))
    expect(api.save).toHaveBeenCalledTimes(2)
    expect(api.save.mock.calls[1]?.[0]).toEqual({
      ...scope,
      expectedRevision: 1,
      state: empty
    })
    expect(target.snapshot().state).toEqual(initialDesktopState())
    expect(source.snapshot().state).toEqual(empty)
  })

  it('does not overwrite unavailable storage and explicitly reloads after recovery', async () => {
    const api = mockApi()
    api.read.mockRejectedValueOnce(new Error('unavailable'))
    const model = new DesktopProjection(api, scope)
    await model.load()
    model.dispatch({ type: 'open-overview' })
    expect(model.snapshot().state).toBeNull()
    expect(api.save).not.toHaveBeenCalled()
    api.read.mockResolvedValue(stored(3, empty))
    model.reload()
    await vi.waitFor(() => expect(model.snapshot().loading).toBe(false))
    expect(model.snapshot().state).toEqual(empty)
    expect(model.snapshot().error).toBeNull()
  })

  it('reconciles a lost committed response without replaying the same write', async () => {
    const api = mockApi()
    const model = new DesktopProjection(api, scope)
    await model.load()
    api.save.mockRejectedValue(new Error('lost response'))
    api.read.mockResolvedValue(stored(1, empty))
    model.dispatch({ type: 'close', id: 'overview' })
    await vi.waitFor(() => expect(model.snapshot().saving).toBe(false))
    expect(model.snapshot().error).toBeNull()
    expect(api.save).toHaveBeenCalledTimes(1)
  })

  it('stops on conflicting writes until explicit recovery instead of overwriting newer data', async () => {
    const api = mockApi()
    const model = new DesktopProjection(api, scope)
    await model.load()
    api.save.mockRejectedValue(new Error('stale'))
    api.read.mockResolvedValue(stored(5, initialDesktopState()))
    model.dispatch({ type: 'close', id: 'overview' })
    await vi.waitFor(() => expect(model.snapshot().error).not.toBeNull())
    model.dispatch({ type: 'open-overview' })
    expect(api.save).toHaveBeenCalledTimes(1)
    model.reload()
    await vi.waitFor(() => expect(model.snapshot().loading).toBe(false))
    expect(model.snapshot().state).toEqual(initialDesktopState())
    expect(api.save).toHaveBeenCalledTimes(1)
  })
})
