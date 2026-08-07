// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorldLocationDialog } from '../../src/renderer/features/worldplanner/world-location-dialog.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'

const factionId = '01900000-0000-7000-8000-000000000081'
const tableId = '01900000-0000-7000-8000-000000000082'
const ready = {
  status: 'ready' as const,
  factions: [
    {
      id: factionId,
      displayName: 'Hafenwache',
      notes: '',
      disposition: 0,
      primaryEncounterTableId: null,
      position: 0,
      inventory: []
    }
  ],
  tables: [
    {
      id: tableId,
      scope: 'campaign' as const,
      protected: false,
      displayName: 'Küstenbegegnungen',
      description: '',
      position: 0,
      entries: []
    }
  ]
}

afterEach(cleanup)

describe('WorldLocationDialog', () => {
  it('submits a complete normalized draft and guards dirty input', async () => {
    const save = vi.fn().mockResolvedValue({ status: 'saved' })
    const close = vi.fn()
    render(
      <ModalLayerProvider>
        <WorldLocationDialog
          location={null}
          references={ready}
          close={close}
          save={save}
        />
      </ModalLayerProvider>
    )

    const create = screen.getByRole('button', { name: 'Erstellen' })
    expect(create).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Ortsname' }), {
      target: { value: 'Windklippe' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Ortstyp' }), {
      target: { value: 'Leuchtturm' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Ortsregion' }), {
      target: { value: 'Küste' }
    })
    const factions = screen.getByLabelText<HTMLSelectElement>(
      'Verknüpfte Fraktionen'
    )
    factions.options[0]!.selected = true
    fireEvent.change(factions)
    const tables = screen.getByLabelText<HTMLSelectElement>(
      'Direkte Encounter-Tabellen'
    )
    tables.options[0]!.selected = true
    fireEvent.change(tables)
    fireEvent.change(screen.getByRole('textbox', { name: 'Ortsnotizen' }), {
      target: { value: 'Warnt vor den Riffen.' }
    })
    fireEvent.click(create)
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        displayName: 'Windklippe',
        kind: 'Leuchtturm',
        region: 'Küste',
        notes: 'Warnt vor den Riffen.',
        factionIds: [factionId],
        encounterTableIds: [tableId]
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dialog schließen' }))
    expect(
      screen.getByRole('alertdialog', {
        name: 'Ungespeicherte Änderungen verwerfen?'
      })
    ).toBeVisible()
    expect(close).not.toHaveBeenCalled()
  })

  it('owns async busy and inline failure state', async () => {
    let resolve!: (value: { status: 'failed'; message: string }) => void
    const save = vi.fn().mockReturnValue(
      new Promise<{ status: 'failed'; message: string }>((done) => {
        resolve = done
      })
    )
    render(
      <ModalLayerProvider>
        <WorldLocationDialog
          location={null}
          references={ready}
          close={vi.fn()}
          save={save}
        />
      </ModalLayerProvider>
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Ortsname' }), {
      target: { value: 'Kap' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }))
    expect(
      screen.getByRole('dialog', { name: 'Ort erstellen' })
    ).toHaveAttribute('aria-busy', 'true')
    expect(save).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }))
    expect(save).toHaveBeenCalledOnce()

    resolve({ status: 'failed', message: 'Revision veraltet.' })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Revision veraltet.'
    )
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: 'Ort erstellen' })
      ).not.toHaveAttribute('aria-busy')
    )
  })

  it('keeps the draft while references retry after a loading failure', () => {
    const retry = vi.fn()
    render(
      <ModalLayerProvider>
        <WorldLocationDialog
          location={null}
          references={{ status: 'failed', message: 'Nicht geladen', retry }}
          close={vi.fn()}
          save={vi.fn()}
        />
      </ModalLayerProvider>
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Ortsname' }), {
      target: { value: 'Kap' }
    })
    expect(screen.getByRole('button', { name: 'Erstellen' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.getByRole('textbox', { name: 'Ortsname' })).toHaveValue('Kap')
  })
})
