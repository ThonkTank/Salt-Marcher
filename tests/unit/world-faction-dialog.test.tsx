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
import { useState, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Creature } from '../../src/shared/contracts/encounter.js'
import type {
  EncounterTable,
  EncounterTableMutationReceipt,
  EncounterTableSnapshot,
  WorldFactionDraft
} from '../../src/shared/contracts/encounter-source.js'
import type { CreatureCapabilityPort } from '../../src/renderer/features/creatures/creatures-capabilities.js'
import { WorldFactionDialog } from '../../src/renderer/features/worldplanner/world-faction-dialog.js'
import type {
  WorldFactionEditorRenderProps,
  WorldFactionSaveResult
} from '../../src/renderer/features/worldplanner/world-faction-editor-types.js'
import { ModalDialog } from '../../src/renderer/shell/modal-dialog.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'

const wolf = {
  id: 'wolf',
  name: 'Wolf',
  challengeRating: '1/4',
  biomes: ['Wald']
} as Creature
const tableId = '01900000-0000-7000-8000-000000000111'
const createdTableId = '01900000-0000-7000-8000-000000000112'
const secondTableId = '01900000-0000-7000-8000-000000000114'
const baseTable = {
  id: tableId,
  scope: 'campaign' as const,
  protected: false,
  displayName: 'Waldpatrouille',
  description: '',
  position: 0,
  entries: [{ creatureId: 'wolf', weight: 1, position: 0 }]
}
const tables = tableSnapshot([baseTable])

afterEach(cleanup)

