import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorldLocationSaveCommandHandler } from '../../src/core/application/world-location-save.js'
import { WorldLocationPlacementService } from '../../src/core/application/world-location-placement.js'
import { EncounterSourceService } from '../../src/core/application/encounter-source-service.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import { WorldLocationSaveJournal } from '../../src/core/worldplanner/world-location-save-journal.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

const roots: string[] = []
const stores: CampaignStore[] = []

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-location-save-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  stores.push(campaigns)
  campaigns.create('Location save')
  const database = activeCampaignDatabase(campaigns)
  const locations = new WorldLocationService(
    campaigns.activeCampaignPersistence(),
    undefined,
    campaigns.installationPersistenceAccess()
  )
  const sources = new EncounterSourceService(
    campaigns.activeCampaignPersistence(),
    campaigns.installationPersistenceAccess()
  )
  const placeLocation = vi.fn()
  const removeLocation = vi.fn()
  const summary = vi.fn().mockReturnValue({ contentRevision: 4 })
  const locateLocation = vi.fn().mockReturnValue(null)
  const placement = new WorldLocationPlacementService(
    () =>
      ({
        maps: { summary, locateLocation },
        hexEditing: { placeLocation, removeLocation }
      }) as never
  )
  const handler = new WorldLocationSaveCommandHandler(
    () =>
      ({
        locations,
        journal: new WorldLocationSaveJournal(database),
        placement
      }) as never
  )
  return {
    database,
    handler,
    locations,
    placeLocation,
    removeLocation,
    summary,
    locateLocation,
    sources
  }
}

function command() {
  return {
    commandId: randomUUID(),
    locationId: null,
    location: {
      displayName: 'Windklippe',
      tags: ['Küste'],
      readAloud: '',
      notes: '',
      factionIds: [],
      encounterTableIds: []
    },
    expectedRevision: 0,
    placement: {
      kind: 'place' as const,
      target: {
        mapId: randomUUID(),
        coordinate: { q: 2, r: -1 }
      }
    }
  }
}

