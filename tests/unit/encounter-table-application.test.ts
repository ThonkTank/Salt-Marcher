import { describe, expect, it, vi } from 'vitest'
import { createEncounterTableApplicationPort } from '../../src/renderer/features/encounter-table/encounter-table-application.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type {
  EncounterTable,
  EncounterTableMutationReceipt,
  EncounterTableSnapshot
} from '../../src/shared/contracts/encounter-source.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

const table: EncounterTable = {
  id: '01900000-0000-7000-8000-000000000120',
  scope: 'campaign',
  protected: false,
  displayName: 'Küstenwache',
  description: '',
  position: 0,
  entries: [{ creatureId: 'wolf', weight: 1, position: 0 }]
}
const snapshot: EncounterTableSnapshot = {
  installation: { revision: 0, tables: [], summaries: [] },
  campaign: {
    revision: 1,
    tables: [table],
    summaries: [
      {
        id: table.id,
        scope: 'campaign',
        displayName: table.displayName,
        entryCount: 1,
        challengeRatingRange: { minimum: '1/4', maximum: '1/4' },
        biomes: ['Wald']
      }
    ]
  }
}
const receipt: EncounterTableMutationReceipt = { snapshot, saved: table }
const draft = {
  displayName: table.displayName,
  description: '',
  entries: [{ creatureId: 'wolf', weight: 1 }]
}

function fixture() {
  const create = vi
    .fn<SaltMarcherApi['encounterTables']['create']>()
    .mockResolvedValue(receipt)
  const commandReceipt = vi
    .fn<SaltMarcherApi['encounterTables']['commandReceipt']>()
    .mockResolvedValue(null)
  const encounterTables = {
    read: vi.fn().mockResolvedValue({
      installation: { revision: 0, tables: [], summaries: [] },
      campaign: { revision: 0, tables: [], summaries: [] }
    }),
    create,
    update: vi.fn(),
    delete: vi.fn(),
    commandReceipt,
    onChanged: vi.fn().mockReturnValue(() => undefined)
  } as unknown as SaltMarcherApi['encounterTables']
  return {
    port: createEncounterTableApplicationPort({ encounterTables }),
    create,
    commandReceipt
  }
}

describe('EncounterTableApplicationPort', () => {
  it('owns revision and returns the exact saved table', async () => {
    const current = fixture()
    await expect(current.port.save(null, draft, 'campaign')).resolves.toEqual(
      receipt
    )
    expect(current.create).toHaveBeenCalledWith(
      expect.any(String),
      draft,
      0,
      'campaign'
    )
  })

  it('reconciles an unknown outcome without issuing a second mutation', async () => {
    const current = fixture()
    current.create.mockRejectedValueOnce(
      new CapabilityError('outcome_unknown', true)
    )
    current.commandReceipt.mockResolvedValueOnce(receipt)

    await expect(current.port.save(null, draft, 'campaign')).resolves.toEqual(
      receipt
    )
    expect(current.create).toHaveBeenCalledOnce()
    expect(current.commandReceipt).toHaveBeenCalledWith(expect.any(String))
  })

  it('does not replay when the matching receipt is absent', async () => {
    const current = fixture()
    const failure = new CapabilityError('outcome_unknown', true)
    current.create.mockRejectedValueOnce(failure)
    await expect(current.port.save(null, draft, 'campaign')).rejects.toBe(
      failure
    )
    expect(current.create).toHaveBeenCalledOnce()
  })
})