describe('WorldFactionDialog', () => {
  it.each([
    ['catalog' as const, 'Katalog › Fraktionen', 'Erstellen'],
    [
      'location-link' as const,
      'World Planner › Orte › Ort erstellen',
      'Erstellen und verknüpfen'
    ]
  ])(
    'derives the %s breadcrumb and create action from its invocation',
    (kind, breadcrumb, action) => {
      renderFaction({ invocation: { kind } })
      expect(screen.getByText(breadcrumb)).toBeVisible()
      expect(screen.getByRole('button', { name: action })).toBeVisible()
    }
  )

  it('uses named disposition bands and keeps table creation stacked', async () => {
    const save = vi.fn().mockResolvedValue({
      snapshot: { revision: 1, factions: [] },
      saved: {
        id: '01900000-0000-7000-8000-000000000113',
        displayName: 'Bund',
        notes: '',
        disposition: 13,
        primaryEncounterTableId: createdTableId,
        position: 0,
        inventory: []
      }
    })
    const detail = vi.fn().mockResolvedValue(wolf)
    const creaturePort = {
      detail
    } as unknown as CreatureCapabilityPort
    render(
      <ModalLayerProvider>
        <TestWorldFactionDialog
          faction={null}
          tableSnapshot={tables}
          close={vi.fn()}
          save={save}
          saved={vi.fn()}
          onError={vi.fn()}
          inspect={vi.fn()}
          creatures={creaturePort}
          invocation={{ kind: 'catalog' }}
          tableCreator={(child) => (
            <ModalDialog
              className="table-child"
              ariaLabel="Tabelle erstellen"
              onClose={child.close}
            >
              <button
                onClick={() =>
                  child.saved({
                    saved: {
                      ...baseTable,
                      id: createdTableId,
                      displayName: 'Neue Tabelle',
                      position: 1
                    },
                    snapshot: tableSnapshot(
                      [
                        ...tables.campaign.tables,
                        {
                          ...baseTable,
                          id: createdTableId,
                          displayName: 'Neue Tabelle',
                          position: 1
                        }
                      ],
                      2
                    )
                  })
                }
              >
                Tabelle übernehmen
              </button>
            </ModalDialog>
          )}
        />
      </ModalLayerProvider>
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Fraktionsname' }), {
      target: { value: 'Bund' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Wohlgesonnen' }))
    expect(
      screen.getByRole('slider', { name: 'Fraktionsgesinnung' })
    ).toHaveValue('13')

    fireEvent.click(
      screen.getByRole('button', { name: /Keine primäre Tabelle/ })
    )
    expect(detail).not.toHaveBeenCalled()
    expect(screen.getByText(/1 Einträge · CR 1\/4/)).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'Neue Encounter-Tabelle' })
    )
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Tabelle übernehmen' }))
    expect(screen.getByRole('button', { name: /Neue Tabelle/ })).toBeVisible()
    await waitFor(() => expect(detail).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Bund',
          disposition: 13,
          primaryEncounterTableId: createdTableId
        })
      )
    )
  })

  it('uses every exact disposition band, click value and live boundary label', () => {
    renderFaction()
    const slider = screen.getByRole('slider', {
      name: 'Fraktionsgesinnung'
    })
    const bands = [
      { label: 'Feindselig', pick: -35, boundaries: [-50, -21] },
      { label: 'Misstrauisch', pick: -13, boundaries: [-20, -6] },
      { label: 'Neutral', pick: 0, boundaries: [-5, 5] },
      { label: 'Wohlgesonnen', pick: 13, boundaries: [6, 20] },
      { label: 'Verbündet', pick: 35, boundaries: [21, 50] }
    ]

    for (const band of bands) {
      fireEvent.click(screen.getByRole('button', { name: band.label }))
      expect(slider).toHaveValue(String(band.pick))
      for (const boundary of band.boundaries) {
        fireEvent.change(slider, { target: { value: String(boundary) } })
        expect(
          screen.getByText(`${band.label} · ${String(boundary)}`)
        ).toBeVisible()
        expect(
          screen.getByRole('button', { name: band.label })
        ).toHaveAttribute('aria-pressed', 'true')
      }
    }
  })

  it('prunes only stock missing from a newly selected primary table', async () => {
    const save = vi.fn().mockResolvedValue(saveResult())
    const snapshot = tableSnapshot([
      {
        ...baseTable,
        entries: [
          { creatureId: 'wolf', weight: 1, position: 0 },
          { creatureId: 'bear', weight: 1, position: 1 }
        ]
      },
      {
        ...baseTable,
        id: secondTableId,
        displayName: 'Neue Auswahl',
        position: 1,
        entries: [
          { creatureId: 'wolf', weight: 1, position: 0 },
          { creatureId: 'cat', weight: 1, position: 1 }
        ]
      }
    ])
    renderFaction({
      faction: faction({
        primaryEncounterTableId: tableId,
        inventory: [
          { creatureId: 'wolf', maximum: 4 },
          { creatureId: 'bear', maximum: 2 }
        ]
      }),
      snapshot,
      save,
      detail: vi.fn((id: string) =>
        Promise.resolve(
          creature(id, id === 'bear' ? 'Bär' : id === 'cat' ? 'Katze' : 'Wolf')
        )
      )
    })

    await screen.findByRole('spinbutton', { name: 'Maximum Wolf' })
    fireEvent.click(screen.getByRole('button', { name: /Waldpatrouille/ }))
    fireEvent.click(screen.getByRole('option', { name: /Neue Auswahl/ }))
    expect(
      screen.getByRole('spinbutton', { name: 'Maximum Wolf' })
    ).toHaveValue(4)
    expect(
      screen.queryByRole('spinbutton', { name: 'Maximum Bär' })
    ).not.toBeInTheDocument()
    expect(
      await screen.findByRole('spinbutton', { name: 'Maximum Katze' })
    ).toHaveValue(null)

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryEncounterTableId: secondTableId,
          inventory: [{ creatureId: 'wolf', maximum: 4 }]
        })
      )
    )

    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled()
  })

  it('reconciles a created table before pruning stock and selects it once', async () => {
    const createdTable = {
      ...baseTable,
      id: createdTableId,
      displayName: 'Neue Wolfstabelle',
      position: 1
    }
    const createdSnapshot = tableSnapshot(
      [
        ...tables.campaign.tables,
        {
          ...createdTable
        }
      ],
      2
    )
    renderFaction({
      faction: faction({
        primaryEncounterTableId: tableId,
        inventory: [{ creatureId: 'wolf', maximum: 4 }]
      }),
      tableCreator: (child) => (
        <ModalDialog
          className="table-child"
          ariaLabel="Tabelle erstellen"
          onClose={child.close}
        >
          <button
            onClick={() =>
              child.saved({
                snapshot: createdSnapshot,
                saved: createdTable
              })
            }
          >
            Neue Tabelle übernehmen
          </button>
        </ModalDialog>
      )
    })

    await screen.findByRole('spinbutton', { name: 'Maximum Wolf' })
    fireEvent.click(screen.getByRole('button', { name: /Waldpatrouille/ }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Neue Encounter-Tabelle' })
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Neue Tabelle übernehmen' })
    )

    expect(
      screen.getByRole('button', { name: /Neue Wolfstabelle/ })
    ).toBeVisible()
    expect(
      screen.getByRole('spinbutton', { name: 'Maximum Wolf' })
    ).toHaveValue(4)
  })

  it('opens statblocks from both monster name and CR and keeps failed facts visible', async () => {
    const inspect = vi.fn()
    renderFaction({
      faction: faction({ primaryEncounterTableId: tableId }),
      inspect
    })

    const name = await screen.findByRole('button', { name: 'Wolf' })
    const rating = screen.getByRole('button', { name: 'CR 1/4' })
    fireEvent.click(name)
    fireEvent.click(rating)
    expect(inspect).toHaveBeenNthCalledWith(1, wolf)
    expect(inspect).toHaveBeenNthCalledWith(2, wolf)

    cleanup()
    const retryingDetail = vi
      .fn()
      .mockRejectedValueOnce(new Error('missing'))
      .mockResolvedValueOnce(wolf)
    renderFaction({
      faction: faction({ primaryEncounterTableId: tableId }),
      detail: retryingDetail
    })
    expect(await screen.findByText(`Nicht verfügbar (wolf)`)).toBeVisible()
    expect(screen.getByText('CR —')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByRole('button', { name: 'Wolf' })).toBeVisible()
    expect(retryingDetail).toHaveBeenCalledTimes(2)
  })

  it('loads only the active table facts and never more than eight concurrently', async () => {
    const ids = Array.from(
      { length: 10 },
      (_, index) => `creature-${String(index)}`
    )
    const releases: Array<() => void> = []
    let concurrent = 0
    let maximumConcurrent = 0
    const detail = vi.fn(
      (id: string) =>
        new Promise<Creature>((resolve) => {
          concurrent += 1
          maximumConcurrent = Math.max(maximumConcurrent, concurrent)
          releases.push(() => {
            concurrent -= 1
            resolve(creature(id, id))
          })
        })
    )
    const entries = ids.map((creatureId, position) => ({
      creatureId,
      weight: 1,
      position
    }))
    renderFaction({
      faction: faction({ primaryEncounterTableId: tableId }),
      snapshot: tableSnapshot([
        { ...baseTable, entries },
        {
          ...baseTable,
          id: secondTableId,
          position: 1,
          entries
        }
      ]),
      detail
    })

    await waitFor(() => expect(detail).toHaveBeenCalledTimes(8))
    expect(maximumConcurrent).toBe(8)
    act(() => {
      releases.splice(0, 8).forEach((release) => release())
    })
    await waitFor(() => expect(detail).toHaveBeenCalledTimes(10))
    act(() => {
      releases.splice(0).forEach((release) => release())
    })
    expect(new Set(detail.mock.calls.map(([id]) => id))).toEqual(new Set(ids))
    expect(maximumConcurrent).toBe(8)
  })

  it('drops queued facts when the selected primary table changes', async () => {
    const oldIds = Array.from(
      { length: 10 },
      (_, index) => `old-creature-${String(index)}`
    )
    const newId = 'new-creature'
    const releases: Array<() => void> = []
    const detail = vi.fn(
      (id: string) =>
        new Promise<Creature>((resolve) => {
          releases.push(() => resolve(creature(id, id)))
        })
    )
    renderFaction({
      faction: faction({ primaryEncounterTableId: tableId }),
      snapshot: tableSnapshot([
        {
          ...baseTable,
          entries: oldIds.map((creatureId, position) => ({
            creatureId,
            weight: 1,
            position
          }))
        },
        {
          ...baseTable,
          id: secondTableId,
          displayName: 'Nur neue Kreatur',
          position: 1,
          entries: [{ creatureId: newId, weight: 1, position: 0 }]
        }
      ]),
      detail
    })

    await waitFor(() => expect(detail).toHaveBeenCalledTimes(8))
    fireEvent.click(screen.getByRole('button', { name: /Waldpatrouille/ }))
    fireEvent.click(screen.getByRole('option', { name: /Nur neue Kreatur/ }))
    act(() => {
      releases.splice(0, 8).forEach((release) => release())
    })

    await waitFor(() => expect(detail).toHaveBeenCalledWith(newId))
    expect(detail).not.toHaveBeenCalledWith('old-creature-8')
    expect(detail).not.toHaveBeenCalledWith('old-creature-9')
    act(() => {
      releases.splice(0).forEach((release) => release())
    })
  })

  it('treats empty stock as unlimited and normalizes numbers to nonnegative integers', async () => {
    const save = vi.fn().mockResolvedValue(saveResult())
    renderFaction({
      faction: faction({
        primaryEncounterTableId: tableId,
        inventory: [{ creatureId: 'wolf', maximum: 4 }]
      }),
      save
    })
    const maximum = await screen.findByRole('spinbutton', {
      name: 'Maximum Wolf'
    })
    fireEvent.change(maximum, { target: { value: '-4' } })
    expect(maximum).toHaveValue(0)
    fireEvent.change(maximum, { target: { value: '' } })
    expect(maximum).toHaveValue(null)
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ inventory: [] })
      )
    )
  })

  it('keeps the complete draft and top dialog after a failed save', async () => {
    renderFaction({
      save: vi.fn().mockRejectedValue(new Error('mutation failed'))
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Fraktionsname' }), {
      target: { value: 'Fehlerfester Bund' }
    })
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Fraktionsnotizen' }),
      {
        target: { value: 'Darf nicht verschwinden.' }
      }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }))

    await screen.findByRole('alert')
    expect(screen.getByRole('textbox', { name: 'Fraktionsname' })).toHaveValue(
      'Fehlerfester Bund'
    )
    expect(
      screen.getByRole('textbox', { name: 'Fraktionsnotizen' })
    ).toHaveValue('Darf nicht verschwinden.')
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })
})

