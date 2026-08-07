// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WorldLocationDialog,
  type WorldLocationDialogProps
} from '../../src/renderer/features/worldplanner/world-location-dialog.js'
import { WorldFactionDialog } from '../../src/renderer/features/worldplanner/world-faction-dialog.js'
import type { CreatureCapabilityPort } from '../../src/renderer/features/creatures/creatures-capabilities.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import type { WorldLocation } from '../../src/shared/contracts/world-location.js'
import type {
  EncounterTable,
  WorldFaction
} from '../../src/shared/contracts/encounter-source.js'
import { ModalDialog } from '../../src/renderer/shell/modal-dialog.js'

const factionId = '01900000-0000-7000-8000-000000000081'
const tableId = '01900000-0000-7000-8000-000000000082'
const ready = {
  factions: {
    status: 'ready' as const,
    value: [
      {
        id: factionId,
        displayName: 'Hafenwache',
        notes: '',
        disposition: 0,
        primaryEncounterTableId: null,
        position: 0,
        inventory: []
      }
    ]
  },
  tables: {
    status: 'ready' as const,
    value: [
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
}
const knownLocation = {
  id: '01900000-0000-7000-8000-000000000083',
  displayName: 'Alte Feste',
  tags: ['Ruine', 'Küste'],
  readAloud: '',
  notes: '',
  position: 0,
  factionIds: [],
  encounterTableIds: [],
  mapPresentation: {
    revision: 0,
    titleOverride: null,
    symbolId: 'location',
    symbolSize: 44,
    labelCurve: 0,
    labelPosition: 'below'
  }
} satisfies WorldLocation

afterEach(cleanup)

const suggestTags = (query: string) =>
  Promise.resolve(
    knownLocation.tags.filter((tag) =>
      tag.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    )
  )

function addTag(value: string) {
  const input = screen.getByRole('combobox', { name: 'Tags' })
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('WorldLocationDialog', () => {
  it('creates tags, suggests campaign tags and submits the complete draft', async () => {
    const save = vi.fn().mockResolvedValue({ status: 'saved' })
    const close = vi.fn()
    render(
      <ModalLayerProvider>
        <TestWorldLocationDialog
          location={null}
          references={ready}
          suggestTags={suggestTags}
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
    expect(create).toBeDisabled()

    const tagInput = screen.getByRole('combobox', { name: 'Tags' })
    fireEvent.change(tagInput, { target: { value: 'Rui' } })
    expect(
      await screen.findByRole('option', { name: /Ruine.*vorhanden/ })
    ).toBeVisible()
    fireEvent.click(screen.getByRole('option', { name: /Ruine.*vorhanden/ }))
    addTag('Leuchtturm')

    fireEvent.change(screen.getByRole('textbox', { name: 'Vorlesetext' }), {
      target: { value: 'Weiße Gischt schlägt an die Klippe.' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'GM-Notizen' }), {
      target: { value: 'Warnt vor den Riffen.' }
    })
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Fraktion suchen …' }),
      { target: { value: 'Hafen' } }
    )
    fireEvent.click(screen.getByRole('option', { name: 'Hafenwache' }))
    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Encounter-Tabelle suchen …'
      }),
      { target: { value: 'Küste' } }
    )
    fireEvent.click(screen.getByRole('option', { name: 'Küstenbegegnungen' }))
    fireEvent.click(create)
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        displayName: 'Windklippe',
        tags: ['Ruine', 'Leuchtturm'],
        readAloud: 'Weiße Gischt schlägt an die Klippe.',
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
        <TestWorldLocationDialog
          location={null}
          references={ready}
          suggestTags={suggestTags}
          close={vi.fn()}
          save={save}
        />
      </ModalLayerProvider>
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Ortsname' }), {
      target: { value: 'Kap' }
    })
    addTag('Küste')
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

  it('keeps the draft and allows base saving while references retry', () => {
    const retry = vi.fn()
    render(
      <ModalLayerProvider>
        <WorldLocationDialog
          location={null}
          references={{
            factions: { status: 'failed', message: 'Nicht geladen', retry },
            tables: { status: 'ready', value: [] }
          }}
          suggestTags={suggestTags}
          close={vi.fn()}
          save={vi.fn().mockResolvedValue({ status: 'saved' })}
        />
      </ModalLayerProvider>
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Ortsname' }), {
      target: { value: 'Kap' }
    })
    addTag('Küste')
    expect(screen.getByRole('button', { name: 'Erstellen' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.getByRole('textbox', { name: 'Ortsname' })).toHaveValue('Kap')
  })

  it('keeps base fields saveable when bounded tag suggestions fail', async () => {
    const suggest = vi
      .fn()
      .mockRejectedValueOnce(new Error('tag index offline'))
      .mockResolvedValueOnce([])
    render(
      <ModalLayerProvider>
        <WorldLocationDialog
          location={null}
          references={ready}
          suggestTags={suggest}
          close={vi.fn()}
          save={vi.fn().mockResolvedValue({ status: 'saved' })}
        />
      </ModalLayerProvider>
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Ortsname' }), {
      target: { value: 'Kap' }
    })
    const tags = screen.getByRole('combobox', { name: 'Tags' })
    fireEvent.change(tags, { target: { value: 'Küste' } })
    expect(tags).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByText(/Tag-Vorschläge/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    await waitFor(() => expect(suggest).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('textbox', { name: 'Ortsname' })).toHaveValue('Kap')
    fireEvent.keyDown(tags, { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Erstellen' })).toBeEnabled()
  })

  it('creates and links related records without resetting the location draft', () => {
    const newFaction = {
      id: '01900000-0000-7000-8000-000000000091',
      displayName: 'Klippenbund',
      notes: '',
      disposition: 0,
      primaryEncounterTableId: null,
      position: 1,
      inventory: []
    }
    const newTable = {
      id: '01900000-0000-7000-8000-000000000092',
      scope: 'campaign' as const,
      protected: false,
      displayName: 'Klippenbegegnungen',
      description: '',
      position: 1,
      entries: [{ creatureId: 'wolf', weight: 1, position: 0 }]
    }
    render(
      <ModalLayerProvider>
        <TestWorldLocationDialog
          location={null}
          references={ready}
          suggestTags={suggestTags}
          close={vi.fn()}
          save={vi.fn().mockResolvedValue({ status: 'saved' })}
          factionCreator={(child) => (
            <ModalDialog
              className="child"
              ariaLabel="Fraktion erstellen"
              onClose={child.close}
            >
              <button onClick={() => child.created(newFaction)}>
                Fraktion übernehmen
              </button>
            </ModalDialog>
          )}
          tableCreator={(child) => (
            <ModalDialog
              className="child"
              ariaLabel="Tabelle erstellen"
              onClose={child.close}
            >
              <button onClick={() => child.created(newTable)}>
                Tabelle übernehmen
              </button>
            </ModalDialog>
          )}
        />
      </ModalLayerProvider>
    )
    const name = screen.getByRole('textbox', { name: 'Ortsname' })
    fireEvent.change(name, { target: { value: 'Windklippe' } })
    addTag('Küste')

    fireEvent.click(screen.getByRole('button', { name: 'Neue Fraktion' }))
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Fraktion übernehmen' }))
    expect(name).toHaveValue('Windklippe')
    expect(screen.getByText('Klippenbund')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Neue Tabelle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tabelle übernehmen' }))
    expect(name).toHaveValue('Windklippe')
    expect(screen.getByText('Klippenbegegnungen')).toBeVisible()
  })

  it('keeps both drafts and the failed child as the top dialog after a nested mutation error', async () => {
    render(
      <ModalLayerProvider>
        <TestWorldLocationDialog
          location={null}
          references={ready}
          suggestTags={suggestTags}
          close={vi.fn()}
          save={vi.fn().mockResolvedValue({ status: 'saved' })}
          factionCreator={(child) => (
            <WorldFactionDialog
              faction={null}
              tableSnapshot={{
                installation: { revision: 0, tables: [], summaries: [] },
                campaign: { revision: 0, tables: [], summaries: [] }
              }}
              close={child.close}
              save={vi
                .fn()
                .mockRejectedValue(new Error('nested mutation failed'))}
              saved={(result) => child.created(result.saved)}
              requestTableCreation={() => undefined}
              onError={vi.fn()}
              inspect={vi.fn()}
              creatures={
                { detail: vi.fn() } as unknown as CreatureCapabilityPort
              }
              invocation={{ kind: 'location-link' }}
            />
          )}
        />
      </ModalLayerProvider>
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Ortsname' }), {
      target: { value: 'Windklippe' }
    })
    addTag('Küste')
    fireEvent.change(screen.getByRole('textbox', { name: 'GM-Notizen' }), {
      target: { value: 'Elternentwurf bleibt.' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Neue Fraktion' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Fraktionsname' }), {
      target: { value: 'Fehlerbund' }
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Erstellen und verknüpfen' })
    )

    await screen.findByRole('alert')
    expect(
      screen.getByRole('dialog', { name: 'Fraktion erstellen' })
    ).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('textbox', { name: 'Fraktionsname' })).toHaveValue(
      'Fehlerbund'
    )
    expect(
      screen.getByRole('textbox', { name: 'Ortsname', hidden: true })
    ).toHaveValue('Windklippe')
    expect(
      screen.getByRole('textbox', { name: 'GM-Notizen', hidden: true })
    ).toHaveValue('Elternentwurf bleibt.')
  })
})

type RelatedCreator<T> = (child: {
  close: () => void
  created: (value: T) => void
}) => ReactNode

function TestWorldLocationDialog(
  props: Omit<WorldLocationDialogProps, 'relatedCreation'> & {
    factionCreator?: RelatedCreator<WorldFaction>
    tableCreator?: RelatedCreator<EncounterTable>
  }
) {
  const { factionCreator, tableCreator, ...dialogProps } = props
  const [factionCreated, setFactionCreated] = useState<
    ((value: WorldFaction) => void) | null
  >(null)
  const [tableCreated, setTableCreated] = useState<
    ((value: EncounterTable) => void) | null
  >(null)
  const closeFaction = () => setFactionCreated(null)
  const closeTable = () => setTableCreated(null)
  return (
    <>
      <WorldLocationDialog
        {...dialogProps}
        relatedCreation={{
          requestFactionCreation: (created) => setFactionCreated(() => created),
          requestTableCreation: (created) => setTableCreated(() => created)
        }}
      />
      {factionCreated &&
        factionCreator?.({
          close: closeFaction,
          created: (value) => {
            factionCreated(value)
            closeFaction()
          }
        })}
      {tableCreated &&
        tableCreator?.({
          close: closeTable,
          created: (value) => {
            tableCreated(value)
            closeTable()
          }
        })}
    </>
  )
}
