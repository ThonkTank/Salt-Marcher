// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useWorldLocationCreationWorkflow } from '../../src/renderer/features/worldplanner/use-world-location-creation-workflow.js'
import { automaticLocationPlacementTarget } from '../../src/renderer/features/hex/world-location-placement-target.js'
import type { HexMapView } from '../../src/shared/contracts/hex.js'
import type {
  WorldLocation,
  WorldLocationDraft,
  WorldLocationSnapshot
} from '../../src/shared/contracts/world-location.js'

const locationId = '01900000-0000-7000-8000-000000000070'
const current: WorldLocationSnapshot = { revision: 4, locations: [] }
const location: WorldLocation = {
  id: locationId,
  displayName: 'Windklippe',
  kind: 'Leuchtturm',
  region: 'Küste',
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
const next = {
  snapshot: { revision: 5, locations: [location] },
  createdLocation: location
}
const draft: WorldLocationDraft = {
  displayName: 'Windklippe',
  kind: 'Leuchtturm',
  region: 'Küste',
  notes: '',
  factionIds: [],
  encounterTableIds: []
}

function setup(overrides: Record<string, unknown> = {}) {
  const port = {
    readEditorReferences: vi
      .fn()
      .mockResolvedValue({ factions: [], tables: [] }),
    createLocation: vi.fn().mockResolvedValue(next),
    ...overrides
  }
  const applyCreated = vi.fn()
  const select = vi.fn()
  const place = vi
    .fn()
    .mockResolvedValue({ status: 'placed', coordinate: { q: 0, r: 0 } })
  const onPartialFailure = vi.fn()
  const hook = renderHook(() =>
    useWorldLocationCreationWorkflow({
      port,
      currentRevision: () => current.revision,
      applyCreated,
      select,
      place,
      errorText: (cause) => String(cause),
      onPartialFailure,
      unavailableMessage: 'Nicht verfügbar',
      savingMessage: 'Läuft'
    })
  )
  return { ...hook, port, applyCreated, select, place, onPartialFailure }
}

describe('world location creation workflow', () => {
  it('opens immediately, caches references and applies the exact create result', async () => {
    const fixture = setup()
    act(() => fixture.result.current.open())
    expect(fixture.result.current.dialogOpen).toBe(true)
    expect(fixture.result.current.references.status).toBe('loading')
    await act(async () => Promise.resolve())
    expect(fixture.result.current.references.status).toBe('ready')

    await act(() => fixture.result.current.save(draft))
    expect(fixture.port.createLocation).toHaveBeenCalledWith(draft, 4)
    expect(fixture.applyCreated).toHaveBeenCalledWith(next)
    expect(fixture.select).toHaveBeenCalledWith(locationId)
    expect(fixture.place).toHaveBeenCalledWith(locationId)
    expect(fixture.result.current.dialogOpen).toBe(false)

    act(() => fixture.result.current.open())
    expect(fixture.result.current.references.status).toBe('ready')
    expect(fixture.port.readEditorReferences).toHaveBeenCalledOnce()
  })

  it('keeps the dialog open for create failures and reports placement partial success', async () => {
    const fixture = setup({
      createLocation: vi.fn().mockRejectedValueOnce(new Error('stale'))
    })
    act(() => fixture.result.current.open())
    await act(async () => Promise.resolve())
    const failure = await act(() => fixture.result.current.save(draft))
    expect(failure).toEqual({ status: 'failed', message: 'Error: stale' })
    expect(fixture.result.current.dialogOpen).toBe(true)

    fixture.port.createLocation.mockResolvedValueOnce(next)
    fixture.place.mockResolvedValueOnce({ status: 'failed', message: 'belegt' })
    const success = await act(() => fixture.result.current.save(draft))
    expect(success).toEqual({ status: 'saved' })
    expect(fixture.onPartialFailure).toHaveBeenCalledWith('belegt')
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
})
