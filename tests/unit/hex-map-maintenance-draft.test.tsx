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
import { HexMapDialog } from '../../src/renderer/features/hex/hex-map-dialog.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type { HexMapSummary } from '../../src/shared/contracts/hex.js'
const saved: HexMapSummary = {
  id: '01900000-0000-7000-8000-000000000082',
  displayName: 'Inseln',
  metadataRevision: 0,
  contentRevision: 0,
  position: 0
}
let resolution: MaintenanceDraftResolution | undefined
function view(
  create: (name: string) => Promise<HexMapSummary>,
  created = vi.fn()
) {
  const close = vi.fn()
  render(
    <ModalLayerProvider>
      <HexMapDialog
        close={close}
        create={create}
        created={created}
        onError={vi.fn()}
        invocation={{ kind: 'catalog' }}
      />
    </ModalLayerProvider>
  )
  fireEvent.change(screen.getByRole('textbox', { name: 'Kartenname' }), {
    target: { value: 'Inseln' }
  })
  return close
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
})
describe('hex map maintenance owner', () => {
  it('blocks late inputs and routes maintenance save through the actual owner', async () => {
    const create = vi.fn(() => Promise.resolve(saved))
    const created = vi.fn()
    view(create, created)
    begin()
    const name = screen.getByRole('textbox', { name: 'Kartenname' })
    expect(name).toBeDisabled()
    fireEvent.change(name, { target: { value: 'Late edit' } })
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(create).toHaveBeenCalledExactlyOnceWith('Inseln')
    expect(created).toHaveBeenCalledExactlyOnceWith(saved)
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  })
  it('retains failed mutations and allows a later retry', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce(saved)
    view(create)
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([
        expect.objectContaining({ label: 'Hexkarte: Inseln' })
      ])
    })
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(create).toHaveBeenCalledTimes(2)
  })
  it('retries reconciliation without creating a second map', async () => {
    const create = vi.fn(() => Promise.resolve(saved))
    const created = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('projection failed')
      })
      .mockImplementationOnce(() => undefined)
    view(create, created)
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(create).toHaveBeenCalledOnce()
    expect(created).toHaveBeenCalledTimes(2)
  })
  it('waits for an already running normal save', async () => {
    let finish!: (map: HexMapSummary) => void
    const create = vi.fn(
      () =>
        new Promise<HexMapSummary>((resolve) => {
          finish = resolve
        })
    )
    view(create)
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }))
    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    begin()
    await act(async () => {
      const result = resolution!.resolve('save')
      finish(saved)
      expect(await result).toEqual([])
    })
    expect(create).toHaveBeenCalledOnce()
  })
  it('discards an unsaved draft without creating a map', async () => {
    const create = vi.fn(() => Promise.resolve(saved))
    const close = view(create)
    begin()
    await act(async () => {
      expect(await resolution!.resolve('discard')).toEqual([])
    })
    expect(create).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  })
  it('waits for a pending mutation before confirmed discard closes its owner', async () => {
    let finish!: (map: HexMapSummary) => void
    const create = vi.fn(
      () =>
        new Promise<HexMapSummary>((resolve) => {
          finish = resolve
        })
    )
    const close = view(create)
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }))
    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    begin()
    await act(async () => {
      const result = resolution!.resolve('discard')
      expect(close).not.toHaveBeenCalled()
      finish(saved)
      expect(await result).toEqual([])
    })
    expect(close).toHaveBeenCalledOnce()
    expect(create).toHaveBeenCalledOnce()
  })
})
