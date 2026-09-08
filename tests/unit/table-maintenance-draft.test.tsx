// @vitest-environment jsdom
import { WorldLocationDialog } from '../../src/renderer/features/worldplanner/world-location-dialog.js'
import type { WorldLocationDraft } from '../../src/shared/contracts/world-location.js'
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { Suspense, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EncounterTableDialog } from '../../src/renderer/features/encounter-table/encounter-table-manager.js'
import type { EncounterTableEditorRenderProps } from '../../src/renderer/features/encounter-table/encounter-table-editor-types.js'
import { WorldFactionDialog } from '../../src/renderer/features/worldplanner/world-faction-dialog.js'
import { useRelatedEntityDialogStack } from '../../src/renderer/features/workspace/integrations/related-entity-dialog-stack.js'
import { emptyEncounterTableSnapshot } from '../../src/renderer/features/encounter-table/encounter-table-snapshot.js'
import { emptyCreatureOptions } from '../../src/renderer/features/creatures/creature-state.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type { Creature } from '../../src/shared/contracts/encounter.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type {
  EncounterTable,
  WorldFactionDraft
} from '../../src/shared/contracts/encounter-source.js'
const wolf = {
  id: 'wolf',
  name: 'Wolf',
  challengeRating: '1/4',
  biomes: []
} as unknown as Creature
const table: EncounterTable = {
  id: '01900000-0000-7000-8000-000000000114',
  scope: 'campaign',
  protected: false,
  displayName: 'Patrouille',
  description: '',
  position: 0,
  entries: [{ creatureId: 'wolf', weight: 1, position: 0 }]
}
const tableReceipt = {
  saved: table,
  snapshot: {
    ...emptyEncounterTableSnapshot,
    campaign: { revision: 1, tables: [table], summaries: [] }
  }
}
const factionReceipt = {
  saved: {
    id: '01900000-0000-7000-8000-000000000113',
    displayName: 'Bund',
    notes: '',
    disposition: 0,
    primaryEncounterTableId: table.id,
    position: 0,
    inventory: []
  },
  snapshot: { revision: 1, factions: [] }
}
function creatures() {
  return {
    search: vi.fn().mockResolvedValue({
      status: 'ready',
      rows: [wolf, { ...wolf, id: 'bear', name: 'Bär' }],
      total: 2,
      offset: 0,
      limit: 30,
      message: ''
    }),
    filterOptions: vi.fn().mockResolvedValue(emptyCreatureOptions),
    detail: vi.fn().mockResolvedValue(wolf)
  }
}
let resolution: MaintenanceDraftResolution | undefined
function begin() {
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
}
afterEach(() => {
  act(() => resolution?.release())
  resolution = undefined
  cleanup()
})
function tableView(overrides: Partial<EncounterTableEditorRenderProps> = {}) {
  const save = vi.fn().mockResolvedValue(tableReceipt)
  const close = vi.fn()
  render(
    <ModalLayerProvider>
      <EncounterTableDialog
        table={null}
        close={close}
        save={save}
        saved={vi.fn()}
        onError={vi.fn()}
        inspect={vi.fn()}
        creaturePort={creatures()}
        biomePort={{ search: vi.fn() }}
        invocation={{ kind: 'catalog' }}
        {...overrides}
      />
    </ModalLayerProvider>
  )
  return { save, close }
}
async function editTable() {
  fireEvent.change(
    await screen.findByRole('textbox', { name: 'Tabellenname' }),
    { target: { value: 'Patrouille' } }
  )
  fireEvent.click(
    await screen.findByRole('button', { name: 'Wolf hinzufügen' })
  )
}
describe('table maintenance owner', () => {
  it('saves scope, description and weights while rejecting late edits', async () => {
    const { save } = tableView()
    await editTable()
    const scope = screen.getByRole('combobox', {
      name: 'Geltung der Encounter-Tabelle'
    })
    fireEvent.change(scope, { target: { value: 'installation' } })
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Tabellenbeschreibung' }),
      { target: { value: 'Notizen' } }
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Gewicht Wolf erhöhen' })
    )
    begin()
    expect(scope).toBeDisabled()
    fireEvent.change(scope, { target: { value: 'campaign' } })
    const name = screen.getByRole('textbox', { name: 'Tabellenname' })
    expect(name).toBeDisabled()
    fireEvent.change(name, { target: { value: 'Late edit' } })
    const description = screen.getByRole('textbox', {
      name: 'Tabellenbeschreibung'
    })
    expect(description).toBeDisabled()
    fireEvent.change(description, { target: { value: 'Forbidden notes' } })
    for (const label of [
      'Gewicht Wolf erhöhen',
      'Gewicht Wolf verringern',
      'Wolf entfernen',
      'Bär hinzufügen'
    ]) {
      const button = screen.getByRole('button', { name: label })
      expect(button).toBeDisabled()
      fireEvent.click(button)
    }

    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(save).toHaveBeenCalledExactlyOnceWith(
      null,
      {
        displayName: 'Patrouille',
        description: 'Notizen',
        entries: [{ creatureId: 'wolf', weight: 2 }]
      },
      'installation'
    )
  })
  it('does not persist an invalid draft', async () => {
    const { save } = tableView()
    fireEvent.change(screen.getByRole('textbox', { name: 'Tabellenname' }), {
      target: { value: 'Fehlende Einträge' }
    })
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    expect(save).not.toHaveBeenCalled()
  })
  it('retries reconciliation without another save', async () => {
    const saved = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('projection failed')
      })
      .mockImplementationOnce(() => undefined)
    const { save } = tableView({ saved })
    await editTable()
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(save).toHaveBeenCalledOnce()
    expect(saved).toHaveBeenCalledTimes(2)
  })
  it('waits for an existing normal save', async () => {
    let finish!: () => void
    const save = vi.fn(
      () =>
        new Promise<typeof tableReceipt>((resolve) => {
          finish = () => resolve(tableReceipt)
        })
    )
    tableView({ save })
    await editTable()
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    begin()
    await act(async () => {
      const result = resolution!.resolve('save')
      finish()
      expect(await result).toEqual([])
    })
    expect(save).toHaveBeenCalledOnce()
  })
  it('discards without mutation', async () => {
    const { save, close } = tableView()
    await editTable()
    begin()
    await act(async () => {
      expect(await resolution!.resolve('discard')).toEqual([])
    })
    expect(save).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })
})
function nestedView(
  create: () => Promise<typeof tableReceipt>,
  save: (draft: WorldFactionDraft) => Promise<typeof factionReceipt>
) {
  const port = {
    creatures: creatures(),
    biomes: { search: vi.fn() },
    encounterTables: {
      read: () => Promise.resolve(emptyEncounterTableSnapshot),
      create
    }
  } as unknown as SaltMarcherApi
  function Harness() {
    const [open, setOpen] = useState(true)
    const stack = useRelatedEntityDialogStack({
      port,
      inspect: vi.fn(),
      onError: vi.fn()
    })
    return (
      <ModalLayerProvider>
        <Suspense fallback={null}>
          {open && (
            <WorldFactionDialog
              faction={null}
              tableSnapshot={emptyEncounterTableSnapshot}
              save={save}
              saved={() => setOpen(false)}
              close={() => setOpen(false)}
              requestTableCreation={(created) =>
                stack.requestTableCreation('faction-link', created)
              }
              onError={vi.fn()}
              inspect={vi.fn()}
              creatures={{
                detail: port.creatures.detail as unknown as (
                  id: string
                ) => Promise<Creature>
              }}
              invocation={{ kind: 'catalog' }}
            />
          )}
          {stack.dialogs}
        </Suspense>
      </ModalLayerProvider>
    )
  }
  render(<Harness />)
}
async function editNested() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Fraktionsname' }), {
    target: { value: 'Bund' }
  })
  fireEvent.click(screen.getByRole('button', { name: /Keine primäre Tabelle/ }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Neue Encounter-Tabelle' })
  )
  await editTable()
}
describe('real faction and table dialog stack', () => {
  it('persists the table first and includes its ID in the parent save', async () => {
    const calls: string[] = []
    const create = vi.fn(() => {
      calls.push('table')
      return Promise.resolve(tableReceipt)
    })
    const save = vi.fn(() => {
      calls.push('faction')
      return Promise.resolve(factionReceipt)
    })
    nestedView(create, save)
    await editNested()
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(calls).toEqual(['table', 'faction'])
    expect(save).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ primaryEncounterTableId: table.id })
    )
    expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
  })
  it('keeps the parent unsaved when child persistence fails and retries in order', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce(tableReceipt)
    const save = vi.fn().mockResolvedValue(factionReceipt)
    nestedView(create, save)
    await editNested()
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(2)
    })
    expect(save).not.toHaveBeenCalled()
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(create).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenCalledOnce()
  })
  it('does not recreate the closed child when only the parent needs retry', async () => {
    const create = vi.fn().mockResolvedValue(tableReceipt)
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('parent failed'))
      .mockResolvedValueOnce(factionReceipt)
    nestedView(create, save)
    await editNested()
    begin()
    await act(async () => {
      expect(await resolution!.resolve('save')).toHaveLength(1)
    })
    expect(
      screen.queryByRole('textbox', { name: 'Tabellenname' })
    ).not.toBeInTheDocument()
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(create).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledTimes(2)
  })
  it('discards the child before closing the parent without persistence', async () => {
    const create = vi.fn().mockResolvedValue(tableReceipt)
    const save = vi.fn().mockResolvedValue(factionReceipt)
    nestedView(create, save)
    await editNested()
    begin()
    await act(async () => {
      expect(await resolution!.resolve('discard')).toEqual([])
    })
    expect(create).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('real location, faction and table dialog stack', () => {
  it.each(['save', 'retry', 'discard'] as const)(
    'settles all three owners on %s',
    async (mode) => {
      const calls: string[] = []
      const createTable = vi.fn(() => {
        calls.push('table')
        return Promise.resolve(tableReceipt)
      })
      let attempt = 0
      const createFaction = vi.fn((input: { faction: WorldFactionDraft }) => {
        calls.push('faction')
        expect(input.faction.primaryEncounterTableId).toBe(table.id)
        if (mode === 'retry' && attempt++ === 0)
          return Promise.reject(new Error('faction write failed'))
        return Promise.resolve(factionReceipt)
      })
      const saveLocation = vi
        .fn<(draft: WorldLocationDraft) => Promise<{ status: 'saved' }>>()
        .mockImplementation(() => {
          calls.push('location')
          return Promise.resolve({ status: 'saved' })
        })
      const port = {
        creatures: creatures(),
        biomes: { search: vi.fn() },
        encounterTables: {
          read: () => Promise.resolve(emptyEncounterTableSnapshot),
          create: createTable
        },
        factions: {
          read: () => Promise.resolve({ revision: 0, factions: [] }),
          create: createFaction
        }
      } as unknown as SaltMarcherApi
      function Harness() {
        const [open, setOpen] = useState(true)
        const stack = useRelatedEntityDialogStack({
          port,
          onError: vi.fn(),
          inspect: vi.fn()
        })
        return (
          <ModalLayerProvider>
            <Suspense fallback={null}>
              {open && (
                <WorldLocationDialog
                  location={null}
                  references={{
                    factions: { status: 'ready', value: [] },
                    tables: { status: 'ready', value: [] }
                  }}
                  suggestTags={() => Promise.resolve([])}
                  close={() => setOpen(false)}
                  save={saveLocation}
                  relatedCreation={{
                    requestFactionCreation: stack.requestFactionCreation,
                    requestTableCreation: (created) =>
                      stack.requestTableCreation('location-link', (result) =>
                        created(result.saved)
                      )
                  }}
                />
              )}
              {stack.dialogs}
            </Suspense>
          </ModalLayerProvider>
        )
      }
      render(<Harness />)
      fireEvent.change(screen.getByRole('textbox', { name: 'Ortsname' }), {
        target: { value: 'Kap' }
      })
      fireEvent.change(screen.getByRole('combobox', { name: 'Tags' }), {
        target: { value: 'Küste' }
      })
      fireEvent.click(screen.getByRole('button', { name: 'Neue Fraktion' }))
      await screen.findByRole('textbox', { name: 'Fraktionsname' })
      await editNested()
      begin()
      if (mode === 'retry') {
        await act(async () => {
          expect(await resolution!.resolve('save')).toHaveLength(2)
        })
        expect(saveLocation).not.toHaveBeenCalled()
        expect(createTable).toHaveBeenCalledOnce()
      }
      await act(async () => {
        expect(
          await resolution!.resolve(mode === 'discard' ? 'discard' : 'save')
        ).toEqual([])
      })
      if (mode === 'discard') {
        expect(calls).toEqual([])
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      } else {
        expect(calls).toEqual(
          mode === 'retry'
            ? ['table', 'faction', 'faction', 'location']
            : ['table', 'faction', 'location']
        )
        expect(saveLocation).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            displayName: 'Kap',
            tags: ['Küste'],
            factionIds: [factionReceipt.saved.id]
          })
        )
        expect(createTable).toHaveBeenCalledOnce()
      }
    }
  )
})
