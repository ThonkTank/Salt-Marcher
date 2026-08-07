import { describe, expect, it, vi } from 'vitest'
import { createWorldLocationPlacementCommitter } from '../../src/renderer/features/hex/world-location-placement-commit.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { HexBrushStrokeResult } from '../../src/shared/contracts/hex.js'
import type { WorldLocationPlacementCommand } from '../../src/shared/contracts/world-location.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

const mapId = '01900000-0000-7000-8000-000000000071'
const locationId = '01900000-0000-7000-8000-000000000070'

function applied(commandId: string): HexBrushStrokeResult {
  return {
    status: 'applied',
    commandId,
    catalogRevision: 1,
    maps: [],
    changedChunks: [],
    history: {
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null
    },
    changed: true,
    affectedTileCount: 1,
    impact: { locations: [], journeys: [], partyMembers: [] },
    warnings: []
  }
}

function fixture() {
  const commitPlacement = vi
    .fn<SaltMarcherApi['locations']['commitPlacement']>()
    .mockResolvedValue({ status: 'applied' })
  const commandReceipt = vi
    .fn<SaltMarcherApi['hex']['commandReceipt']>()
    .mockResolvedValue(null)
  const api = {
    locations: { commitPlacement },
    hex: { commandReceipt }
  } as unknown as Pick<SaltMarcherApi, 'locations' | 'hex'>
  return {
    commit: createWorldLocationPlacementCommitter(api),
    commitPlacement,
    commandReceipt
  }
}

describe('world location placement committer', () => {
  it('passes one stable command to the utility-side placement use case', async () => {
    const current = fixture()
    const placement = {
      kind: 'place' as const,
      target: { mapId, coordinate: { q: 4, r: -2 } }
    }

    await expect(current.commit(locationId, placement)).resolves.toEqual({
      status: 'applied'
    })
    const command = current.commitPlacement.mock.calls[0]?.[0] as
      WorldLocationPlacementCommand | undefined
    expect(command?.commandId).toMatch(/^[0-9a-f-]{36}$/)
    expect(command).toMatchObject({ locationId, placement })
  })

  it('returns typed utility rejections without renderer-side map reads', async () => {
    const current = fixture()
    current.commitPlacement.mockResolvedValueOnce({
      status: 'rejected',
      failure: { kind: 'occupied' }
    })
    await expect(
      current.commit(locationId, { kind: 'remove' })
    ).resolves.toEqual({
      status: 'rejected',
      failure: { kind: 'occupied' }
    })
  })

  it('resolves an unknown applied outcome only through its matching receipt', async () => {
    const current = fixture()
    current.commitPlacement.mockRejectedValueOnce(
      new CapabilityError('outcome_unknown', true)
    )
    current.commandReceipt.mockImplementationOnce((commandId) =>
      Promise.resolve(applied(commandId))
    )

    await expect(
      current.commit(locationId, { kind: 'remove' })
    ).resolves.toEqual({ status: 'applied' })
    const command = current.commitPlacement.mock.calls[0]?.[0] as
      WorldLocationPlacementCommand | undefined
    const commandId = command?.commandId
    expect(current.commandReceipt).toHaveBeenCalledWith(commandId)
    expect(current.commitPlacement).toHaveBeenCalledOnce()
  })

  it('never replays an unknown outcome without a receipt', async () => {
    const current = fixture()
    const failure = new CapabilityError('outcome_unknown', true)
    current.commitPlacement.mockRejectedValueOnce(failure)

    await expect(current.commit(locationId, { kind: 'remove' })).rejects.toBe(
      failure
    )
    expect(current.commitPlacement).toHaveBeenCalledOnce()
  })
})
