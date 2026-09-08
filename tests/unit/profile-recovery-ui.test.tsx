// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import { ReleaseSettings } from '../../src/renderer/shell/release-settings.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import type { ReleaseStatus } from '../../src/shared/contracts/release.js'
const mocks = vi.hoisted(() => ({
  coreStatus: vi.fn(),
  list: vi.fn(),
  restore: vi.fn(),
  importProfile: vi.fn(),
  status: vi.fn()
}))
vi.mock('../../src/renderer/capabilities/use-capability-api.js', () => {
  // No campaign/domain API is supplied: recovery must not depend on it.
  const api = {
    runtime: { coreStatus: mocks.coreStatus, onCoreStatus: () => () => {} },
    updates: {
      status: mocks.status,
      importProfile: mocks.importProfile,
      onStatus: () => () => {},
      profiles: () => Promise.resolve([])
    },
    backups: { list: mocks.list, restore: mocks.restore }
  }
  return { useCapabilityApi: () => api }
})
const status: ReleaseStatus = {
  enabled: true,
  installed: true,
  currentVersion: '0.3.0',
  phase: 'idle',
  availableVersion: null,
  notes: '',
  progress: 0,
  message: ''
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.status.mockResolvedValue(status)
  mocks.importProfile.mockResolvedValue(status)
  mocks.coreStatus.mockResolvedValue('corrupt-data')
  mocks.list.mockResolvedValue([
    {
      id: '00000000-0000-4000-8000-000000000001',
      createdAt: '2026-09-08T10:00:00Z',
      version: '0.3.0',
      bytes: 4096,
      valid: true,
      scope: 'profile'
    }
  ])
  mocks.restore.mockResolvedValue({ ...status, phase: 'maintenance' })
})
const unregister: Array<() => void> = []
afterEach(() => {
  cleanup()
  for (const remove of unregister.splice(0)) remove()
})
function draftOwner(
  id: string,
  save: () => Promise<boolean>,
  discard: () => Promise<boolean> = () => Promise.resolve(true)
) {
  let dirty = true
  unregister.push(
    maintenanceDraftCoordinator.register(id, {
      label: id,
      isDirty: () => dirty,
      save: async () => {
        const saved = await save()
        if (saved) dirty = false
        return saved
      },
      discard: async () => {
        const discarded = await discard()
        if (discarded) dirty = false
        return discarded
      }
    })
  )
}
async function openRestore() {
  view()
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Sicherungen und Wiederherstellung öffnen'
    })
  )
  fireEvent.click(
    await screen.findByRole('button', { name: 'Wiederherstellen' })
  )
}
function view() {
  render(
    <ModalLayerProvider>
      <ReleaseSettings onReady={() => {}} />
    </ModalLayerProvider>
  )
}
describe('profile recovery without a working campaign database', () => {
  it('saves every dirty owner before calling restore and retains the barrier during maintenance', async () => {
    const world = vi.fn(() => Promise.resolve(true))
    const npc = vi.fn(() => Promise.resolve(true))
    draftOwner('Welt', world)
    draftOwner('NSC', npc)
    await openRestore()
    expect(maintenanceDraftCoordinator.isLocked()).toBe(true)
    expect(mocks.restore).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Speichern und fortfahren' })
    )
    await waitFor(() => expect(mocks.restore).toHaveBeenCalledOnce())
    expect(world).toHaveBeenCalledOnce()
    expect(npc).toHaveBeenCalledOnce()
    expect(maintenanceDraftCoordinator.isLocked()).toBe(true)
  })
  it('shows the failed owner, preserves successful saves and cancels without maintenance', async () => {
    const world = vi.fn(() => Promise.resolve(true))
    draftOwner('Welt', world)
    draftOwner('NSC', () => Promise.reject(new Error('Name fehlt')))
    await openRestore()
    fireEvent.click(
      screen.getByRole('button', { name: 'Speichern und fortfahren' })
    )
    await screen.findByText('NSC: Name fehlt')
    expect(world).toHaveBeenCalledOnce()
    expect(mocks.restore).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(maintenanceDraftCoordinator.isLocked()).toBe(false)
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
  })
  it('discards through all owners before restoring', async () => {
    const save = vi.fn(() => Promise.resolve(true))
    const discard = vi.fn(() => Promise.resolve(true))
    draftOwner('Welt', save, discard)
    draftOwner('NSC', save, discard)
    await openRestore()
    fireEvent.click(
      screen.getByRole('button', { name: 'Verwerfen und fortfahren' })
    )
    await waitFor(() => expect(mocks.restore).toHaveBeenCalledOnce())
    expect(save).not.toHaveBeenCalled()
    expect(discard).toHaveBeenCalledTimes(2)
  })
  it('asks again when a dirty owner appears after the confirmation opened', async () => {
    await openRestore()
    draftOwner('Später Editor', () => Promise.resolve(true))
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))
    expect(
      screen.getByRole('button', { name: 'Speichern und fortfahren' })
    ).toBeDefined()
    expect(mocks.restore).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
  })
  it.each([
    'corrupt-data',
    'incompatible-data',
    'access-denied',
    'unavailable'
  ])('offers the independent backup view for %s', async (reason) => {
    mocks.coreStatus.mockResolvedValue(reason)
    view()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Sicherungen und Wiederherstellung öffnen'
      })
    )
    expect(
      await screen.findByRole('button', { name: 'Wiederherstellen' })
    ).toBeDefined()
    expect(mocks.list).toHaveBeenCalledOnce()
  })
  it('requests direct profile selection only after confirmation and exposes no path', async () => {
    view()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Sicherungen und Wiederherstellung öffnen'
      })
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Profilordner übernehmen' })
    )
    expect(mocks.importProfile).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))
    await waitFor(() =>
      expect(mocks.importProfile).toHaveBeenCalledWith({
        confirmed: true,
        mode: 'profile'
      })
    )
  })
  it('restores only after the explicit confirmation', async () => {
    view()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Sicherungen und Wiederherstellung öffnen'
      })
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Wiederherstellen' })
    )
    expect(mocks.restore).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))
    await waitFor(() =>
      expect(mocks.restore).toHaveBeenCalledWith({
        id: '00000000-0000-4000-8000-000000000001',
        confirmed: true
      })
    )
  })
  it('does not show a failure notice for a ready database', async () => {
    mocks.coreStatus.mockResolvedValue('ready')
    view()
    await screen.findByRole('button', { name: 'Einstellungen' })
    expect(
      screen.queryByRole('alert', { name: 'Profilwiederherstellung' })
    ).toBeNull()
  })
})
