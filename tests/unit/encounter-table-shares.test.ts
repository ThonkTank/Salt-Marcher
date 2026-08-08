import { describe, expect, it } from 'vitest'
import { allocateEncounterTableShares } from '../../src/renderer/features/encounter-table/encounter-table-shares.js'

describe('allocateEncounterTableShares', () => {
  it('allocates stable integer shares that total exactly one hundred', () => {
    const result = allocateEncounterTableShares([
      { creatureId: 'a', weight: 1 },
      { creatureId: 'b', weight: 1 },
      { creatureId: 'c', weight: 1 }
    ])

    expect(result.map((entry) => entry.percent)).toEqual([34, 33, 33])
    expect(result.reduce((sum, entry) => sum + entry.percent, 0)).toBe(100)
  })

  it('uses the exact weight share for bars independently of rounded labels', () => {
    const result = allocateEncounterTableShares([
      { creatureId: 'wolf', weight: 2 },
      { creatureId: 'bear', weight: 1 }
    ])

    expect(result.find((entry) => entry.creatureId === 'wolf')).toMatchObject({
      percent: 67,
      exactPercent: 200 / 3
    })
  })

  it('breaks equal remainders by identity, independent of display order', () => {
    const first = allocateEncounterTableShares([
      { creatureId: 'b', weight: 1 },
      { creatureId: 'a', weight: 1 },
      { creatureId: 'c', weight: 1 }
    ])
    const second = allocateEncounterTableShares([
      { creatureId: 'c', weight: 1 },
      { creatureId: 'b', weight: 1 },
      { creatureId: 'a', weight: 1 }
    ])

    expect(
      Object.fromEntries(first.map((row) => [row.creatureId, row.percent]))
    ).toEqual(
      Object.fromEntries(second.map((row) => [row.creatureId, row.percent]))
    )
    expect(first.find((row) => row.creatureId === 'a')?.percent).toBe(34)
  })
})
