import { describe, expect, it, vi } from 'vitest'
import { createWorldLocationApplicationPort } from '../../src/renderer/features/worldplanner/world-location-application.js'
import type {
  WorldLocation,
  WorldLocationSaveReceipt
} from '../../src/shared/contracts/world-location.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import { saveWorldLocationInputSchema } from '../../src/shared/contracts/world-location.js'

const location: WorldLocation = {
  id: '01900000-0000-7000-8000-000000000070',
  displayName: 'Windklippe',
  tags: ['Küste'],
  readAloud: '',
  notes: '',
  factionIds: [],
  encounterTableIds: [],
  position: 0,
  mapPresentation: {
    revision: 0,
    titleOverride: null,
    symbolId: 'location',
    symbolSize: 44,
    labelCurve: 0,
    labelPosition: 'below'
  }
}
const saved: WorldLocationSaveReceipt = {
  status: 'saved',
  commandId: '01900000-0000-7000-8000-000000000099',
  snapshot: { revision: 1, locations: [location] },
  saved: location,
  placement: 'applied'
}
const draft = {
  displayName: location.displayName,
  tags: location.tags,
  notes: '',
  readAloud: '',
  factionIds: [],
  encounterTableIds: []
}

function api() {
  return {
    locations: {
      read: vi.fn().mockResolvedValue({ revision: 0, locations: [] }),
      save: vi.fn().mockResolvedValue(saved),
      saveReceipt: vi.fn().mockResolvedValue(null),
      delete: vi.fn()
    },
    factions: { read: vi.fn() },
    encounterTables: { read: vi.fn() }
  }
}

describe('WorldLocationApplicationPort', () => {
  it('returns the exact saved record and owns command identity and revision', async () => {
    const capabilities = api()
    const port = createWorldLocationApplicationPort(capabilities as never)

    const result = await port.save(null, draft, { kind: 'keep' })
    const input = saveWorldLocationInputSchema.parse(
      capabilities.locations.save.mock.calls[0]?.[0] as unknown
    )

    expect(result.receipt.saved).toBe(location)
    expect(input).toEqual({
      commandId: input.commandId,
      locationId: null,
      location: draft,
      expectedRevision: 0,
      placement: { kind: 'keep' }
    })
  })

  it('reads an unknown outcome by command identity without replaying it', async () => {
    const capabilities = api()
    capabilities.locations.save.mockRejectedValueOnce(
      new CapabilityError('outcome_unknown', true)
    )
    capabilities.locations.saveReceipt.mockResolvedValueOnce(saved)
    const port = createWorldLocationApplicationPort(capabilities as never)

    await expect(
      port.save(null, draft, { kind: 'keep' })
    ).resolves.toMatchObject({ receipt: saved })
    expect(capabilities.locations.save).toHaveBeenCalledOnce()
    expect(capabilities.locations.saveReceipt).toHaveBeenCalledWith(
      expect.any(String)
    )
  })

  it('does not replay an unknown outcome when its receipt is absent', async () => {
    const capabilities = api()
    const failure = new CapabilityError('outcome_unknown', true)
    capabilities.locations.save.mockRejectedValueOnce(failure)
    const port = createWorldLocationApplicationPort(capabilities as never)

    await expect(port.save(null, draft, { kind: 'keep' })).rejects.toBe(failure)
    expect(capabilities.locations.save).toHaveBeenCalledOnce()
  })

  it('uses the same command only for an explicit partial-placement retry', async () => {
    const capabilities = api()
    const partial: WorldLocationSaveReceipt = {
      status: 'partially-saved',
      commandId: saved.commandId,
      snapshot: saved.snapshot,
      saved: location,
      placementFailure: { kind: 'occupied' }
    }
    capabilities.locations.save
      .mockResolvedValueOnce(partial)
      .mockResolvedValueOnce(saved)
    const port = createWorldLocationApplicationPort(capabilities as never)

    const result = await port.save(null, draft, { kind: 'remove' })
    await expect(result.retryPlacement()).resolves.toEqual({
      status: 'applied'
    })
    expect(capabilities.locations.save).toHaveBeenCalledTimes(2)
    expect(capabilities.locations.save.mock.calls[1]?.[0]).toEqual(
      capabilities.locations.save.mock.calls[0]?.[0]
    )
    expect(capabilities.locations.read).toHaveBeenCalledOnce()
  })

  it('reconciles an unknown explicit retry through the same receipt identity', async () => {
    const capabilities = api()
    const partial: WorldLocationSaveReceipt = {
      status: 'partially-saved',
      commandId: saved.commandId,
      snapshot: saved.snapshot,
      saved: location,
      placementFailure: { kind: 'occupied' }
    }
    capabilities.locations.save
      .mockResolvedValueOnce(partial)
      .mockRejectedValueOnce(new CapabilityError('outcome_unknown', true))
    capabilities.locations.saveReceipt.mockResolvedValueOnce(saved)
    const port = createWorldLocationApplicationPort(capabilities as never)

    const result = await port.save(null, draft, { kind: 'remove' })
    await expect(result.retryPlacement()).resolves.toEqual({
      status: 'applied'
    })
    const input = capabilities.locations.save.mock.calls[0]?.[0] as {
      commandId: string
    }
    expect(capabilities.locations.saveReceipt).toHaveBeenCalledWith(
      input.commandId
    )
    expect(capabilities.locations.save).toHaveBeenCalledTimes(2)
  })
})
