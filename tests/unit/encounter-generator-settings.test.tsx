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
import { EncounterGeneratorSettings } from '../../src/renderer/features/workspace/encounter-generator-settings.js'
import type { GeneratorPresetApplicationPort } from '../../src/renderer/features/workspace/generator-preset-application.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import {
  systemGeneratorPresetId,
  type GeneratorPresetEditorSnapshot
} from '../../src/shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

const campaignId = '00000000-0000-4000-8000-000000000010'
const customId = '00000000-0000-4000-8000-000000000020'
const copiedId = '00000000-0000-4000-8000-000000000030'
const now = '2026-08-08T12:00:00.000Z'

afterEach(cleanup)

function presetHarness(): {
  application: GeneratorPresetApplicationPort
  snapshot: () => GeneratorPresetEditorSnapshot
  createPreset: ReturnType<
    typeof vi.fn<GeneratorPresetApplicationPort['create']>
  >
  assignPreset: ReturnType<
    typeof vi.fn<GeneratorPresetApplicationPort['assign']>
  >
} {
  let snapshot: GeneratorPresetEditorSnapshot = {
    registry: {
      revision: 0,
      presets: [
        {
          id: systemGeneratorPresetId,
          name: 'System-Default',
          schemaVersion: 4,
          revision: 0,
          protected: true,
          createdAt: now,
          updatedAt: now,
          config: structuredClone(defaultGeneratorConfig)
        },
        {
          id: customId,
          name: 'Küstenwache',
          schemaVersion: 4,
          revision: 0,
          protected: false,
          createdAt: now,
          updatedAt: now,
          config: {
            ...structuredClone(defaultGeneratorConfig),
            combat: { mobThreshold: 8 }
          }
        }
      ]
    },
    assignment: {
      campaignId,
      assignedPresetId: null,
      effectivePresetId: systemGeneratorPresetId
    }
  }
  const createPreset = vi.fn<GeneratorPresetApplicationPort['create']>(
    (name, config) => {
      const saved = {
        id: copiedId,
        name,
        schemaVersion: 4 as const,
        revision: 0,
        protected: false,
        createdAt: now,
        updatedAt: now,
        config
      }
      snapshot = {
        ...snapshot,
        registry: {
          revision: snapshot.registry.revision + 1,
          presets: [...snapshot.registry.presets, saved]
        }
      }
      return Promise.resolve({
        receipt: {
          kind: 'created' as const,
          commandId: copiedId,
          registry: snapshot.registry,
          saved
        },
        snapshot
      })
    }
  )
  const assignPreset = vi.fn<GeneratorPresetApplicationPort['assign']>(
    (presetId) => {
      snapshot = {
        ...snapshot,
        registry: {
          ...snapshot.registry,
          revision: snapshot.registry.revision + 1
        },
        assignment: {
          campaignId,
          assignedPresetId: presetId,
          effectivePresetId: presetId ?? systemGeneratorPresetId
        }
      }
      return Promise.resolve({
        receipt: {
          kind: 'assigned' as const,
          commandId: campaignId,
          registry: snapshot.registry,
          assignment: snapshot.assignment!,
          effectivePreset: snapshot.registry.presets.find(
            (preset) => preset.id === snapshot.assignment!.effectivePresetId
          )!
        },
        snapshot
      })
    }
  )
  const application: GeneratorPresetApplicationPort = {
    read: vi.fn<GeneratorPresetApplicationPort['read']>(() =>
      Promise.resolve(snapshot)
    ),
    create: createPreset,
    update: vi.fn<GeneratorPresetApplicationPort['update']>(
      (id, name, config) => {
        let saved = snapshot.registry.presets[0]!
        snapshot = {
          ...snapshot,
          registry: {
            revision: snapshot.registry.revision + 1,
            presets: snapshot.registry.presets.map((preset) => {
              if (preset.id !== id) return preset
              saved = { ...preset, name, config, revision: preset.revision + 1 }
              return saved
            })
          }
        }
        return Promise.resolve({
          receipt: {
            kind: 'updated' as const,
            commandId: customId,
            registry: snapshot.registry,
            saved
          },
          snapshot
        })
      }
    ),
    delete: vi.fn<GeneratorPresetApplicationPort['delete']>((id) => {
      snapshot = {
        ...snapshot,
        registry: {
          revision: snapshot.registry.revision + 1,
          presets: snapshot.registry.presets.filter(
            (preset) => preset.id !== id
          )
        },
        assignment: {
          campaignId,
          assignedPresetId: null,
          effectivePresetId: systemGeneratorPresetId
        }
      }
      return Promise.resolve({
        receipt: {
          kind: 'deleted' as const,
          commandId: customId,
          registry: snapshot.registry,
          deletedId: id,
          affectedCampaignIds: []
        },
        snapshot
      })
    }),
    assign: assignPreset
  }
  return { application, snapshot: () => snapshot, createPreset, assignPreset }
}

