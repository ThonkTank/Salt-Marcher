import { describe, expect, it, vi } from 'vitest'
import {
  draftConcern,
  MaintenanceDraftCoordinator
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'

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
  it('resolves only matching drafts and their real dependencies', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    let routeDirty = true
    let commandDirty = true
    const route = vi.fn(() => {
      routeDirty = false
      return Promise.resolve(true)
    })
    const command = vi.fn(() => {
      commandDirty = false
      return Promise.resolve(true)
    })
    const xp = vi.fn()
    coordinator.register('route', {
      label: 'Route',
      concerns: [draftConcern.travelRoute('scene-a')],
      dependsOn: ['command'],
      isDirty: () => routeDirty,
      save: route
    })
    coordinator.register('command', {
      label: 'Travel command',
      isDirty: () => commandDirty,
      save: command
    })
    coordinator.register('xp', {
      label: 'XP',
      concerns: [draftConcern.character('character-a')],
      isDirty: () => true,
      save: xp
    })
    const selection = {
      kind: 'concerns' as const,
      concerns: [draftConcern.travelRoute('scene-a')]
    }
    expect(coordinator.hasDirty(selection)).toBe(true)
    const resolution = coordinator.begin(selection)
    expect(coordinator.isLocked()).toBe(false)
    expect(coordinator.isDraftLocked('route')).toBe(true)
    expect(coordinator.isDraftLocked('command')).toBe(true)
    expect(coordinator.isDraftLocked('xp')).toBe(false)
    expect(await resolution.resolve('save')).toEqual([])
    expect(command).toHaveBeenCalledBefore(route)
    expect(xp).not.toHaveBeenCalled()
    expect(coordinator.hasDirty()).toBe(true)
    resolution.release()
  })
  it('ignores missing dependencies outside the selected roots', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    coordinator.register('unrelated', {
      label: 'Unrelated',
      concerns: [draftConcern.character('character-a')],
      dependsOn: ['missing'],
      isDirty: () => true
    })
    const selection = {
      kind: 'concerns' as const,
      concerns: [draftConcern.travelRoute('scene-a')]
    }
    const resolution = coordinator.begin(selection)
    expect(await resolution.resolve('check')).toEqual([])
    resolution.release()
  })
  it('locks a matching editor registered during targeted resolution', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    let routeDirty = true
    coordinator.register('route', {
      label: 'Route',
      concerns: [draftConcern.travelRoute('scene-a')],
      isDirty: () => routeDirty,
      save: () => {
        routeDirty = false
        coordinator.register('late-route', {
          label: 'Late route',
          concerns: [draftConcern.travelRoute('scene-a')],
          isDirty: () => true
        })
        expect(coordinator.isDraftLocked('late-route')).toBe(true)
        return Promise.resolve(true)
      }
    })
    const resolution = coordinator.begin({
      kind: 'concerns',
      concerns: [draftConcern.travelRoute('scene-a')]
    })
    expect(
      (await resolution.resolve('save')).map((failure) => failure.id)
    ).toEqual(['late-route'])
    resolution.release()
  })
})

