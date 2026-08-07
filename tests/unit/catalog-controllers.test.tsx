// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMonsterCatalogController } from '../../src/renderer/features/catalog/monster-catalog-controller.js'
import { useLocationCatalogController } from '../../src/renderer/features/catalog/location-catalog-controller.js'
import { useFactionCatalogController } from '../../src/renderer/features/catalog/faction-catalog-controller.js'
import { useEncounterTableCatalogController } from '../../src/renderer/features/encounter-table/encounter-table-catalog-controller.js'
import type { CreatureCapabilityPort } from '../../src/renderer/features/creatures/creatures-capabilities.js'
import type { LocationCatalogPort } from '../../src/renderer/features/catalog/location-catalog-controller.js'
import type { WorldFactionApplicationPort } from '../../src/renderer/features/worldplanner/world-faction-application.js'
import type { EncounterTableApplicationPort } from '../../src/renderer/features/encounter-table/encounter-table-application.js'
import type { Creature } from '../../src/shared/contracts/encounter.js'
import type { WorldLocation } from '../../src/shared/contracts/world-location.js'
import type {
  EncounterTable,
  WorldFaction
} from '../../src/shared/contracts/encounter-source.js'

const onError = vi.fn()
const inspect = vi.fn()
const setSession = vi.fn()
const location = {
  id: '01900000-0000-7000-8000-000000000010',
  displayName: 'Hafen',
  tags: ['Siedlung'],
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
} as WorldLocation
const faction = {
  id: '01900000-0000-7000-8000-000000000011',
  displayName: 'Wache',
  notes: '',
  disposition: 0,
  primaryEncounterTableId: null,
  position: 0,
  inventory: []
} as WorldFaction
const table = {
  id: '01900000-0000-7000-8000-000000000012',
  scope: 'campaign',
  protected: false,
  displayName: 'Patrouille',
  description: '',
  position: 0,
  entries: []
} as EncounterTable
const tableSnapshot = {
  installation: { revision: 0, tables: [], summaries: [] },
  campaign: { revision: 1, tables: [table], summaries: [] }
}

function ports() {
  const creatureFilterOptions = vi.fn().mockResolvedValue({
    challengeRatings: [],
    sizes: [],
    types: [],
    subtypes: [],
    biomes: [],
    alignments: [],
    encounterTables: [],
    factions: [],
    locations: []
  })
  const creatureSearch = vi.fn().mockResolvedValue({
    status: 'ready',
    rows: [],
    total: 0,
    offset: 0,
    limit: 50,
    message: ''
  })
  const creature = {
    filterOptions: creatureFilterOptions,
    search: creatureSearch,
    detail: vi.fn().mockResolvedValue({ id: 'wolf', name: 'Wolf' } as Creature)
  } as unknown as CreatureCapabilityPort
  const locations = {
    readLocations: vi.fn().mockResolvedValue({
      revision: 1,
      locations: [location]
    }),
    readTables: vi
      .fn()
      .mockResolvedValue({
        ...tableSnapshot
      })
      .mockResolvedValue([table]),
    readFactions: vi.fn().mockResolvedValue([faction]),
    readSession: vi.fn().mockResolvedValue({}),
    save: vi.fn(),
    remove: vi.fn()
  } as unknown as LocationCatalogPort
  const factions = {
    readFactions: vi
      .fn()
      .mockResolvedValue({ revision: 1, factions: [faction] }),
    readTables: vi.fn().mockResolvedValue(tableSnapshot),
    saveFaction: vi.fn(),
    deleteFaction: vi.fn(),
    saveTable: vi.fn(),
    onTablesChanged: vi.fn().mockReturnValue(() => undefined)
  } as WorldFactionApplicationPort
  const encounterTables = {
    read: vi.fn().mockResolvedValue(tableSnapshot),
    save: vi.fn(),
    remove: vi.fn(),
    onChanged: vi.fn().mockReturnValue(() => undefined)
  } as EncounterTableApplicationPort
  return {
    creature,
    locations,
    factions,
    encounterTables,
    creatureFilterOptions,
    creatureSearch
  }
}

type Section = 'monsters' | 'locations' | 'factions' | 'encounterTables'

