import { describe, expect, it } from 'vitest'
import {
  createWorldFactionDraftState,
  worldFactionDraftDirty,
  worldFactionDraftReducer,
  worldFactionDraftValue
} from '../../src/renderer/features/worldplanner/world-faction-draft.js'

const bearId = '01900000-0000-7000-8000-000000000020'
const wolfId = '01900000-0000-7000-8000-000000000010'

describe('World Faction draft', () => {
  it('materializes inventory in stable creature-id order', () => {
    const state = {
      ...createWorldFactionDraftState(null),
      inventory: { [bearId]: 2, [wolfId]: 4 }
    }

    expect(worldFactionDraftValue(state).inventory).toEqual([
      { creatureId: wolfId, maximum: 4 },
      { creatureId: bearId, maximum: 2 }
    ])
  })

  it('treats insertion order as irrelevant and prunes against the primary table', () => {
    const initial = createWorldFactionDraftState({
      id: '01900000-0000-7000-8000-000000000030',
      displayName: 'Bund',
      notes: '',
      disposition: 0,
      primaryEncounterTableId: null,
      position: 0,
      inventory: [
        { creatureId: bearId, maximum: 2 },
        { creatureId: wolfId, maximum: 4 }
      ]
    })
    const reordered = {
      ...initial,
      inventory: { [wolfId]: 4, [bearId]: 2 }
    }
    expect(worldFactionDraftDirty(reordered)).toBe(false)

    const pruned = worldFactionDraftReducer(reordered, {
      kind: 'primary-table',
      id: '01900000-0000-7000-8000-000000000040',
      creatureIds: new Set([wolfId])
    })
    expect(worldFactionDraftValue(pruned).inventory).toEqual([
      { creatureId: wolfId, maximum: 4 }
    ])
  })
})
