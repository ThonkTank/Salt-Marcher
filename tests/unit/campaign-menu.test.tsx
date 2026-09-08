// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CampaignMenu } from '../../src/renderer/features/workspace/campaign-menu.js'
import { createGeneratorPresetApplicationOwner } from '../../src/renderer/features/workspace/generator-preset-application.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import type { GeneratorPresetCapability } from '../../src/shared/contracts/capability-api.js'
import { systemGeneratorPresetId } from '../../src/shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'

const campaignId = '00000000-0000-4000-8000-000000000010'
const now = '2026-08-08T12:00:00.000Z'

afterEach(cleanup)

function capability(): GeneratorPresetCapability {
  const snapshot = {
    registry: {
      revision: 0,
      presets: [
        {
          id: systemGeneratorPresetId,
          name: 'System-Default',
          schemaVersion: 5 as const,
          revision: 0,
          protected: true,
          createdAt: now,
          updatedAt: now,
          config: defaultGeneratorConfig
        }
      ]
    },
    assignment: {
      campaignId,
      assignedPresetId: null,
      effectivePresetId: systemGeneratorPresetId
    }
  }
  return {
    readEditor: vi.fn(() => Promise.resolve(snapshot)),
    create: vi.fn(() => Promise.reject(new Error('not used'))),
    update: vi.fn(() => Promise.reject(new Error('not used'))),
    delete: vi.fn(() => Promise.reject(new Error('not used'))),
    assign: vi.fn(() => Promise.reject(new Error('not used'))),
    commandReceipt: vi.fn(() => Promise.resolve(null))
  }
}

describe('campaign burger menu redesign', () => {
  it('keeps the dropdown minimal and opens the dedicated settings dialog', async () => {
    render(
      <ModalLayerProvider>
        <CampaignMenu
          snapshot={{
            revision: 1,
            activeCampaignId: campaignId,
            campaigns: [
              {
                lastOpenedAt: null,
                id: campaignId,
                name: 'Salzmarsch',
                createdAt: now
              }
            ],
            trashedCampaigns: []
          }}
          open
          anchor={document.body}
          showCampaigns={vi.fn()}
          partySize={5}
          dismiss={vi.fn()}
          loadGeneratorPresetApplication={() =>
            Promise.resolve(
              createGeneratorPresetApplicationOwner(capability()).port(
                campaignId
              )
            )
          }
          onError={vi.fn()}
        />
      </ModalLayerProvider>
    )

    const menu = screen.getByLabelText('Menü')
    expect(menu.querySelectorAll(':scope > button')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }))

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Encounter Generator' },
        { timeout: 10_000 }
      )
    ).toBeInTheDocument()
    expect(screen.getByText('CR-Blöcke je Encounter')).toBeInTheDocument()
    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: /Level 1, CR 0: Minion/ })
        ).toBeInTheDocument(),
      { timeout: 10_000 }
    )
  })
})
