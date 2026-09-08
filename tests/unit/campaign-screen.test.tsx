// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CampaignScreen,
  type CampaignScreenProps
} from '../../src/renderer/features/workspace/campaign-screen.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import {
  compareCampaigns,
  formatCampaignOpenedAt
} from '../../src/renderer/features/workspace/campaign-presentation.js'

const campaign = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Salzmark',
  createdAt: '2026-09-01T10:00:00.000Z',
  lastOpenedAt: '2026-09-08T10:00:00.000Z'
}
function fixture(
  overrides: Partial<CampaignScreenProps> = {}
): CampaignScreenProps {
  return {
    snapshot: {
      revision: 1,
      activeCampaignId: campaign.id,
      campaigns: [campaign],
      trashedCampaigns: []
    },
    status: 'ready',
    error: '',
    busy: false,
    sessionRetry: false,
    create: vi.fn(() => Promise.resolve(true)),
    activate: vi.fn(() => Promise.resolve(true)),
    rename: vi.fn(() => Promise.resolve(true)),
    trash: vi.fn(() => Promise.resolve(true)),
    restore: vi.fn(() => Promise.resolve(true)),
    deleteForever: vi.fn(() => Promise.resolve(true)),
    reconciliationPending: false,
    reconcile: vi.fn(() => Promise.resolve(null)),
    retryCatalog: vi.fn(() => Promise.resolve()),
    retrySession: vi.fn(() => Promise.resolve(true)),
    ...overrides
  }
}
function mount(props: CampaignScreenProps) {
  return render(
    <ModalLayerProvider>
      <CampaignScreen {...props} />
    </ModalLayerProvider>
  )
}
afterEach(cleanup)

describe('campaign screen', () => {
  it('is a full screen even with an active campaign and only opens on demand', () => {
    const props = fixture()
    mount(props)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Schließen' })
    ).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.activate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Salzmark öffnen' }))
    expect(props.activate).toHaveBeenCalledWith(campaign.id)
  })
  it('discards a name draft with X, but trims and saves explicitly', async () => {
    const props = fixture()
    mount(props)
    fireEvent.click(screen.getByRole('button', { name: 'Salzmark bearbeiten' }))
    fireEvent.change(screen.getByLabelText('Kampagnenname'), {
      target: { value: 'Verworfen' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(props.rename).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Salzmark bearbeiten' }))
    expect(screen.getByLabelText('Kampagnenname')).toHaveValue('Salzmark')
    fireEvent.change(screen.getByLabelText('Kampagnenname'), {
      target: { value: '  Neu  ' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(props.rename).toHaveBeenCalledWith(campaign.id, 'Neu')
  })
  it('blocks duplicate creates and closing while a command is pending', async () => {
    let finish!: (value: boolean) => void
    const create = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        })
    )
    mount(fixture({ create }))
    fireEvent.click(screen.getByRole('button', { name: '+ Neue Kampagne' }))
    fireEvent.change(screen.getByLabelText('Kampagnenname'), {
      target: { value: 'Neu' }
    })
    const button = screen.getByRole('button', { name: 'Erstellen & öffnen' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(create).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeDisabled()
    finish(false)
    await waitFor(() => expect(button).not.toBeDisabled())
    expect(screen.getByLabelText('Kampagnenname')).toHaveValue('Neu')
  })
  it('moves a campaign to trash from editing', async () => {
    const props = fixture()
    mount(props)
    fireEvent.click(screen.getByRole('button', { name: 'Salzmark bearbeiten' }))
    fireEvent.click(screen.getByRole('button', { name: 'In den Papierkorb' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(props.trash).toHaveBeenCalledWith(campaign.id)
  })
  it('restores without activating and requires exact confirmation to delete', async () => {
    const props = fixture({
      snapshot: {
        revision: 2,
        activeCampaignId: null,
        campaigns: [],
        trashedCampaigns: [{ ...campaign, trashedAt: campaign.createdAt }]
      }
    })
    mount(props)
    fireEvent.click(screen.getByRole('button', { name: 'Papierkorb (1)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wiederherstellen' }))
    await waitFor(() => expect(props.restore).toHaveBeenCalledWith(campaign.id))
    expect(props.activate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Papierkorb' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Löschen …' }))
    const input = screen.getByLabelText('Kampagnenname zur Bestätigung')
    const button = screen.getByRole('button', { name: 'Endgültig löschen' })
    fireEvent.change(input, { target: { value: 'salzmark' } })
    expect(button).toBeDisabled()
    fireEvent.change(input, { target: { value: 'Salzmark' } })
    fireEvent.click(button)
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Papierkorb' })).toBeVisible()
    )
    expect(props.deleteForever).toHaveBeenCalledWith(campaign.id, 'Salzmark')
  })
  it('distinguishes a failed read from an empty catalog', () => {
    const props = fixture({ status: 'failure', error: 'Lesen fehlgeschlagen' })
    mount(props)
    expect(
      screen.queryByRole('button', { name: '+ Neue Kampagne' })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }))
    expect(props.retryCatalog).toHaveBeenCalledOnce()
  })
  it('shows an empty trash popup with a uniform close control', () => {
    mount(fixture())
    fireEvent.click(screen.getByRole('button', { name: 'Papierkorb (0)' }))
    const popup = screen.getByRole('dialog')
    expect(within(popup).getByText('Der Papierkorb ist leer.')).toBeVisible()
    fireEvent.click(within(popup).getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
describe('campaign presentation', () => {
  it('orders known usage ahead of unknown and breaks ties by creation and identity', () => {
    const unknown = { ...campaign, id: 'a', lastOpenedAt: null }
    const newer = { ...unknown, id: 'b', createdAt: '2026-09-05T00:00:00.000Z' }
    expect(
      [unknown, newer, campaign].sort(compareCampaigns).map((c) => c.id)
    ).toEqual([campaign.id, 'b', 'a'])
  })
  it('uses calendar days rather than 24-hour offsets and handles unknown usage', () => {
    const now = new Date(2026, 8, 8, 0, 10)
    expect(
      formatCampaignOpenedAt(new Date(2026, 8, 7, 23, 50).toISOString(), now)
    ).toContain('gestern, 23:50')
    expect(formatCampaignOpenedAt(null, now)).toBe('Letzte Öffnung unbekannt')
  })
})
