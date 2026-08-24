// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GeneratorPresetReconciliationPendingError,
  type GeneratorPresetApplicationPort
} from '../../src/renderer/features/workspace/generator-preset-application.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import {
  systemGeneratorPresetId,
  type GeneratorPresetEditorSnapshot
} from '../../src/shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'

vi.mock(
  '../../src/renderer/features/workspace/generator-role-matrix.js',
  () => ({ GeneratorRoleMatrix: () => null })
)
vi.mock(
  '../../src/renderer/features/workspace/generator-difficulty-distribution.js',
  () => ({ GeneratorDifficultyDistribution: () => null })
)
vi.mock(
  '../../src/renderer/features/workspace/generator-composition-rules.js',
  () => ({
    GeneratorCompositionRules: () => null,
    GeneratorRoleCombinations: () => null,
    GeneratorRoleQuantities: () => null
  })
)
vi.mock(
  '../../src/renderer/features/workspace/generator-loot-rules.js',
  () => ({ GeneratorLootRulesEditor: () => null })
)

import { EncounterGeneratorSettings } from '../../src/renderer/features/workspace/encounter-generator-settings.js'

const campaignId = '00000000-0000-4000-8000-000000000010'
const copiedId = '00000000-0000-4000-8000-000000000030'
const now = '2026-08-24T12:00:00.000Z'

afterEach(cleanup)

describe('generator preset receipt reconciliation UI', () => {
  it('locks the editor and reconciles an unknown save without resending it', async () => {
    const before = snapshot()
    const saved = {
      ...before.registry.presets[0]!,
      id: copiedId,
      name: 'Recovered',
      protected: false
    }
    const after = {
      ...before,
      registry: {
        revision: 1,
        presets: [...before.registry.presets, saved]
      }
    }
    const create = vi
      .fn<GeneratorPresetApplicationPort['create']>()
      .mockRejectedValueOnce(
        new GeneratorPresetReconciliationPendingError(copiedId)
      )
    const reconcile = vi.fn<GeneratorPresetApplicationPort['reconcile']>(() =>
      Promise.resolve({
        receipt: {
          kind: 'created',
          commandId: copiedId,
          registry: after.registry,
          saved
        },
        snapshot: after
      })
    )
    const application = applicationStub(before, create, reconcile)
    const onError = vi.fn()

    render(
      <ModalLayerProvider>
        <EncounterGeneratorSettings
          application={application}
          activeCampaignId={campaignId}
          partySize={5}
          onClose={vi.fn()}
          onError={onError}
        />
      </ModalLayerProvider>
    )
    const name = await screen.findByLabelText('Name')
    fireEvent.change(name, { target: { value: 'Recovered' } })
    fireEvent.click(screen.getByRole('button', { name: 'Als Kopie speichern' }))

    expect(
      await screen.findByText(/Speicherergebnis noch unklar/)
    ).toBeInTheDocument()
    expect(name).toBeDisabled()
    expect(
      screen.getAllByRole('button', { name: 'Schließen' })[0]
    ).toBeDisabled()
    expect(create).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', { name: 'Speicherergebnis prüfen' })
    )
    expect(
      await screen.findByText('Speicherergebnis bestätigt.')
    ).toBeInTheDocument()
    expect(reconcile).toHaveBeenCalledOnce()
    expect(create).toHaveBeenCalledOnce()
    expect(name).toBeEnabled()
    expect(name).toHaveValue('Recovered')
  })
})

function applicationStub(
  before: GeneratorPresetEditorSnapshot,
  create: GeneratorPresetApplicationPort['create'],
  reconcile: GeneratorPresetApplicationPort['reconcile']
): GeneratorPresetApplicationPort {
  return {
    read: () => Promise.resolve(before),
    create,
    update: () => Promise.reject(new Error('not used')),
    delete: () => Promise.reject(new Error('not used')),
    assign: () => Promise.reject(new Error('not used')),
    reconciliationPending: () => false,
    reconcile
  }
}

function snapshot(): GeneratorPresetEditorSnapshot {
  return {
    registry: {
      revision: 0,
      presets: [
        {
          id: systemGeneratorPresetId,
          name: 'System-Default',
          schemaVersion: 5,
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
}
