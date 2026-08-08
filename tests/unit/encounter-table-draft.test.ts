import { describe, expect, it } from 'vitest'
import type { EncounterTable } from '../../src/shared/contracts/encounter-source.js'
import {
  createEncounterTableDraftState,
  encounterTableDraftDirty,
  encounterTableDraftReducer,
  encounterTableDraftValue
} from '../../src/renderer/features/encounter-table/encounter-table-draft.js'

const table = {
  id: '01900000-0000-7000-8000-000000000001',
  displayName: 'Küste',
  description: 'Salzige Begegnungen',
  entries: [{ creatureId: 'wolf', weight: 3 }]
} as EncounterTable

describe('encounter table draft', () => {
  it('tracks a canonical baseline and unique creature membership', () => {
    const initial = createEncounterTableDraftState(table)
    expect(encounterTableDraftDirty(initial)).toBe(false)

    const unchangedAdd = encounterTableDraftReducer(initial, {
      kind: 'add',
      creatureId: 'wolf'
    })
    expect(encounterTableDraftDirty(unchangedAdd)).toBe(false)

    const changed = encounterTableDraftReducer(unchangedAdd, {
      kind: 'add',
      creatureId: 'goblin'
    })
    expect(encounterTableDraftDirty(changed)).toBe(true)
    expect(encounterTableDraftValue(changed).entries).toEqual([
      { creatureId: 'wolf', weight: 3 },
      { creatureId: 'goblin', weight: 1 }
    ])
  })

  it('clamps weights and removes entries explicitly', () => {
    const initial = createEncounterTableDraftState(table)
    const high = encounterTableDraftReducer(initial, {
      kind: 'weight',
      creatureId: 'wolf',
      value: 20
    })
    expect(high.weights['wolf']).toBe(10)
    const low = encounterTableDraftReducer(high, {
      kind: 'weight',
      creatureId: 'wolf',
      value: 0
    })
    expect(low.weights['wolf']).toBe(1)
    const removed = encounterTableDraftReducer(low, {
      kind: 'remove',
      creatureId: 'wolf'
    })
    expect(removed.weights).toEqual({})
  })
})
