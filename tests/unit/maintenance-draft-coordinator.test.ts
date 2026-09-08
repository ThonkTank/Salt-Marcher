import { describe, expect, it, vi } from 'vitest'
import { MaintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'

describe('maintenance draft coordination', () => {
  it('keeps successful saves when another editor fails, and retries remaining drafts', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    let firstDirty = true
    let secondDirty = true
    const first = vi.fn(() => {
      firstDirty = false
      return Promise.resolve(true)
    })
    const second = vi
      .fn()
      .mockRejectedValueOnce(new Error('NPC validation failed'))
      .mockImplementationOnce(() => {
        secondDirty = false
        return Promise.resolve(true)
      })
    coordinator.register('world', {
      label: 'Welt',
      isDirty: () => firstDirty,
      save: first
    })
    coordinator.register('npc', {
      label: 'NSC',
      isDirty: () => secondDirty,
      save: second
    })
    const resolution = coordinator.begin()
    expect(await resolution.resolve('save')).toEqual([
      { id: 'npc', label: 'NSC', message: 'NPC validation failed' }
    ])
    expect(firstDirty).toBe(false)
    expect(coordinator.isLocked()).toBe(true)
    expect(await resolution.resolve('save')).toEqual([])
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledTimes(2)
    resolution.release()
    expect(coordinator.isLocked()).toBe(false)
  })
  it('cancels without invoking owner operations', () => {
    const coordinator = new MaintenanceDraftCoordinator()
    const save = vi.fn()
    coordinator.register('draft', { label: 'Draft', isDirty: () => true, save })
    const resolution = coordinator.begin()
    resolution.release()
    expect(save).not.toHaveBeenCalled()
    expect(coordinator.hasDirty()).toBe(true)
  })
  it('discards through the owner and never invokes save', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    const save = vi.fn()
    let dirty = true
    const discard = vi.fn(() => {
      dirty = false
      return Promise.resolve(true)
    })
    coordinator.register('draft', {
      label: 'Draft',
      isDirty: () => dirty,
      save,
      discard
    })
    const resolution = coordinator.begin()
    expect(await resolution.resolve('discard')).toEqual([])
    expect(discard).toHaveBeenCalledOnce()
    expect(save).not.toHaveBeenCalled()
    resolution.release()
  })
  it('blocks competing resolution and release during an outstanding save', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    let finish!: (value: boolean) => void
    coordinator.register('draft', {
      label: 'Draft',
      isDirty: () => true,
      save: () =>
        new Promise((resolve) => {
          finish = resolve
        })
    })
    const resolution = coordinator.begin()
    const pending = resolution.resolve('save')
    expect(() => coordinator.begin()).toThrow('bereits')
    expect(() => resolution.release()).toThrow('abgeschlossen')
    await expect(resolution.resolve('discard')).rejects.toThrow(
      'nicht verfügbar'
    )
    finish(true)
    await pending
    resolution.release()
  })
  it('does not accept a positive save acknowledgement while changes remain', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    coordinator.register('draft', {
      label: 'Draft',
      isDirty: () => true,
      save: () => Promise.resolve(true)
    })
    const resolution = coordinator.begin()
    expect(await resolution.resolve('save')).toEqual([
      {
        id: 'draft',
        label: 'Draft',
        message:
          'Dieser Bereich enthält weiterhin offene Änderungen. Bitte erneut prüfen.'
      }
    ])
    resolution.release()
  })
  it('catches a dirty editor registered during another save', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    let dirty = true
    coordinator.register('first', {
      label: 'First',
      isDirty: () => dirty,
      save: () => {
        dirty = false
        coordinator.register('new', { label: 'New', isDirty: () => true })
        return Promise.resolve(true)
      }
    })
    const resolution = coordinator.begin()
    expect(
      (await resolution.resolve('save')).map((failure) => failure.id)
    ).toEqual(['new'])
    resolution.release()
  })
  it('rejects unresolved owners and publishes the global editing barrier', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    const changed = vi.fn()
    coordinator.subscribe(changed)
    const resolution = coordinator.begin()
    coordinator.register('late', { label: 'Neuer Editor', isDirty: () => true })
    expect(coordinator.isLocked()).toBe(true)
    expect(await resolution.resolve('save')).toHaveLength(1)
    resolution.release()
    expect(changed).toHaveBeenCalledTimes(2)
  })
})
