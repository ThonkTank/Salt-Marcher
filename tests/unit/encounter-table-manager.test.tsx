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
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CreatureCapabilityPort } from '../../src/renderer/features/creatures/creatures-capabilities.js'
import { EncounterTableDialog } from '../../src/renderer/features/encounter-table/encounter-table-manager.js'
import type { EncounterTableSaveResult } from '../../src/renderer/features/encounter-table/encounter-table-editor-types.js'
import type { Creature } from '../../src/shared/contracts/encounter.js'
import type {
  EncounterTable,
  EncounterTableDraft,
  EncounterTableSnapshot
} from '../../src/shared/contracts/encounter-source.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'

const wolf = {
  id: 'wolf',
  name: 'Wolf',
  challengeRating: '1/4'
} as Creature

const table = {
  id: '01900000-0000-7000-8000-000000000001',
  scope: 'campaign',
  protected: false,
  displayName: 'Küste',
  description: 'Salzige Begegnungen',
  position: 0,
  entries: [{ creatureId: 'wolf', weight: 3, position: 0 }]
} as EncounterTable

const snapshot: EncounterTableSnapshot = {
  installation: { revision: 0, tables: [], summaries: [] },
  campaign: { revision: 2, tables: [table], summaries: [] }
}

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
  table?: EncounterTable | null
  save?: (
    table: EncounterTable | null,
    draft: EncounterTableDraft
  ) => Promise<EncounterTableSaveResult>
  saved?: (result: EncounterTableSaveResult) => void
  detail?: (creatureId: string) => Promise<Creature>
  inspect?: (creature: Creature) => void
  invocation?:
    { kind: 'catalog' } | { kind: 'location-link' } | { kind: 'faction-link' }
}) {
  const save =
    props?.save ?? vi.fn().mockResolvedValue({ snapshot, saved: table })
  const saved = props?.saved ?? vi.fn()
  const detail = props?.detail ?? vi.fn().mockResolvedValue(wolf)
  render(
    <ModalLayerProvider>
      <EncounterTableDialog
        table={props?.table === undefined ? table : props.table}
        close={vi.fn()}
        save={save}
        saved={saved}
        onError={vi.fn()}
        inspect={props?.inspect ?? vi.fn()}
        creaturePort={creaturePort(detail)}
        biomePort={{ search: vi.fn() }}
        invocation={props?.invocation ?? { kind: 'catalog' }}
      />
    </ModalLayerProvider>
  )
  return { save, saved, detail }
}