function renderFaction(
  options: {
    faction?: ReturnType<typeof faction> | null
    snapshot?: EncounterTableSnapshot
    save?: (draft: WorldFactionDraft) => Promise<WorldFactionSaveResult>
    detail?: (id: string) => Promise<Creature>
    inspect?: (creature: Creature) => void
    tableCreator?: TableCreator
    invocation?: WorldFactionEditorRenderProps['invocation']
  } = {}
) {
  const detail = options.detail ?? vi.fn().mockResolvedValue(wolf)
  render(
    <ModalLayerProvider>
      <TestWorldFactionDialog
        faction={options.faction ?? null}
        tableSnapshot={options.snapshot ?? tables}
        close={vi.fn()}
        save={options.save ?? vi.fn().mockResolvedValue(saveResult())}
        saved={vi.fn()}
        onError={vi.fn()}
        inspect={options.inspect ?? vi.fn()}
        creatures={{ detail } as unknown as CreatureCapabilityPort}
        {...(options.tableCreator
          ? { tableCreator: options.tableCreator }
          : {})}
        invocation={options.invocation ?? { kind: 'catalog' }}
      />
    </ModalLayerProvider>
  )
}

type TableCreator = (child: {
  close: () => void
  saved: (result: EncounterTableMutationReceipt) => void
}) => ReactNode