function renderSettings() {
  const harness = presetHarness()
  const onClose = vi.fn()
  const result = render(
    <ModalLayerProvider>
      <EncounterGeneratorSettings
        application={harness.application}
        activeCampaignId={campaignId}
        partySize={5}
        onClose={onClose}
        onError={vi.fn()}
      />
    </ModalLayerProvider>
  )
  return { ...result, ...harness, onClose }
}

describe('encounter generator settings editor', () => {
  it('copies the system draft, leaves it unassigned, and assigns only explicitly', async () => {
    const { createPreset, assignPreset, snapshot } = renderSettings()
    const name = await screen.findByLabelText('Name')
    expect(
      screen.getByText(/Geschütztes Systempreset.*aktive Kampagne wirksam/)
    ).toBeInTheDocument()

    fireEvent.change(name, { target: { value: 'Nebelinseln' } })
    expect(
      screen.getByRole('button', { name: 'Für aktive Kampagne zuweisen' })
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Als Kopie speichern' }))

    await waitFor(() =>
      expect(createPreset).toHaveBeenCalledWith(
        'Nebelinseln',
        expect.any(Object)
      )
    )
    expect(snapshot().assignment?.effectivePresetId).toBe(
      systemGeneratorPresetId
    )
    await waitFor(() => expect(name).toHaveValue('Nebelinseln'))
    expect(
      screen.getByText(/Eigenes Preset.*nicht der aktiven Kampagne zugewiesen/)
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Für aktive Kampagne zuweisen' })
    )
    await waitFor(() => expect(assignPreset).toHaveBeenCalledWith(copiedId))
    expect(snapshot().assignment?.effectivePresetId).toBe(copiedId)
  })

  it('guards both preset switching and closing when the draft is dirty', async () => {
    const { onClose } = renderSettings()
    const name = await screen.findByLabelText('Name')
    const preset = screen.getByLabelText('Preset')
    fireEvent.change(name, { target: { value: 'Ungespeichert' } })
    fireEvent.change(preset, { target: { value: customId } })

    expect(
      screen.getByRole('alertdialog', {
        name: 'Ungespeicherte Generator-Änderungen verwerfen?'
      })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }))
    expect(preset).toHaveValue(systemGeneratorPresetId)

    fireEvent.change(preset, { target: { value: customId } })
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }))
    await waitFor(() => expect(preset).toHaveValue(customId))
    expect(name).toHaveValue('Küstenwache')

    fireEvent.change(name, {
      target: { value: 'Noch offen' }
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Schließen' })[0]!)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('dismisses a clean settings dialog through Escape and its backdrop', async () => {
    const { onClose } = renderSettings()
    await screen.findByRole('heading', { name: 'Encounter Generator' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    fireEvent.pointerDown(screen.getByRole('presentation'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('paints and navigates the role matrix with pointer, context menu, and keyboard', async () => {
    const { container } = renderSettings()
    await screen.findByRole('heading', { name: 'Encounter Generator' })
    const brush = container.querySelector<HTMLElement>('.role-brush')!
    fireEvent.click(within(brush).getByRole('button', { name: 'Support' }))
    const first = screen.getByRole('button', {
      name: 'Level 1, CR 0: Minion'
    })
    first.focus()
    fireEvent.keyDown(first, { key: 'Enter' })
    const painted = screen.getByRole('button', {
      name: 'Level 1, CR 0: Support'
    })
    fireEvent.keyDown(painted, { key: 'ArrowRight' })
    expect(document.activeElement).toHaveAttribute('data-matrix-cr', '1')
    fireEvent.contextMenu(painted)
    expect(
      screen.getByRole('button', { name: 'Level 1, CR 0: Nicht verwenden' })
    ).toBeInTheDocument()

    fireEvent.click(within(brush).getByRole('button', { name: 'Elite' }))
    const second = screen.getByRole('button', {
      name: 'Level 1, CR 1/8: Support'
    })
    const third = screen.getByRole('button', {
      name: 'Level 1, CR 1/4: Standard'
    })
    fireEvent.pointerDown(second, { button: 0, pointerId: 1 })
    fireEvent.pointerEnter(third)
    fireEvent.pointerUp(window)
    expect(
      screen.getByRole('button', { name: 'Level 1, CR 1/8: Elite' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Level 1, CR 1/4: Elite' })
    ).toBeInTheDocument()
  })

  it('keeps distributions and ranges coherent and edits role combinations', async () => {
    const { container } = renderSettings()
    await screen.findByRole('heading', { name: 'Encounter Generator' })
    const separator = screen.getByRole('separator', {
      name: 'Grenze Trivial zu Leicht'
    })
    fireEvent.keyDown(separator, { key: 'ArrowRight', shiftKey: true })
    expect(screen.getByText('15 %')).toBeInTheDocument()
    expect(screen.getByText('20 %')).toBeInTheDocument()

    const minionMinimum = screen.getByRole('spinbutton', {
      name: 'Minion Minimum'
    })
    fireEvent.change(minionMinimum, { target: { value: '11' } })
    expect(
      screen.getByRole('spinbutton', { name: 'Minion Maximum' })
    ).toHaveValue(11)
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Minion Maximum' }),
      { target: { value: '2' } }
    )
    expect(minionMinimum).toHaveValue(2)

    fireEvent.change(
      screen.getByRole('spinbutton', {
        name: 'Verschiedene Statblöcke Minimum'
      }),
      { target: { value: '6' } }
    )
    expect(
      screen.getByRole('spinbutton', {
        name: 'Verschiedene Statblöcke Maximum'
      })
    ).toHaveValue(6)
    expect(
      screen.getByText('Bei 5 Spielern: Monster 3–8 · Init-Slots 5–7,5')
    ).toBeInTheDocument()

    const combinations =
      container.querySelector<HTMLElement>('.combination-rules')!
    fireEvent.click(
      within(combinations).getByRole('button', {
        name: 'Kombination Minion entfernen'
      })
    )
    expect(
      within(combinations).getByText('23 Kombinationen')
    ).toBeInTheDocument()
    fireEvent.click(
      within(
        combinations.querySelector<HTMLElement>('.combination-picker')!
      ).getByRole('button', { name: 'Minion' })
    )
    fireEvent.click(
      within(combinations).getByRole('button', { name: 'Hinzufügen' })
    )
    expect(
      within(combinations).getByText('24 Kombinationen')
    ).toBeInTheDocument()
  })

  it('retains a stale draft and requires an explicit conflict choice', async () => {
    const { application, createPreset } = renderSettings()
    const preset = await screen.findByLabelText('Preset')
    fireEvent.change(preset, { target: { value: customId } })
    const name = screen.getByLabelText('Name')
    fireEvent.change(name, { target: { value: 'Lokaler Entwurf' } })
    vi.mocked(application.update).mockRejectedValueOnce(
      new CapabilityError('stale', true)
    )

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(
      await screen.findByText(/Dein Entwurf bleibt erhalten/)
    ).toBeInTheDocument()
    expect(name).toHaveValue('Lokaler Entwurf')
    expect(
      screen.getByRole('button', { name: 'Neueste Version laden' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Als Kopie speichern' }))
    await waitFor(() => expect(createPreset).toHaveBeenCalled())
  })

  it('refreshes stale assignment state and requires another explicit click', async () => {
    const { assignPreset } = renderSettings()
    await screen.findByLabelText('Preset')
    assignPreset.mockRejectedValueOnce(new CapabilityError('stale', true))

    const assign = screen.getByRole('button', {
      name: 'Für aktive Kampagne zuweisen'
    })
    fireEvent.click(assign)

    expect(
      await screen.findByText(/Aktion erneut bestätigen/)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Neueste Version laden' })
    ).not.toBeInTheDocument()
    expect(assignPreset).toHaveBeenCalledOnce()

    fireEvent.click(assign)
    await waitFor(() => expect(assignPreset).toHaveBeenCalledTimes(2))
  })

  it('refreshes stale delete state without retrying automatically', async () => {
    const { application } = renderSettings()
    fireEvent.change(await screen.findByLabelText('Preset'), {
      target: { value: customId }
    })
    vi.mocked(application.delete).mockRejectedValueOnce(
      new CapabilityError('stale', true)
    )

    const remove = screen.getByRole('button', { name: 'Löschen' })
    fireEvent.click(remove)

    expect(
      await screen.findByText(/Aktion erneut bestätigen/)
    ).toBeInTheDocument()
    expect(application.delete).toHaveBeenCalledOnce()
    fireEvent.click(remove)
    await waitFor(() => expect(application.delete).toHaveBeenCalledTimes(2))
  })

  it('supports pointer dragging on difficulty separators', async () => {
    const { container } = renderSettings()
    await screen.findByRole('heading', { name: 'Encounter Generator' })
    const bar = container.querySelector<HTMLElement>('.difficulty-bar')!
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue({
      width: 100,
      height: 20,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 20,
      toJSON: () => ({})
    })
    const separator = screen.getByRole('separator', {
      name: 'Grenze Trivial zu Leicht'
    })
    fireEvent.pointerDown(separator, {
      button: 0,
      pointerId: 7,
      clientX: 10
    })
    fireEvent.pointerMove(separator, { pointerId: 7, clientX: 15 })
    fireEvent.pointerUp(separator, { pointerId: 7 })

    expect(screen.getByText('15 %')).toBeInTheDocument()
    expect(screen.getByText('20 %')).toBeInTheDocument()
  })
})
