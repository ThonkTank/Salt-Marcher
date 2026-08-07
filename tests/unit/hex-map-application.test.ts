import { describe, expect, it, vi } from 'vitest'
import { createHexMapApplicationPort } from '../../src/renderer/features/hex/hex-map-creation-port.js'
import type {
  HexBrushStrokeResult,
  HexMapSummary
} from '../../src/shared/contracts/hex.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

const existing: HexMapSummary = {
  id: '01900000-0000-7000-8000-000000000081',
  displayName: 'Küste',
  metadataRevision: 0,
  contentRevision: 0,
  position: 0
}
const created: HexMapSummary = {
  ...existing,
  id: '01900000-0000-7000-8000-000000000082',
  displayName: 'Inseln',
  position: 1
}

function applied(
  commandId: string,
  maps: HexMapSummary[] = [created]
): HexBrushStrokeResult {
  return {
    status: 'applied',
    commandId,
    catalogRevision: 2,
    maps,
    changedChunks: [],
    history: {
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null
    },
    changed: true,
    affectedTileCount: 0,
    impact: { locations: [], journeys: [], partyMembers: [] },
    warnings: []
  }
}

function fixture() {
  const catalog = vi.fn().mockResolvedValue({ revision: 1, maps: [existing] })
  const create = vi
    .fn()
    .mockImplementation((input: { commandId: string }) =>
      Promise.resolve(applied(input.commandId))
    )
  const commandReceipt = vi.fn().mockResolvedValue(null)
  return {
    port: createHexMapApplicationPort({
      hex: { catalog, create, commandReceipt }
    } as never),
    catalog,
    create,
    commandReceipt
  }
}

describe('HexMapApplicationPort', () => {
  it('publishes the one exact map carried by the command receipt', async () => {
    const current = fixture()

    await expect(current.port.createMap('Inseln')).resolves.toMatchObject({
      saved: created,
      snapshot: { revision: 2, maps: [existing, created] }
    })
    expect(current.catalog).toHaveBeenCalledOnce()
    expect(current.create).toHaveBeenCalledOnce()
  })

  it('rejects ambiguous or already-known create receipts', async () => {
    const ambiguous = fixture()
    ambiguous.create.mockImplementationOnce((input: { commandId: string }) =>
      Promise.resolve(applied(input.commandId, [created, existing]))
    )
    await expect(ambiguous.port.createMap('Inseln')).rejects.toThrow(
      'not_exactly_one'
    )

    const known = fixture()
    known.create.mockImplementationOnce((input: { commandId: string }) =>
      Promise.resolve(applied(input.commandId, [existing]))
    )
    await expect(known.port.createMap('Küste')).rejects.toThrow(
      'not_exactly_one'
    )
  })

  it('recovers an unknown outcome by the same command receipt without replay', async () => {
    const current = fixture()
    current.create.mockRejectedValueOnce(
      new CapabilityError('outcome_unknown', true)
    )
    current.commandReceipt.mockImplementationOnce((commandId: string) =>
      Promise.resolve(applied(commandId))
    )

    await expect(current.port.createMap('Inseln')).resolves.toMatchObject({
      saved: created
    })
    expect(current.create).toHaveBeenCalledOnce()
    expect(current.commandReceipt).toHaveBeenCalledOnce()
  })
})
