import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopProjection } from '../../src/renderer/features/scene-desktop/desktop-projection.js'
import { initialDesktopState } from '../../src/renderer/features/scene-desktop/desktop-state.js'
import { MaintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { SceneDesktopSnapshot } from '../../src/shared/contracts/scene-desktop.js'

const scope = { campaignId: 'campaign', sceneId: 'scene' }
function fixture(
  maintenance = new MaintenanceDraftCoordinator(),
  sceneId = 'scene'
) {
  let stored: SceneDesktopSnapshot = {
    ...scope,
    sceneId,
    revision: 1,
    state: initialDesktopState()
  }
  const api = {
    read: vi
      .fn<SaltMarcherApi['sceneDesktop']['read']>()
      .mockImplementation(() => Promise.resolve(stored)),
    save: vi
      .fn<SaltMarcherApi['sceneDesktop']['save']>()
      .mockImplementation((input) => {
        stored = { ...input, revision: input.expectedRevision + 1 }
        return Promise.resolve(stored)
      })
  }
  const model = new DesktopProjection(api, { ...scope, sceneId }, maintenance)
  return {
    api,
    model,
    maintenance,
    stored: () => stored,
    replace: (value: SceneDesktopSnapshot) => {
      stored = value
    }
  }
}
async function searchDraft(f: ReturnType<typeof fixture>) {
  await f.model.load()
  f.model.dispatch({ type: 'open-search' })
  await vi.waitFor(() => expect(f.model.snapshot().saving).toBe(false))
  f.api.save.mockClear()
  f.model.dispatch({ type: 'query', value: 'Küste' })
}
afterEach(() => vi.useRealTimers())

describe('scene desktop maintenance', () => {
  it('does not start writes during a recovery read even when maintenance is canceled', async () => {
    vi.useFakeTimers()
    const f = fixture()
    await searchDraft(f)
    const confirmed = f.stored()
    let finish!: (value: SceneDesktopSnapshot) => void
    f.api.read.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    f.model.reload()
    await Promise.resolve()
    const resolution = f.maintenance.begin()
    resolution.release()
    f.model.dispatch({ type: 'query', value: 'Ignored' })
    await vi.advanceTimersByTimeAsync(500)
    expect(f.api.save).not.toHaveBeenCalled()
    finish(confirmed)
    await vi.runAllTimersAsync()
    expect(f.model.snapshot().state).toEqual(confirmed.state)
    expect(f.maintenance.hasDirty()).toBe(false)
    expect(f.api.save).not.toHaveBeenCalled()
  })

  it.each(['save', 'discard'] as const)(
    'settles a detached scene timer with %s and blocks input immediately',
    async (choice) => {
      vi.useFakeTimers()
      const f = fixture()
      await searchDraft(f)
      const unsubscribe = f.model.subscribe(() => {})
      unsubscribe()
      const confirmed = f.stored()
      expect(f.maintenance.hasDirty()).toBe(true)
      const resolution = f.maintenance.begin()
      try {
        f.model.dispatch({ type: 'query', value: 'Forbidden' })
        f.model.reload()
        await vi.advanceTimersByTimeAsync(500)
        expect(f.api.save).not.toHaveBeenCalled()
        expect(await resolution.resolve(choice)).toEqual([])
        expect(f.api.save).toHaveBeenCalledTimes(choice === 'save' ? 1 : 0)
        expect(f.model.snapshot().state).toEqual(
          choice === 'save' ? f.stored().state : confirmed.state
        )
        if (choice === 'save')
          expect(
            f.api.save.mock.calls[0]?.[0].state.windows.find(
              (w) => w.kind === 'search'
            )?.query
          ).toBe('Küste')
        expect(f.maintenance.hasDirty()).toBe(false)
      } finally {
        resolution.release()
      }
    }
  )

  it('resumes deferred autosave when maintenance is canceled', async () => {
    vi.useFakeTimers()
    const f = fixture()
    await searchDraft(f)
    const resolution = f.maintenance.begin()
    await vi.advanceTimersByTimeAsync(500)
    expect(f.api.save).not.toHaveBeenCalled()
    resolution.release()
    await vi.runAllTimersAsync()
    expect(f.api.save).toHaveBeenCalledOnce()
    expect(f.maintenance.hasDirty()).toBe(false)
  })

  it.each(['save', 'discard'] as const)(
    'waits for an in-flight write before %s and holds subsequent intent',
    async (choice) => {
      const f = fixture()
      await f.model.load()
      let finish!: (value: SceneDesktopSnapshot) => void
      f.api.save.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve
        })
      )
      f.model.dispatch({ type: 'minimize', id: 'overview' })
      f.model.dispatch({ type: 'close', id: 'overview' })
      const first = f.api.save.mock.calls[0]![0]
      const confirmed = { ...first, revision: 2 }
      const resolution = f.maintenance.begin()
      try {
        const done = vi.fn()
        const result = resolution.resolve(choice).then(done)
        await Promise.resolve()
        expect(done).not.toHaveBeenCalled()
        f.replace(confirmed)
        finish(confirmed)
        await result
        expect(done).toHaveBeenCalledWith([])
        expect(f.api.save).toHaveBeenCalledTimes(choice === 'save' ? 2 : 1)
        expect(f.model.snapshot().state).toEqual(
          choice === 'save' ? f.stored().state : confirmed.state
        )
        expect(f.maintenance.hasDirty()).toBe(false)
      } finally {
        resolution.release()
      }
    }
  )

  it('reconciles a committed write after a failed read without replaying it', async () => {
    const f = fixture()
    await f.model.load()
    f.api.save.mockImplementationOnce((input) => {
      f.replace({ ...input, revision: 2 })
      return Promise.reject(new Error('lost response'))
    })
    f.api.read.mockRejectedValueOnce(new Error('offline'))
    f.model.dispatch({ type: 'close', id: 'overview' })
    await vi.waitFor(() => expect(f.model.snapshot().error).not.toBeNull())
    const resolution = f.maintenance.begin()
    try {
      expect(await resolution.resolve('save')).toEqual([])
      expect(f.api.save).toHaveBeenCalledOnce()
      expect(f.model.snapshot().state).toEqual(f.stored().state)
      expect(f.maintenance.hasDirty()).toBe(false)
    } finally {
      resolution.release()
    }
  })

  it('permits an explicit retry only after an unchanged persisted revision and state', async () => {
    const f = fixture()
    await f.model.load()
    f.api.save.mockRejectedValueOnce(new Error('not saved'))
    f.model.dispatch({ type: 'close', id: 'overview' })
    await vi.waitFor(() => expect(f.model.snapshot().error).not.toBeNull())
    const resolution = f.maintenance.begin()
    try {
      expect(await resolution.resolve('save')).toEqual([])
      expect(f.api.save).toHaveBeenCalledTimes(2)
      expect(f.api.save.mock.calls[1]?.[0].expectedRevision).toBe(1)
      expect(f.stored().state?.windows).toEqual([])
    } finally {
      resolution.release()
    }
  })

  it('keeps a conflicting draft through read failures and discards against fresh storage without overwriting', async () => {
    const f = fixture()
    await f.model.load()
    const newer = { ...f.stored(), revision: 8 }
    f.api.save.mockRejectedValueOnce(new Error('stale'))
    f.replace(newer)
    f.model.dispatch({ type: 'close', id: 'overview' })
    await vi.waitFor(() => expect(f.model.snapshot().error).not.toBeNull())
    const resolution = f.maintenance.begin()
    try {
      expect(await resolution.resolve('save')).toMatchObject([
        { label: 'Szenendesktop' }
      ])
      f.api.read.mockRejectedValueOnce(new Error('offline'))
      expect(await resolution.resolve('discard')).toHaveLength(1)
      expect(f.maintenance.hasDirty()).toBe(true)
      expect(await resolution.resolve('discard')).toEqual([])
      expect(f.api.save).toHaveBeenCalledOnce()
      expect(f.model.snapshot().state).toEqual(newer.state)
    } finally {
      resolution.release()
    }
  })

  it('settles all scene owners even after leaving their routes', async () => {
    vi.useFakeTimers()
    const maintenance = new MaintenanceDraftCoordinator()
    const a = fixture(maintenance, 'a')
    const b = fixture(maintenance, 'b')
    await searchDraft(a)
    await searchDraft(b)
    const resolution = maintenance.begin()
    try {
      expect(await resolution.resolve('save')).toEqual([])
      expect(a.api.save.mock.calls[0]?.[0].sceneId).toBe('a')
      expect(b.api.save.mock.calls[0]?.[0].sceneId).toBe('b')
      expect(maintenance.hasDirty()).toBe(false)
    } finally {
      resolution.release()
    }
  })
})
