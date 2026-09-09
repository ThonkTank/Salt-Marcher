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
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReleaseStatus } from '../../src/shared/contracts/release.js'
import { ReleaseSettings } from '../../src/renderer/shell/release-settings.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import { maintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'
const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  check: vi.fn(),
  download: vi.fn(),
  install: vi.fn(),
  listener: null as ((status: ReleaseStatus) => void) | null
}))
vi.mock('../../src/renderer/capabilities/use-capability-api.js', () => {
  const api = {
    runtime: {
      coreStatus: () => Promise.resolve('ready'),
      onCoreStatus: () => () => {}
    },
    updates: {
      status: mocks.status,
      check: mocks.check,
      download: mocks.download,
      install: mocks.install,
      profiles: () => Promise.resolve([]),
      onStatus: (listener: (status: ReleaseStatus) => void) => {
        mocks.listener = listener
        return () => {
          mocks.listener = null
        }
      }
    },
    backups: { list: () => Promise.resolve([]) }
  }
  return { useCapabilityApi: () => api }
})
const idle: ReleaseStatus = {
  enabled: true,
  installed: true,
  currentVersion: '0.3.0',
  phase: 'idle',
  availableVersion: null,
  notes: '',
  progress: 0,
  message: ''
}
const available: ReleaseStatus = {
  ...idle,
  phase: 'available',
  availableVersion: '0.3.1',
  notes: 'Gespeicherte Kampagnen bleiben erhalten.'
}
const downloaded: ReleaseStatus = {
  ...available,
  phase: 'downloaded',
  progress: 1
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.status.mockResolvedValue(idle)
  mocks.check.mockResolvedValue(available)
  mocks.download.mockResolvedValue(downloaded)
  mocks.install.mockResolvedValue({ ...downloaded, phase: 'maintenance' })
})
afterEach(() => {
  cleanup()
  expect(maintenanceDraftCoordinator.isLocked()).toBe(false)
})
async function view() {
  const ready = vi.fn()
  render(
    <ModalLayerProvider>
      <input aria-label="Kampagnennotiz" />
      <ReleaseSettings onReady={ready} />
    </ModalLayerProvider>
  )
  fireEvent.click(await screen.findByRole('button', { name: /Einstellungen/ }))
  return ready
}
it('keeps checking, downloading and confirmed installation separate', async () => {
  await view()
  expect(mocks.check).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Jetzt prüfen' }))
  await screen.findByText('Version 0.3.1')
  expect(screen.getByText(available.notes)).toBeVisible()
  expect(mocks.download).not.toHaveBeenCalled()
  expect(mocks.install).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Herunterladen' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Installieren und neu starten' })
  )
  expect(mocks.install).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
  expect(mocks.install).not.toHaveBeenCalled()
  fireEvent.click(
    screen.getByRole('button', { name: 'Installieren und neu starten' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))
  await waitFor(() =>
    expect(mocks.install).toHaveBeenCalledWith({ confirmed: true })
  )
  expect(maintenanceDraftCoordinator.isLocked()).toBe(true)
})
it('allows working while a download continues and never installs on closing', async () => {
  mocks.status.mockResolvedValue(available)
  let finish!: (status: ReleaseStatus) => void
  mocks.download.mockImplementation(
    () =>
      new Promise<ReleaseStatus>((resolve) => {
        finish = resolve
      })
  )
  await view()
  fireEvent.click(screen.getByRole('button', { name: 'Herunterladen' }))
  act(() => {
    mocks.listener?.({ ...available, phase: 'downloading', progress: 0.4 })
  })
  expect(
    screen.getByRole('progressbar', { name: 'Downloadfortschritt' })
  ).toHaveAttribute('value', '0.4')
  expect(screen.getByRole('button', { name: 'Jetzt prüfen' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.change(screen.getByLabelText('Kampagnennotiz'), {
    target: { value: 'Weitergespielt' }
  })
  expect(screen.getByLabelText('Kampagnennotiz')).toHaveValue('Weitergespielt')
  expect(maintenanceDraftCoordinator.isLocked()).toBe(false)
  await act(async () => {
    finish(downloaded)
    await Promise.resolve()
  })
  expect(mocks.install).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Einstellungen/ }))
  expect(
    screen.getByRole('button', { name: 'Installieren und neu starten' })
  ).toBeEnabled()
})
it.each(['checking', 'downloading'] as const)(
  'blocks competing actions for external %s status but permits dismissal',
  async (phase) => {
    await view()
    act(() => {
      mocks.listener?.({ ...available, phase })
    })
    expect(screen.getByRole('button', { name: 'Jetzt prüfen' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Herunterladen' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Profilordner übernehmen' })
    ).toBeDisabled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.check).not.toHaveBeenCalled()
    expect(mocks.install).not.toHaveBeenCalled()
  }
)
it('keeps the app ready after an offline check and permits retry', async () => {
  const ready = await view()
  mocks.check.mockRejectedValueOnce(new Error('offline'))
  fireEvent.click(screen.getByRole('button', { name: 'Jetzt prüfen' }))
  await screen.findByRole('alert')
  expect(ready).toHaveBeenCalledWith(true)
  expect(screen.getByRole('button', { name: 'Jetzt prüfen' })).toBeEnabled()
  expect(maintenanceDraftCoordinator.isLocked()).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Jetzt prüfen' }))
  await screen.findByText('Version 0.3.1')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(mocks.download).not.toHaveBeenCalled()
})

it('shows a failed download without offering installation and retries only on request', async () => {
  mocks.status.mockResolvedValue(available)
  mocks.download.mockResolvedValueOnce({
    ...available,
    phase: 'error',
    message: 'Download fehlgeschlagen. Bitte erneut herunterladen.'
  })
  await view()
  fireEvent.click(screen.getByRole('button', { name: 'Herunterladen' }))
  await screen.findByText(
    'Download fehlgeschlagen. Bitte erneut herunterladen.'
  )
  expect(
    screen.queryByRole('button', { name: 'Installieren und neu starten' })
  ).toBeNull()
  expect(mocks.download).toHaveBeenCalledOnce()
  expect(mocks.install).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Herunterladen' }))
  await screen.findByRole('button', { name: 'Installieren und neu starten' })
  expect(mocks.download).toHaveBeenCalledTimes(2)
  expect(mocks.install).not.toHaveBeenCalled()
})