function TestWorldFactionDialog(
  props: Omit<WorldFactionEditorRenderProps, 'requestTableCreation'> & {
    tableCreator?: TableCreator
  }
) {
  const { tableCreator, ...dialogProps } = props
  const [created, setCreated] = useState<
    ((result: EncounterTableMutationReceipt) => void) | null
  >(null)
  const close = () => setCreated(null)
  return (
    <>
      <WorldFactionDialog
        {...dialogProps}
        requestTableCreation={(next) => setCreated(() => next)}
      />
      {created &&
        tableCreator?.({
          close,
          saved: (result) => {
            created(result)
            close()
          }
        })}
    </>
  )
}

function faction(overrides: Record<string, unknown> = {}) {
  return {
    id: '01900000-0000-7000-8000-000000000113',
    displayName: 'Bund',
    notes: '',
    disposition: 0,
    primaryEncounterTableId: null,
    position: 0,
    inventory: [],
    ...overrides
  }
}

function creature(id: string, name: string): Creature {
  return {
    ...wolf,
    id,
    name
  }
}

function saveResult() {
  return {
    snapshot: { revision: 1, factions: [] },
    saved: faction()
  }
}

function tableSnapshot(
  rows: readonly EncounterTable[],
  revision = 1
): EncounterTableSnapshot {
  return {
    installation: { revision: 0, tables: [], summaries: [] },
    campaign: {
      revision,
      tables: [...rows],
      summaries: rows.map((table) => ({
        id: table.id,
        scope: table.scope,
        displayName: table.displayName,
        entryCount: table.entries.length,
        challengeRatingRange:
          table.entries.length > 0 ? { minimum: '1/4', maximum: '1/4' } : null,
        biomes: table.entries.length > 0 ? ['Wald'] : []
      }))
    }
  }
}