describe('WorldLocationSaveCommandHandler', () => {
  it('does not attempt placement when the base save fails', () => {
    const fixture = harness()
    const input = { ...command(), expectedRevision: 7 }

    expect(() => fixture.handler.execute(input)).toThrow('stale')
    expect(fixture.placeLocation).not.toHaveBeenCalled()
    expect(fixture.removeLocation).not.toHaveBeenCalled()
    expect(fixture.handler.receipt(input.commandId)).toBeNull()
  })

  it('handles keep and an already absent removal without Hex writes', () => {
    const fixture = harness()
    const keep = { ...command(), placement: { kind: 'keep' as const } }
    expect(fixture.handler.execute(keep).receipt).toMatchObject({
      status: 'saved',
      placement: 'unchanged'
    })

    const remove = {
      ...command(),
      expectedRevision: 1,
      placement: { kind: 'remove' as const }
    }
    expect(fixture.handler.execute(remove).receipt).toMatchObject({
      status: 'saved',
      placement: 'applied'
    })
    expect(fixture.placeLocation).not.toHaveBeenCalled()
    expect(fixture.removeLocation).not.toHaveBeenCalled()
  })

  it('removes the current placement using its fresh content revision', () => {
    const fixture = harness()
    const input = { ...command(), placement: { kind: 'remove' as const } }
    fixture.locateLocation.mockReturnValue({
      mapId: input.placement.kind === 'remove' ? randomUUID() : '',
      coordinate: { q: 1, r: 2 },
      contentRevision: 9
    })
    fixture.removeLocation.mockReturnValue({
      status: 'applied',
      commandId: input.commandId
    })

    expect(fixture.handler.execute(input).receipt.status).toBe('saved')
    expect(fixture.removeLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: input.commandId,
        expectedContentRevision: 9
      })
    )
  })

  it('keeps the base save when placement is rejected', () => {
    const fixture = harness()
    fixture.placeLocation.mockReturnValue({
      status: 'rejected',
      commandId: randomUUID(),
      reason: 'location_occupied'
    })
    const input = command()

    const execution = fixture.handler.execute(input)

    expect(execution.receipt).toMatchObject({
      status: 'partially-saved',
      placementFailure: { kind: 'occupied' },
      saved: { displayName: 'Windklippe' },
      snapshot: { revision: 1 }
    })
    expect(fixture.locations.read().locations).toHaveLength(1)
    expect(fixture.handler.receipt(input.commandId)).toEqual(execution.receipt)
  })

  it('saves campaign and installation references through the full domain port', () => {
    const fixture = harness()
    const table = fixture.sources.createTable(
      randomUUID(),
      { displayName: 'Küstenwache', description: '', entries: [] },
      0,
      'installation'
    ).saved
    const faction = fixture.sources.createFaction(
      randomUUID(),
      {
        displayName: 'Küstenbund',
        notes: '',
        disposition: 0,
        primaryEncounterTableId: null,
        inventory: []
      },
      0
    ).saved
    const input = command()
    fixture.placeLocation.mockReturnValue({
      status: 'rejected',
      commandId: randomUUID(),
      reason: 'tile_missing'
    })

    expect(
      fixture.handler.execute({
        ...input,
        location: {
          ...input.location,
          factionIds: [faction.id],
          encounterTableIds: [table.id]
        }
      }).receipt.saved
    ).toMatchObject({
      factionIds: [faction.id],
      encounterTableIds: [table.id]
    })
  })

  it.each([
    {
      label: 'missing map',
      failure: { kind: 'map-missing' },
      reject: () => new CapabilityError('not_found', false)
    },
    {
      label: 'unavailable map service',
      failure: { kind: 'unavailable' },
      reject: () => new Error('offline')
    }
  ])('keeps the base save for a $label rejection', ({ failure, reject }) => {
    const fixture = harness()
    fixture.summary.mockImplementation(() => {
      throw reject()
    })

    expect(fixture.handler.execute(command()).receipt).toMatchObject({
      status: 'partially-saved',
      placementFailure: failure,
      snapshot: { revision: 1 }
    })
    expect(fixture.locations.read().locations).toHaveLength(1)
  })

  it('leaves a readable provisional receipt after interruption following the base save', () => {
    const fixture = harness()
    const interrupted = new WorldLocationSaveCommandHandler(() => ({
      locations: fixture.locations,
      journal: new WorldLocationSaveJournal(fixture.database),
      placement: {
        execute: () => {
          throw new Error('simulated process interruption')
        }
      }
    }))
    const input = command()

    expect(() => interrupted.execute(input)).toThrow('process interruption')
    expect(interrupted.receipt(input.commandId)).toMatchObject({
      status: 'partially-saved',
      saved: { displayName: 'Windklippe' },
      placementFailure: {
        kind: 'unavailable',
        detail: 'placement_pending'
      }
    })
    expect(fixture.locations.read()).toMatchObject({
      revision: 1,
      locations: [{ displayName: 'Windklippe' }]
    })
  })

  it('retries only placement for the same partial command', () => {
    const fixture = harness()
    fixture.placeLocation
      .mockReturnValueOnce({
        status: 'rejected',
        commandId: randomUUID(),
        reason: 'tile_missing'
      })
      .mockReturnValueOnce({ status: 'applied', commandId: randomUUID() })
    const input = command()

    expect(fixture.handler.execute(input).receipt).toMatchObject({
      status: 'partially-saved',
      placementFailure: { kind: 'tile-missing' }
    })
    expect(fixture.handler.execute(input).receipt.status).toBe('saved')
    expect(fixture.locations.read()).toMatchObject({
      revision: 1,
      locations: [{ displayName: 'Windklippe' }]
    })
    expect(fixture.placeLocation).toHaveBeenCalledTimes(2)

    fixture.handler.execute(input)
    expect(fixture.placeLocation).toHaveBeenCalledTimes(2)
  })

  it('rejects command identity reuse with a different request', () => {
    const fixture = harness()
    fixture.placeLocation.mockReturnValue({
      status: 'rejected',
      commandId: randomUUID(),
      reason: 'tile_missing'
    })
    const input = command()
    fixture.handler.execute(input)

    expect(() =>
      fixture.handler.execute({
        ...input,
        location: { ...input.location, displayName: 'Andere Klippe' }
      })
    ).toThrow('validation_failed')
    expect(fixture.locations.read().locations).toHaveLength(1)
  })

  it('re-reads map revision for one stale placement retry', () => {
    const fixture = harness()
    fixture.placeLocation
      .mockImplementationOnce(() => {
        throw new CapabilityError('stale', true)
      })
      .mockReturnValueOnce({ status: 'applied', commandId: randomUUID() })

    expect(fixture.handler.execute(command()).receipt.status).toBe('saved')
    expect(fixture.summary).toHaveBeenCalledTimes(2)
    expect(fixture.placeLocation).toHaveBeenCalledTimes(2)
  })
})
