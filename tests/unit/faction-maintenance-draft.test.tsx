// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWorldFactionEditorController } from '../../src/renderer/features/worldplanner/use-world-faction-editor-controller.js'
import type { WorldFactionEditorRenderProps } from '../../src/renderer/features/worldplanner/world-faction-editor-types.js'
import { emptyEncounterTableSnapshot } from '../../src/renderer/features/encounter-table/encounter-table-snapshot.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
const receipt = {
  snapshot: { revision: 1, factions: [] },
  saved: {
    id: '01900000-0000-7000-8000-000000000113',
    displayName: 'Bund',
    notes: '',
    disposition: 0,
    primaryEncounterTableId: null,
    position: 0,
    inventory: []
  }
}
let resolution: MaintenanceDraftResolution | undefined
let unregister: (() => void) | undefined
function setup(overrides: Partial<WorldFactionEditorRenderProps> = {}) {
  const save = vi.fn().mockResolvedValue(receipt)
  const close = vi.fn()
  const props: WorldFactionEditorRenderProps = {
    faction: null,
    tableSnapshot: emptyEncounterTableSnapshot,
    maintenanceId: 'faction',
    save,
    saved: vi.fn(),
    close,
    onError: vi.fn(),
    inspect: vi.fn(),
    creatures: { detail: vi.fn() },
    invocation: { kind: 'catalog' },
    requestTableCreation: () => ({ id: 'child', isOpen: () => false }),
    ...overrides
  }
  const hook = renderHook(() => useWorldFactionEditorController(props))
  act(() => hook.result.current.dispatch({ kind: 'name', value: 'Bund' }))
  return { ...hook, save, close }
}
function begin() {
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
}
afterEach(() => {
  act(() => resolution?.release())
  resolution = undefined
  cleanup()
  unregister?.()
  unregister = undefined
})
describe('faction maintenance owner', () => {
  it('saves the owner draft and rejects direct mutations while locked', async () => {
    const { result, save } = setup()
    begin()
    act(() => result.current.dispatch({ kind: 'name', value: 'Late edit' }))
    expect(result.current.busy).toBe(true)
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(save).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ displayName: 'Bund' })
    )
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  })
  it('retries only reconciliation after a persisted save', async () => {
    const saved = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('projection failed')
      })
      .mockImplementationOnce(() => undefined)
    const { save } = setup({ saved })
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(save).toHaveBeenCalledOnce()
    expect(saved).toHaveBeenCalledTimes(2)
  })
  it('reuses a normal pending save', async () => {
    let finish!: () => void
    const save = vi.fn(
      () =>
        new Promise<typeof receipt>((resolve) => {
          finish = () => resolve(receipt)
        })
    )
    const { result } = setup({ save })
    await act(async () => {
      void result.current.submit()
      await Promise.resolve()
    })
    begin()
    await act(async () => {
      const pending = resolution!.resolve('save')
      finish()
      expect(await pending).toEqual([])
    })
    expect(save).toHaveBeenCalledOnce()
  })
  it('discards without saving', async () => {
    const { save, close } = setup()
    begin()
    await act(async () => {
      expect(await resolution!.resolve('discard')).toEqual([])
    })
    expect(save).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })
  it('accepts its child result before persistence while ordinary input stays blocked', async () => {
    let complete!: Parameters<
      WorldFactionEditorRenderProps['requestTableCreation']
    >[0]
    let open = true
    const { result, save } = setup({
      requestTableCreation: (callback) => {
        complete = callback
        return { id: 'child', isOpen: () => open }
      }
    })
    act(() => result.current.requestTableCreation())
    const table = {
      id: '01900000-0000-7000-8000-000000000114',
      scope: 'campaign' as const,
      protected: false,
      displayName: 'Tabelle',
      description: '',
      position: 0,
      entries: []
    }
    let childDirty = true
    unregister = maintenanceDraftCoordinator.register('child', {
      label: 'Tabelle',
      isDirty: () => childDirty,
      save: () => {
        complete({
          saved: table,
          snapshot: {
            ...emptyEncounterTableSnapshot,
            campaign: { revision: 1, tables: [table], summaries: [] }
          }
        })
        childDirty = false
        open = false
        return Promise.resolve(true)
      }
    })
    begin()
    act(() => result.current.dispatch({ kind: 'name', value: 'Forbidden' }))
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(save).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        displayName: 'Bund',
        primaryEncounterTableId: table.id
      })
    )
  })
  it('does not save the parent while a lazy child is not registered yet', async () => {
    const { result, save } = setup({
      requestTableCreation: () => ({ id: 'loading-child', isOpen: () => true })
    })
    act(() => result.current.requestTableCreation())
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([
        expect.objectContaining({ id: 'faction' })
      ])
    })
    expect(save).not.toHaveBeenCalled()
  })
})
