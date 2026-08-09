import { describe, expect, it } from 'vitest'
import {
  partitionMonsterSource,
  reconcileMonsterSource
} from '../../src/core/encounter/combat-partition-policy.js'

const entryId = '00000000-0000-4000-8000-000000000010'
const groupId = '00000000-0000-4000-8000-000000000020'
const members = [
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000103'
]

describe('combat partition policy', () => {
  it('creates a mob with explicit provenance at the configured threshold', () => {
    expect(
      partitionMonsterSource({
        entryId,
        groupId,
        creatureId: 'wolf',
        creatureName: 'Wolf',
        initiative: 13,
        memberIds: members,
        mobThreshold: 3
      })
    ).toEqual([
      {
        kind: 'monster',
        rowId: `monster:${entryId}:mob`,
        sourceEntryId: entryId,
        partitionKind: 'mob',
        displayOrdinal: null,
        groupId,
        creatureId: 'wolf',
        name: 'Wolf',
        quantity: 3,
        memberIds: members,
        initiative: 13
      }
    ])
  })

  it('uses stable member IDs for individual rows instead of ordinals', () => {
    const sources = partitionMonsterSource({
      entryId,
      groupId,
      creatureId: 'wolf',
      creatureName: 'Wolf',
      initiative: 13,
      memberIds: members.slice(0, 2),
      mobThreshold: 3
    })

    expect(sources.map((source) => source.rowId)).toEqual(
      members.slice(0, 2).map((id) => `monster:${entryId}:member:${id}`)
    )
    expect(sources.map((source) => source.partitionKind)).toEqual([
      'individual',
      'individual'
    ])
    expect(sources.map((source) => source.displayOrdinal)).toEqual([1, 2])
  })

  it('uses individual sources when mobs are disabled and on the below-threshold edge', () => {
    for (const [memberIds, mobThreshold] of [
      [members, 0],
      [members.slice(0, 2), 3]
    ] as const) {
      const sources = partitionMonsterSource({
        entryId,
        groupId,
        creatureId: 'wolf',
        creatureName: 'Wolf',
        initiative: 13,
        memberIds,
        mobThreshold
      })
      expect(sources).toHaveLength(memberIds.length)
      expect(
        sources.every((source) => source.partitionKind === 'individual')
      ).toBe(true)
    }
    expect(
      partitionMonsterSource({
        entryId,
        groupId,
        creatureId: 'wolf',
        creatureName: 'Wolf',
        initiative: 13,
        memberIds: [...members, '00000000-0000-4000-8000-000000000104'],
        mobThreshold: 3
      })
    ).toHaveLength(1)
  })

  it('preserves a retained partition and repartitions only after none survives', () => {
    const mob = partitionMonsterSource({
      entryId,
      groupId,
      creatureId: 'wolf',
      creatureName: 'Wolf',
      initiative: 13,
      memberIds: members,
      mobThreshold: 3
    })
    const reinforcedMob = reconcileMonsterSource({
      entryId,
      groupId,
      creatureId: 'wolf',
      creatureName: 'Wolf',
      initiative: 13,
      memberIds: [members[0]!, '00000000-0000-4000-8000-000000000104'],
      mobThreshold: 3,
      previous: mob
    })
    expect(reinforcedMob).toEqual([
      expect.objectContaining({
        rowId: `monster:${entryId}:mob`,
        partitionKind: 'mob',
        quantity: 2
      })
    ])

    const individuals = partitionMonsterSource({
      entryId,
      groupId,
      creatureId: 'wolf',
      creatureName: 'Wolf',
      initiative: 13,
      memberIds: members.slice(0, 2),
      mobThreshold: 3
    })
    const reinforcedIndividuals = reconcileMonsterSource({
      entryId,
      groupId,
      creatureId: 'wolf',
      creatureName: 'Wolf',
      initiative: 13,
      memberIds: members,
      mobThreshold: 3,
      previous: individuals
    })
    expect(reinforcedIndividuals).toHaveLength(3)
    expect(
      reinforcedIndividuals.every(
        (source) => source.partitionKind === 'individual'
      )
    ).toBe(true)

    const repartitioned = reconcileMonsterSource({
      entryId,
      groupId,
      creatureId: 'wolf',
      creatureName: 'Wolf',
      initiative: 13,
      memberIds: members,
      mobThreshold: 3,
      previous: individuals.map((source) => ({
        ...source,
        memberIds: ['00000000-0000-4000-8000-000000000999']
      }))
    })
    expect(repartitioned).toEqual([
      expect.objectContaining({ partitionKind: 'mob', quantity: 3 })
    ])
  })
})