describe('explicit editor dependencies', () => {
  it.each(['save', 'discard'] as const)(
    'settles children before parents on %s, including initially clean parents',
    async (choice) => {
      const coordinator = new MaintenanceDraftCoordinator()
      const calls: string[] = []
      let parentDirty = false
      let childDirty = true
      const parent = () => {
        calls.push('parent')
        parentDirty = false
        return Promise.resolve(true)
      }
      const child = () => {
        calls.push('child')
        childDirty = false
        parentDirty = true
        return Promise.resolve(true)
      }
      coordinator.register('parent', {
        label: 'Ort',
        dependsOn: ['child'],
        isDirty: () => parentDirty,
        save: parent,
        discard: parent
      })
      coordinator.register('child', {
        label: 'Fraktion',
        isDirty: () => childDirty,
        save: child,
        discard: child
      })
      const resolution = coordinator.begin()
      expect(await resolution.resolve(choice)).toEqual([])
      expect(calls).toEqual(['child', 'parent'])
      resolution.release()
    }
  )
  it('blocks ancestors of a failing child while preserving independent successes', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    let childDirty = true
    let parentDirty = true
    let independentDirty = true
    const child = vi
      .fn()
      .mockRejectedValueOnce(new Error('child failed'))
      .mockImplementationOnce(() => {
        childDirty = false
        return true
      })
    const parent = vi.fn(() => {
      parentDirty = false
      return Promise.resolve(true)
    })
    const independent = vi.fn(() => {
      independentDirty = false
      return Promise.resolve(true)
    })
    coordinator.register('parent', {
      label: 'Ort',
      dependsOn: ['child'],
      isDirty: () => parentDirty,
      save: parent
    })
    coordinator.register('child', {
      label: 'Fraktion',
      isDirty: () => childDirty,
      save: child
    })
    coordinator.register('independent', {
      label: 'NSC',
      isDirty: () => independentDirty,
      save: independent
    })
    const resolution = coordinator.begin()
    expect(
      (await resolution.resolve('save')).map((failure) => failure.id)
    ).toEqual(['child', 'parent'])
    expect(parent).not.toHaveBeenCalled()
    expect(independent).toHaveBeenCalledOnce()
    expect(await resolution.resolve('save')).toEqual([])
    expect(parent).toHaveBeenCalledOnce()
    expect(independent).toHaveBeenCalledOnce()
    resolution.release()
  })
  it('does not persist parents when children acknowledge save but remain dirty', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    const parent = vi.fn()
    coordinator.register('parent', {
      label: 'Ort',
      dependsOn: ['child'],
      isDirty: () => true,
      save: parent
    })
    coordinator.register('child', {
      label: 'Fraktion',
      isDirty: () => true,
      save: () => Promise.resolve(true)
    })
    const resolution = coordinator.begin()
    expect(
      (await resolution.resolve('save')).map((failure) => failure.id)
    ).toEqual(['child', 'parent'])
    expect(parent).not.toHaveBeenCalled()
    resolution.release()
  })
  it('does not repeat a successful child after its parent failed', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    let childDirty = true
    let parentDirty = true
    const child = vi.fn(() => {
      childDirty = false
      return Promise.resolve(true)
    })
    const parent = vi
      .fn()
      .mockRejectedValueOnce(new Error('parent failed'))
      .mockImplementationOnce(() => {
        parentDirty = false
        return true
      })
    coordinator.register('parent', {
      label: 'Ort',
      dependsOn: ['child'],
      isDirty: () => parentDirty,
      save: parent
    })
    coordinator.register('child', {
      label: 'Fraktion',
      isDirty: () => childDirty,
      save: child
    })
    const resolution = coordinator.begin()
    expect(await resolution.resolve('save')).toHaveLength(1)
    expect(await resolution.resolve('save')).toEqual([])
    expect(child).toHaveBeenCalledOnce()
    resolution.release()
  })
  it('rejects cycles without calling their mutations', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    const save = vi.fn()
    coordinator.register('a', {
      label: 'A',
      dependsOn: ['b'],
      isDirty: () => true,
      save
    })
    coordinator.register('b', {
      label: 'B',
      dependsOn: ['a'],
      isDirty: () => true,
      save
    })
    const resolution = coordinator.begin()
    const failures = await resolution.resolve('save')
    expect(failures).toHaveLength(2)
    expect(failures.some((failure) => failure.message.includes('Kreis'))).toBe(
      true
    )
    expect(save).not.toHaveBeenCalled()
    resolution.release()
  })
  it('rejects unavailable children before calling their parent', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    const save = vi.fn()
    coordinator.register('parent', {
      label: 'Ort',
      dependsOn: ['missing'],
      isDirty: () => true,
      save
    })
    const resolution = coordinator.begin()
    const failures = await resolution.resolve('save')
    expect(failures).toHaveLength(1)
    expect(failures[0]?.id).toBe('parent')
    expect(failures[0]?.message).toContain('nicht verfügbar')
    expect(save).not.toHaveBeenCalled()
    resolution.release()
  })
  it('rejects dependencies added by child completion until a fresh attempt', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    const dependencies = ['child']
    let dirty = true
    const save = vi.fn()
    coordinator.register('parent', {
      label: 'Ort',
      dependsOn: dependencies,
      isDirty: () => true,
      save
    })
    coordinator.register('child', {
      label: 'Fraktion',
      isDirty: () => dirty,
      save: () => {
        dirty = false
        dependencies.push('new')
        coordinator.register('new', { label: 'Neu', isDirty: () => true })
        return Promise.resolve(true)
      }
    })
    const resolution = coordinator.begin()
    expect(
      (await resolution.resolve('save')).map((failure) => failure.id)
    ).toEqual(['parent', 'new'])
    expect(save).not.toHaveBeenCalled()
    resolution.release()
  })
})

describe('read-only maintenance confirmation', () => {
  it('never saves or discards an unexpectedly dirty owner', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    const save = vi.fn()
    const discard = vi.fn()
    coordinator.register('draft', {
      label: 'Ort',
      isDirty: () => true,
      save,
      discard
    })
    const resolution = coordinator.begin()
    expect(await resolution.resolve('check')).toHaveLength(1)
    expect(save).not.toHaveBeenCalled()
    expect(discard).not.toHaveBeenCalled()
    resolution.release()
  })
  it('checks missing dependencies even when the parent is clean', async () => {
    const coordinator = new MaintenanceDraftCoordinator()
    coordinator.register('parent', {
      label: 'Ort',
      dependsOn: ['loading'],
      isDirty: () => false
    })
    const resolution = coordinator.begin()
    expect(await resolution.resolve('check')).toEqual([
      expect.objectContaining({ id: 'parent' })
    ])
    resolution.release()
  })
})

it.each([false, true])(
  'only permits removal of an initially clean dependent view (dirty=%s)',
  async (initiallyDirty) => {
    const coordinator = new MaintenanceDraftCoordinator()
    let rosterDirty = true
    let removeXp = () => {}
    coordinator.register('roster', {
      label: 'Besetzung',
      isDirty: () => rosterDirty,
      save: () => {
        rosterDirty = false
        removeXp()
        return Promise.resolve(true)
      }
    })
    removeXp = coordinator.register('xp', {
      label: 'XP',
      isDirty: () => initiallyDirty,
      save: () => Promise.resolve(true)
    })
    const resolution = coordinator.begin()
    const failures = await resolution.resolve('save')
    expect(failures).toHaveLength(initiallyDirty ? 1 : 0)
    if (initiallyDirty) expect(failures[0]?.label).toBe('XP')
    resolution.release()
  }
)
it('blocks an initially clean removed view that becomes dirty during another save', async () => {
  const coordinator = new MaintenanceDraftCoordinator()
  let rosterDirty = true
  let xpDirty = false
  let removeXp = () => {}
  coordinator.register('roster', {
    label: 'Besetzung',
    isDirty: () => rosterDirty,
    save: () => {
      rosterDirty = false
      xpDirty = true
      removeXp()
      return Promise.resolve(true)
    }
  })
  removeXp = coordinator.register('xp', { label: 'XP', isDirty: () => xpDirty })
  const resolution = coordinator.begin()
  const failures = await resolution.resolve('save')
  expect(failures).toHaveLength(1)
  expect(failures[0]?.label).toBe('XP')
  resolution.release()
})
