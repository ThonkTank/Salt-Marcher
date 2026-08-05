// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CreatureCapabilityPort } from '../../src/renderer/features/creatures/creatures-capabilities.js'
import { EncounterTableManager } from '../../src/renderer/features/encounter-table/encounter-table-manager.js'
import type { EncounterTableSaveResult } from '../../src/renderer/features/encounter-table/encounter-table-manager.js'
import type { Creature } from '../../src/shared/contracts/encounter.js'
import type {
  EncounterTable,
  EncounterTableDraft,
  EncounterTableSnapshot
} from '../../src/shared/contracts/encounter-source.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'

const wolf = {
  id: 'wolf',
  name: 'Wolf'
} as Creature

const table = {
  id: '01900000-0000-7000-8000-000000000001',
  displayName: 'Küste',
  description: 'Salzige Begegnungen',
  position: 0,
  entries: [{ creatureId: 'wolf', weight: 3, position: 0 }]
} as EncounterTable

const snapshot = { revision: 2, tables: [table] } as EncounterTableSnapshot

function creaturePort(
  detail: (creatureId: string) => Promise<Creature> = () =>
    Promise.resolve(wolf)
) {
  return {
    search: vi.fn().mockResolvedValue({
      status: 'ready',
      rows: [],
      total: 0,
      offset: 0,
      limit: 30,
      message: ''
    }),
    filterOptions: vi.fn().mockResolvedValue({
      challengeRatings: [],
      sizes: [],
      types: [],
      subtypes: [],
      biomes: [],
      alignments: [],
      encounterTables: [],
      factions: [],
      locations: []
    }),
    detail
  } as unknown as CreatureCapabilityPort
}

function renderManager(props?: {
  save?: (
    table: EncounterTable | null,
    draft: EncounterTableDraft
  ) => Promise<EncounterTableSaveResult>
  saved?: (snapshot: EncounterTableSnapshot, savedTableId: string) => void
  detail?: (creatureId: string) => Promise<Creature>
}) {
  const save =
    props?.save ??
    vi.fn().mockResolvedValue({ snapshot, savedTableId: table.id })
  const saved = props?.saved ?? vi.fn()
  const detail = props?.detail ?? vi.fn().mockResolvedValue(wolf)
  render(
    <ModalLayerProvider>
      <EncounterTableManager
        table={table}
        tables={[table]}
        close={vi.fn()}
        select={vi.fn()}
        save={save}
        saved={saved}
        onError={vi.fn()}
        inspect={vi.fn()}
        creaturePort={creaturePort(detail)}
      />
    </ModalLayerProvider>
  )
  return { save, saved, detail }
}

describe('EncounterTableManager', () => {
  afterEach(cleanup)

  it('publishes the saved snapshot and blocks duplicate save clicks', async () => {
    let resolveSave!: (value: {
      snapshot: EncounterTableSnapshot
      savedTableId: string
    }) => void
    const save = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve
      })
    )
    const saved = vi.fn()
    renderManager({ save, saved })

    const saveButton = screen.getByRole('button', { name: 'Speichern' })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)
    expect(save).toHaveBeenCalledOnce()
    expect(saveButton).toBeDisabled()

    resolveSave({ snapshot, savedTableId: table.id })
    await waitFor(() => expect(saved).toHaveBeenCalledWith(snapshot, table.id))
  })

  it('keeps the draft open and reports a local save error', async () => {
    const save = vi.fn().mockRejectedValue(new Error('conflict'))
    renderManager({ save })
    fireEvent.change(screen.getByRole('textbox', { name: 'Tabellenname' }), {
      target: { value: 'Geänderte Küste' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('status')).not.toBeEmptyDOMElement()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Tabellenname' })).toHaveValue(
      'Geänderte Küste'
    )
  })

  it('does not reload creature facts when only a weight changes', async () => {
    const detail = vi.fn().mockResolvedValue(wolf)
    renderManager({ detail })
    await waitFor(() => expect(detail).toHaveBeenCalledOnce())

    fireEvent.click(
      screen.getByRole('button', { name: 'Gewicht Wolf erhöhen' })
    )
    await waitFor(() => expect(detail).toHaveBeenCalledOnce())
  })
})
