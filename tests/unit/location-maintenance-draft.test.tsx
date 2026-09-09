// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WorldLocationDialog,
  type WorldLocationDialogProps
} from '../../src/renderer/features/worldplanner/world-location-dialog.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
const references = {
  factions: { status: 'ready' as const, value: [] },
  tables: { status: 'ready' as const, value: [] }
}
let resolution: MaintenanceDraftResolution | undefined
let unregister: (() => void) | undefined
function view(overrides: Partial<WorldLocationDialogProps> = {}) {
  const save = vi.fn().mockResolvedValue({ status: 'saved' })
  const close = vi.fn()
  render(
    <ModalLayerProvider>
      <WorldLocationDialog
        location={null}
        references={references}
        suggestTags={() => Promise.resolve([])}
        close={close}
        save={save}
        {...overrides}
      />
    </ModalLayerProvider>
  )
  fireEvent.change(screen.getByRole('textbox', { name: 'Ortsname' }), {
    target: { value: 'Kap' }
  })
  fireEvent.change(screen.getByRole('combobox', { name: 'Tags' }), {
    target: { value: ' Küste ' }
  })
  return { save, close }
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
describe('location maintenance owner', () => {
  it('includes the pending tag and rejects late name, tag and note mutations', async () => {
    const { save } = view()
    begin()
    for (const [role, name] of [
      ['textbox', 'Ortsname'],
      ['textbox', 'GM-Notizen'],
      ['combobox', 'Tags']
    ] as const) {
      const input = screen.getByRole(role, { name })
      expect(input).toBeDisabled()
      fireEvent.change(input, { target: { value: 'Forbidden' } })
    }
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(save).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        displayName: 'Kap',
        tags: ['Küste'],
        notes: ''
      })
    )
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  })
  it('retains invalid pending tags and does not persist', async () => {
    const { save } = view()
    fireEvent.change(screen.getByRole('combobox', { name: 'Tags' }), {
      target: { value: 'x'.repeat(41) }
    })
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    expect(save).not.toHaveBeenCalled()
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
  })
  it('retries only the retained partial result after placement failure', async () => {
    const retry = vi
      .fn()
      .mockResolvedValueOnce({ status: 'failed', message: 'Still unavailable' })
      .mockResolvedValueOnce({ status: 'saved' })
    const save = vi.fn().mockResolvedValue({
      status: 'partially-saved',
      message: 'Placement failed',
      retry
    })
    view({ save })
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(save).toHaveBeenCalledOnce()
    expect(retry).toHaveBeenCalledTimes(2)
  })
  it('keeps a failed save available for retry', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce({ status: 'saved' })
    view({ save })
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({ tags: ['Küste'] })
    )
  })
  it('discards without repeating a partially successful save', async () => {
    const retry = vi.fn()
    const save = vi.fn().mockResolvedValue({
      status: 'partially-saved',
      message: 'Placement failed',
      retry
    })
    const { close } = view({ save })
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    await act(async () => {
      expect(await resolution!.resolve('discard')).toEqual([])
    })
    expect(save).toHaveBeenCalledOnce()
    expect(retry).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })
  it('waits for a normal save already in flight', async () => {
    let finish!: () => void
    const save = vi.fn(
      () =>
        new Promise<{ status: 'saved' }>((resolve) => {
          finish = () => resolve({ status: 'saved' })
        })
    )
    view({ save })
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Tags' }), {
      key: 'Enter'
    })
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    begin()
    await act(async () => {
      const result = resolution!.resolve('save')
      finish()
      expect(await result).toEqual([])
    })
    expect(save).toHaveBeenCalledOnce()
  })
  it('accepts a child reference under the editing barrier before the parent save', async () => {
    let callback!: (value: {
      id: string
      displayName: string
      notes: string
      disposition: number
      primaryEncounterTableId: null
      position: number
      inventory: []
    }) => void
    let open = true
    const { save } = view({
      relatedCreation: {
        requestFactionCreation: (created) => {
          callback = created
          return { id: 'child', isOpen: () => open }
        },
        requestTableCreation: () => ({ id: 'unused', isOpen: () => false })
      }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Neue Fraktion' }))
    const id = '01900000-0000-7000-8000-000000000113'
    let dirty = true
    unregister = maintenanceDraftCoordinator.register('child', {
      label: 'Fraktion',
      isDirty: () => dirty,
      save: () => {
        callback({
          id,
          displayName: 'Bund',
          notes: '',
          disposition: 0,
          primaryEncounterTableId: null,
          position: 0,
          inventory: []
        })
        dirty = false
        open = false
        return Promise.resolve(true)
      }
    })
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(save).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ factionIds: [id] })
    )
  })
})
