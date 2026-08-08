// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useWorldLocationCreationWorkflow } from '../../src/renderer/features/worldplanner/use-world-location-creation-workflow.js'
import { automaticLocationPlacementTarget } from '../../src/renderer/features/hex/world-location-placement-target.js'
import { worldLocationPlacementIntent } from '../../src/renderer/features/worldplanner/world-location-editor-types.js'
import type { HexMapView } from '../../src/shared/contracts/hex.js'
import type {
  WorldLocation,
  WorldLocationDraft,
  WorldLocationSaveReceipt,
  WorldLocationSnapshot
} from '../../src/shared/contracts/world-location.js'

const locationId = '01900000-0000-7000-8000-000000000070'
const current: WorldLocationSnapshot = { revision: 4, locations: [] }
const location: WorldLocation = {
  id: locationId,
  displayName: 'Windklippe',
  tags: ['Leuchtturm', 'Küste'],
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
}
const next: WorldLocationSaveReceipt = {
  status: 'saved',
  commandId: '01900000-0000-7000-8000-000000000099',
  snapshot: { revision: 5, locations: [location] },
  saved: location,
  placement: 'unchanged'
}
const draft: WorldLocationDraft = {
  displayName: 'Windklippe',
  tags: ['Leuchtturm', 'Küste'],
  readAloud: '',
  notes: '',
  factionIds: [],
  encounterTableIds: []
}

function setup(overrides: Record<string, unknown> = {}) {
  const port = {
    readLocations: vi.fn().mockResolvedValue(current),
    readFactions: vi.fn().mockResolvedValue([]),
    readTables: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue({
      receipt: next,
      retryPlacement: vi.fn().mockResolvedValue({ status: 'unchanged' })
    }),
    remove: vi.fn(),
    ...overrides
  }
  const applyCreated = vi.fn()
  const select = vi.fn()
  const hook = renderHook(() =>
    useWorldLocationCreationWorkflow({
      port,
      applyCreated,
      select,
      presentError: (cause) => String(cause),
      savingMessage: 'Läuft'
    })
  )
  return {
    ...hook,
    port,
    applyCreated,
    select
  }
}

describe('world location creation workflow', () => {
  it('opens immediately, caches references and applies the exact create result', async () => {
    const fixture = setup()
    act(() => fixture.result.current.open())
    expect(fixture.result.current.dialogOpen).toBe(true)
    expect(fixture.result.current.references.factions.status).toBe('loading')
    expect(fixture.result.current.references.tables.status).toBe('loading')
    await act(async () => Promise.resolve())
    expect(fixture.result.current.references.factions.status).toBe('ready')
    expect(fixture.result.current.references.tables.status).toBe('ready')

    const placement = {
      kind: 'place' as const,
      target: {
        mapId: '01900000-0000-7000-8000-000000000071',
        coordinate: { q: 0, r: 0 }
      }
    }
    await act(() => fixture.result.current.save(draft, placement))
    expect(fixture.port.save).toHaveBeenCalledWith(null, draft, placement)
    expect(fixture.applyCreated).toHaveBeenCalledWith(next)
    expect(fixture.select).toHaveBeenCalledWith(locationId)
    expect(fixture.result.current.dialogOpen).toBe(false)

    act(() => fixture.result.current.open())
    expect(fixture.result.current.references.factions.status).toBe('ready')
    expect(fixture.result.current.references.tables.status).toBe('ready')
    expect(fixture.port.readFactions).toHaveBeenCalledOnce()
    expect(fixture.port.readTables).toHaveBeenCalledOnce()
  })

  it('keeps the dialog open for create failures and reports placement partial success', async () => {
    const fixture = setup({
      save: vi.fn().mockRejectedValueOnce(new Error('stale'))
    })
    act(() => fixture.result.current.open())
    await act(async () => Promise.resolve())
    const unchanged = { kind: 'keep' as const }
    const failure = await act(() =>
      fixture.result.current.save(draft, unchanged)
    )
    expect(failure).toEqual({ status: 'failed', message: 'Error: stale' })
    expect(fixture.result.current.dialogOpen).toBe(true)

    const retryPlacement = vi.fn().mockResolvedValue({
      status: 'applied' as const
    })
    fixture.port.save.mockResolvedValueOnce({
      receipt: {
        ...next,
        status: 'partially-saved',
        placement: undefined,
        placementFailure: { kind: 'occupied' }
      },
      retryPlacement
    })
    const success = await act(() =>
      fixture.result.current.save(draft, unchanged)
    )
    expect(success.status).toBe('partially-saved')
    if (success.status !== 'partially-saved')
      throw new Error('Expected partial success')
    expect(success.placementFailure).toEqual({ kind: 'occupied' })
    expect(success.retry).toBeTypeOf('function')
    expect(fixture.result.current.dialogOpen).toBe(true)
  })

  it('targets only a selected authored and unoccupied tile', () => {
    const selected = { q: 0, r: 0 }
    const tile = {
      q: 0,
      r: 0,
      id: '0,0',
      label: 'q 0 · r 0',
      biomeId: 'grassland' as const,
      location: null
    }
    const map = { tiles: [tile] } as unknown as HexMapView
    expect(automaticLocationPlacementTarget(map, selected)).toEqual({
      status: 'eligible',
      coordinate: selected
    })
    expect(
      automaticLocationPlacementTarget(
        {
          ...map,
          tiles: [{ ...tile, location: { locationId } }]
        } as HexMapView,
        selected
      )
    ).toEqual({ status: 'skipped', reason: 'occupied' })
    expect(automaticLocationPlacementTarget(map, { q: 1, r: 1 })).toEqual({
      status: 'skipped',
      reason: 'tile_missing'
    })
  })

  it('derives place, remove and keep intents from staged state', () => {
    const selection = {
      mapId: '01900000-0000-7000-8000-000000000071',
      coordinate: { q: 2, r: -1 }
    }
    expect(
      worldLocationPlacementIntent({
        viewedMapId: selection.mapId,
        placementDraft: { baseline: selection, current: { ...selection } }
      })
    ).toEqual({ kind: 'keep' })
    expect(
      worldLocationPlacementIntent({
        viewedMapId: selection.mapId,
        placementDraft: { baseline: null, current: selection }
      })
    ).toEqual({ kind: 'place', target: selection })
    expect(
      worldLocationPlacementIntent({
        viewedMapId: selection.mapId,
        placementDraft: { baseline: selection, current: null }
      })
    ).toEqual({ kind: 'remove' })
  })
})
