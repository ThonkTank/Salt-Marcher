// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CampaignScreen } from '../../src/renderer/features/workspace/campaign-screen.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'

const campaignId = '00000000-0000-4000-8000-000000000010'
const now = '2026-08-24T12:00:00.000Z'

afterEach(cleanup)

describe('Campaign receipt reconciliation UI', () => {
  it('keeps a draft mounted while reconciliation blocks submissions', async () => {
    const reconcile = vi.fn(() => Promise.resolve(null))
    const create = vi.fn(() => Promise.resolve(true))
    const baseProps = {
      snapshot: {
        revision: 0,
        activeCampaignId: null,
        campaigns: [],
        trashedCampaigns: []
      },
      status: 'ready' as const,
      error: '',
      busy: false,
      sessionRetry: false,
      retryCatalog: vi.fn(() => Promise.resolve()),
      retrySession: vi.fn(() => Promise.resolve(true)),
      dismiss: vi.fn(),
      completed: vi.fn(),
      create,
      activate: vi.fn(() => Promise.resolve(true)),
      rename: vi.fn(() => Promise.resolve(true)),
      trash: vi.fn(() => Promise.resolve(true)),
      restore: vi.fn(() => Promise.resolve(true)),
      deleteForever: vi.fn(() => Promise.resolve(true)),
      reconcile
    }
    const rendered = render(
      <ModalLayerProvider>
        <CampaignScreen {...baseProps} reconciliationPending={false} />
      </ModalLayerProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: '+ Neue Kampagne' }))
    fireEvent.change(screen.getByLabelText('Kampagnenname'), {
      target: { value: 'Bleibt erhalten' }
    })

    rendered.rerender(
      <ModalLayerProvider>
        <CampaignScreen {...baseProps} reconciliationPending />
      </ModalLayerProvider>
    )

    expect(screen.getByLabelText('Kampagnenname')).toHaveValue(
      'Bleibt erhalten'
    )
    expect(screen.getByLabelText('Kampagnenname')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeDisabled()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.pointerDown(screen.getByRole('presentation'))
    expect(screen.getByRole('dialog', { name: 'Neue Kampagne' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Ergebnis prüfen' }))
    await waitFor(() => expect(reconcile).toHaveBeenCalledOnce())
    expect(create).not.toHaveBeenCalled()
  })

  it('retains the creation popup when recovery publishes the first active Campaign', async () => {
    const common = {
      status: 'ready' as const,
      error: '',
      busy: false,
      sessionRetry: false,
      retryCatalog: vi.fn(() => Promise.resolve()),
      retrySession: vi.fn(() => Promise.resolve(true)),
      anchor: null,
      partySize: 0,
      dismiss: vi.fn(),
      create: vi.fn(() => Promise.resolve(false)),
      activate: vi.fn(() => Promise.resolve(false)),
      rename: vi.fn(() => Promise.resolve(false)),
      trash: vi.fn(() => Promise.resolve(false)),
      restore: vi.fn(() => Promise.resolve(false)),
      deleteForever: vi.fn(() => Promise.resolve(false)),
      reconcile: vi.fn(() => Promise.resolve(null)),
      loadGeneratorPresetApplication: vi.fn(() =>
        Promise.reject(new Error('not used'))
      ),
      onError: vi.fn()
    }
    const rendered = render(
      <ModalLayerProvider>
        <CampaignScreen
          {...common}
          snapshot={{
            revision: 0,
            activeCampaignId: null,
            campaigns: [],
            trashedCampaigns: []
          }}
          reconciliationPending={false}
        />
      </ModalLayerProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: '+ Neue Kampagne' }))
    fireEvent.change(await screen.findByLabelText('Kampagnenname'), {
      target: { value: 'Receipt E2E' }
    })

    rendered.rerender(
      <ModalLayerProvider>
        <CampaignScreen
          {...common}
          snapshot={{
            revision: 1,
            activeCampaignId: campaignId,
            campaigns: [
              {
                id: campaignId,
                name: 'Receipt E2E',
                createdAt: now,
                lastOpenedAt: null
              }
            ],
            trashedCampaigns: []
          }}
          reconciliationPending
        />
      </ModalLayerProvider>
    )

    expect(screen.getByRole('dialog', { name: 'Neue Kampagne' })).toBeVisible()
    expect(screen.getByLabelText('Kampagnenname')).toHaveValue('Receipt E2E')
    expect(
      screen.getByRole('button', { name: 'Ergebnis prüfen' })
    ).toBeVisible()
  })
})