describe('EncounterTableManager', () => {
  afterEach(cleanup)

  it.each([
    ['catalog' as const, 'Katalog', 'Erstellen'],
    [
      'location-link' as const,
      'World Planner › Orte › Ort erstellen',
      'Erstellen und verknüpfen'
    ],
    [
      'faction-link' as const,
      'Katalog › Fraktionen › Fraktion erstellen',
      'Erstellen und verknüpfen'
    ]
  ])(
    'renders the %s invocation breadcrumb and action',
    (kind, breadcrumb, action) => {
      renderManager({ table: null, invocation: { kind } })
      expect(screen.getByText(breadcrumb)).toBeVisible()
      expect(screen.getByRole('button', { name: action })).toBeVisible()
    }
  )

  it('publishes the saved snapshot and blocks duplicate save clicks', async () => {
    let resolveSave!: (value: {
      snapshot: EncounterTableSnapshot
      saved: EncounterTable
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

    resolveSave({ snapshot, saved: table })
    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith({ snapshot, saved: table })
    )
  })

  it('keeps the draft open and reports a local save error', async () => {
    const save = vi.fn().mockRejectedValue(new Error('conflict'))
    renderManager({ save })
    fireEvent.change(screen.getByRole('textbox', { name: 'Tabellenname' }), {
      target: { value: 'Geänderte Küste' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
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

  it('opens the draft statblock link and keeps missing references explicit', async () => {
    const inspect = vi.fn()
    renderManager({ inspect })
    const link = await screen.findByRole('button', { name: 'Wolf' })
    fireEvent.click(link)
    expect(inspect).toHaveBeenCalledWith(wolf)
    expect(screen.getByText('CR 1/4')).toBeVisible()

    cleanup()
    renderManager({ detail: vi.fn().mockRejectedValue(new Error('missing')) })
    expect(await screen.findByText('Nicht verfügbar (wolf)')).toBeVisible()
    expect(screen.getByText('CR —')).toBeVisible()
  })

  it('recomputes rounded labels and exact bars immediately after a weight change', async () => {
    const bear = { ...wolf, id: 'bear', name: 'Bär' } as Creature
    renderManager({
      table: {
        ...table,
        entries: [
          { creatureId: 'wolf', weight: 1, position: 0 },
          { creatureId: 'bear', weight: 1, position: 1 }
        ]
      },
      detail: (id) => Promise.resolve(id === 'bear' ? bear : wolf)
    })
    await screen.findByRole('button', { name: 'Gewicht Bär erhöhen' })
    expect(screen.getAllByText('50 %')).toHaveLength(2)

    fireEvent.click(
      screen.getByRole('button', { name: 'Gewicht Wolf erhöhen' })
    )

    expect(screen.getByText('67 %')).toBeVisible()
    expect(screen.getByText('33 %')).toBeVisible()
    const wolfRow = screen
      .getByRole('button', { name: 'Gewicht Wolf erhöhen' })
      .closest('li')!
    expect(
      wolfRow.querySelector<HTMLElement>('.encounter-table-share-track span')
    ).toHaveStyle({ width: `${200 / 3}%` })
  })

  it('keeps percentages and draft order stable while creature facts load', async () => {
    const resolvers = new Map<string, (value: Creature) => void>()
    renderManager({
      table: {
        ...table,
        entries: [
          { creatureId: 'wolf', weight: 1, position: 0 },
          { creatureId: 'bear', weight: 1, position: 1 }
        ]
      },
      detail: (id) =>
        new Promise<Creature>((resolve) => resolvers.set(id, resolve))
    })
    const roster = document.querySelector('.encounter-table-roster')!
    const shares = () =>
      [...roster.querySelectorAll('.encounter-table-share')].map(
        (entry) => entry.textContent
      )
    const widths = () =>
      [
        ...roster.querySelectorAll<HTMLElement>(
          '.encounter-table-share-track span'
        )
      ].map((entry) => entry.style.width)
    expect(shares()).toEqual(['50 %', '50 %'])
    expect(widths()).toEqual(['50%', '50%'])

    await act(async () => {
      resolvers.get('wolf')?.({ ...wolf, name: 'Zedwolf' })
      resolvers.get('bear')?.({ ...wolf, id: 'bear', name: 'Aabär' })
      await Promise.resolve()
    })
    await screen.findByRole('button', { name: 'Zedwolf' })
    expect(shares()).toEqual(['50 %', '50 %'])
    expect(widths()).toEqual(['50%', '50%'])
    expect(
      [...roster.querySelectorAll('li')].map(
        (entry) => entry.querySelector('.creature-collection-link')?.textContent
      )
    ).toEqual(['Zedwolf', 'Aabär'])
  })

  it('requires a creature when an existing table is edited', () => {
    renderManager()
    const save = screen.getByRole('button', { name: 'Speichern' })
    expect(save).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: /wolf.*entfernen/i }))

    expect(save).toBeDisabled()
    expect(
      screen.getByText('Mindestens ein Monster ist erforderlich.')
    ).toBeVisible()
  })

  it('shows campaign scope by default for every new table', () => {
    renderManager({ table: null })

    expect(
      screen.getByRole('combobox', {
        name: 'Geltung der Encounter-Tabelle'
      })
    ).toHaveValue('campaign')
    const create = screen.getByRole('button', { name: 'Erstellen' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Tabellenname' }), {
      target: { value: 'Leere Tabelle' }
    })
    expect(create).toBeDisabled()
    expect(
      screen.getByText('Mindestens ein Monster ist erforderlich.')
    ).toBeVisible()
  })

  it('keeps an existing table scope fixed when saving an edit', async () => {
    const installationTable = {
      ...table,
      scope: 'installation' as const
    }
    const save = vi.fn().mockResolvedValue({
      snapshot: {
        installation: {
          revision: 1,
          tables: [installationTable],
          summaries: []
        },
        campaign: snapshot.campaign
      },
      saved: installationTable
    })
    renderManager({ table: installationTable, save })
    expect(
      screen.queryByRole('combobox', {
        name: 'Geltung der Encounter-Tabelle'
      })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        installationTable,
        expect.objectContaining({ displayName: 'Küste' }),
        'installation'
      )
    )
  })
})