describe('catalog controllers', () => {
  it('does not read from any inactive provider', () => {
    const port = ports()
    renderHook(() => {
      useMonsterCatalogController(false, onError, inspect, port.creature)
      useLocationCatalogController(false, onError, setSession, port.locations)
      useFactionCatalogController(false, onError, port.factions)
      useEncounterTableCatalogController(false, onError, port.encounterTables)
    })

    expect(port.creatureFilterOptions).not.toHaveBeenCalled()
    expect(port.creatureSearch).not.toHaveBeenCalled()
    expect(port.locations.readLocations).not.toHaveBeenCalled()
    expect(port.factions.readFactions).not.toHaveBeenCalled()
    expect(port.encounterTables.read).not.toHaveBeenCalled()
  })

  it('retains each section state while only the active controller reads', async () => {
    const port = ports()
    const { result, rerender } = renderHook(
      ({ section }: { section: Section }) => ({
        monsters: useMonsterCatalogController(
          section === 'monsters',
          onError,
          inspect,
          port.creature
        ),
        locations: useLocationCatalogController(
          section === 'locations',
          onError,
          setSession,
          port.locations
        ),
        factions: useFactionCatalogController(
          section === 'factions',
          onError,
          port.factions
        ),
        encounterTables: useEncounterTableCatalogController(
          section === 'encounterTables',
          onError,
          port.encounterTables
        )
      }),
      { initialProps: { section: 'monsters' as Section } }
    )

    await waitFor(() => expect(port.creatureSearch).toHaveBeenCalledOnce())
    act(() =>
      result.current.monsters.setQuery({
        ...result.current.monsters.query,
        name: 'wolf',
        sort: 'xp',
        direction: 'desc',
        offset: 50
      })
    )

    rerender({ section: 'locations' })
    await waitFor(() =>
      expect(port.locations.readLocations).toHaveBeenCalledOnce()
    )
    act(() => result.current.locations.setSelected(location))

    rerender({ section: 'factions' })
    await waitFor(() =>
      expect(port.factions.readFactions).toHaveBeenCalledOnce()
    )
    act(() => result.current.factions.setSearch('wache'))

    rerender({ section: 'encounterTables' })
    await waitFor(() =>
      expect(port.encounterTables.read).toHaveBeenCalledOnce()
    )
    act(() => result.current.encounterTables.setSearch('patrouille'))

    expect(result.current.monsters.query).toMatchObject({
      name: 'wolf',
      sort: 'xp',
      direction: 'desc',
      offset: 50
    })
    expect(result.current.locations.selected).toBe(location)
    expect(result.current.factions.search).toBe('wache')
    expect(result.current.encounterTables.search).toBe('patrouille')
    expect(port.creatureFilterOptions).toHaveBeenCalledOnce()
    expect(port.locations.readLocations).toHaveBeenCalledOnce()
    expect(port.factions.readFactions).toHaveBeenCalledOnce()
    expect(port.encounterTables.read).toHaveBeenCalledOnce()
  })

  it('keeps locations and factions ready while tables fail and retry independently', async () => {
    const port = ports()
    vi.mocked(port.locations.readTables)
      .mockRejectedValueOnce(new Error('tables offline'))
      .mockResolvedValueOnce([table])
    const hook = renderHook(() =>
      useLocationCatalogController(true, onError, setSession, port.locations)
    )
    await waitFor(() =>
      expect(hook.result.current.references.tables.status).toBe('failed')
    )
    expect(hook.result.current.references.factions).toEqual({
      status: 'ready',
      value: [faction]
    })
    expect(hook.result.current.snapshot.locations).toEqual([location])
    const failed = hook.result.current.references.tables
    if (failed.status !== 'failed') throw new Error('Expected table failure')
    act(() => failed.retry())
    await waitFor(() =>
      expect(hook.result.current.references.tables).toEqual({
        status: 'ready',
        value: [table]
      })
    )
    expect(port.locations.readFactions).toHaveBeenCalledOnce()
    expect(port.locations.readLocations).toHaveBeenCalledOnce()
    expect(port.locations.readTables).toHaveBeenCalledTimes(2)
  })
})
