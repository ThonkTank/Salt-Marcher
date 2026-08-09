import { describe, expect, it } from 'vitest'
import {
  cardAlive,
  combatMementoSchema,
  nextCombatRevision,
  projectedCards,
  reduceCombatState,
  sortedCardIds
} from '../../src/core/encounter/combat-state-reducer.js'

const partyId = '00000000-0000-4000-8000-000000000001'
const sourceEntryId = '00000000-0000-4000-8000-000000000002'
const sceneMemberId = '00000000-0000-4000-8000-000000000003'
const presetId = '00000000-0000-4000-8000-000000000004'

function state() {
  return combatMementoSchema.parse({
    id: '00000000-0000-4000-8000-000000000005',
    revision: 4,
    phase: 'combat',
    selectedGroupIds: [],
    sources: [
      {
        kind: 'party',
        rowId: `party:${partyId}`,
        partyId,
        name: 'Ada',
        initiative: 12
      },
      {
        kind: 'monster',
        rowId: `monster:${sourceEntryId}:mob`,
        sourceEntryId,
        partitionKind: 'mob',
        displayOrdinal: null,
        groupId: null,
        creatureId: 'wolf',
        name: 'Wolf',
        quantity: 1,
        memberIds: [sceneMemberId],
        initiative: 15
      }
    ],
    combatants: [
      {
        id: partyId,
        cardId: 'party-card',
        sceneMemberId: null,
        creatureId: null,
        name: 'Ada',
        playerCharacter: true,
        currentHp: 0,
        maxHp: 12,
        armorClass: 14,
        initiative: 12,
        xp: 0,
        detail: '',
        conditions: [],
        concentrating: false,
        exhaustionLevel: 0,
        order: 0
      },
      {
        id: sceneMemberId,
        cardId: 'wolf-card',
        sceneMemberId,
        creatureId: 'wolf',
        name: 'Wolf',
        playerCharacter: false,
        currentHp: 0,
        maxHp: 11,
        armorClass: 13,
        initiative: 15,
        xp: 50,
        detail: '',
        conditions: ['poisoned'],
        concentrating: false,
        exhaustionLevel: 0,
        order: 1
      }
    ],
    turnOrder: ['wolf-card', 'party-card'],
    activeIndex: 1,
    round: 2,
    preparedWith: {
      presetId,
      presetRevision: 3,
      configHash: 'a'.repeat(64),
      mobThreshold: 3
    },
    resolution: null
  })
}

describe('combat state reducer', () => {
  it('increments immutably and preserves the prepared partition metadata', () => {
    const before = state()
    const after = nextCombatRevision(before)

    expect(after).not.toBe(before)
    expect(after.revision).toBe(5)
    expect(before.revision).toBe(4)
    expect(after.preparedWith).toEqual(before.preparedWith)
    expect(after.sources).toEqual(before.sources)
  })

  it('projects turn order and alive state without mutating combatants', () => {
    const combat = state()
    const cards = projectedCards(
      combat.combatants,
      combat.turnOrder,
      combat.activeIndex
    )

    expect(sortedCardIds(combat.combatants)).toEqual([
      'wolf-card',
      'party-card'
    ])
    expect(cardAlive(combat.combatants, 'party-card')).toBe(true)
    expect(cardAlive(combat.combatants, 'wolf-card')).toBe(false)
    expect(cards).toEqual([
      expect.objectContaining({ id: 'wolf-card', alive: false, done: true }),
      expect.objectContaining({ id: 'party-card', active: true, alive: true })
    ])
  })

  it('reduces turn and hit-point transitions immutably with history effects', () => {
    const before = state()
    const advanced = reduceCombatState(before, { kind: 'advance' })
    expect(advanced.state).toMatchObject({
      revision: 5,
      activeIndex: 1,
      round: 3
    })
    expect(advanced.history).toEqual({
      label: 'Zugfolge',
      inverse: { kind: 'turn', activeIndex: 1, round: 2 }
    })

    const alive = structuredClone(before)
    alive.combatants[1]!.currentHp = 11
    const damaged = reduceCombatState(alive, {
      kind: 'change-hp',
      cardId: 'wolf-card',
      amount: 5,
      healing: false
    })
    expect(damaged.state.combatants[1]?.currentHp).toBe(6)
    expect(alive.combatants[1]?.currentHp).toBe(11)
    expect(damaged.history?.inverse).toMatchObject({
      kind: 'member-states',
      states: [{ id: sceneMemberId, currentHp: 11 }]
    })
  })
})
