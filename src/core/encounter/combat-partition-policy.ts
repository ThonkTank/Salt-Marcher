export type MonsterSourcePartition = Readonly<{
  kind: 'monster'
  rowId: string
  sourceEntryId: string
  partitionKind: 'individual' | 'mob'
  displayOrdinal: number | null
  groupId: string | null
  creatureId: string
  name: string
  quantity: number
  memberIds: string[]
  initiative: number
}>

export function partitionMonsterSource(input: {
  entryId: string
  groupId: string | null
  creatureId: string
  creatureName: string
  initiative: number
  memberIds: readonly string[]
  mobThreshold: number
}): MonsterSourcePartition[] {
  const common = {
    kind: 'monster' as const,
    sourceEntryId: input.entryId,
    groupId: input.groupId,
    creatureId: input.creatureId,
    initiative: input.initiative
  }
  if (input.mobThreshold > 0 && input.memberIds.length >= input.mobThreshold)
    return [
      {
        ...common,
        rowId: `monster:${input.entryId}:mob`,
        partitionKind: 'mob',
        displayOrdinal: null,
        name: input.creatureName,
        quantity: input.memberIds.length,
        memberIds: [...input.memberIds]
      }
    ]
  return input.memberIds.map((memberId, index) => ({
    ...common,
    rowId: `monster:${input.entryId}:member:${memberId}`,
    partitionKind: 'individual',
    displayOrdinal: input.memberIds.length === 1 ? null : index + 1,
    name:
      input.memberIds.length === 1
        ? input.creatureName
        : `${input.creatureName} #${index + 1}`,
    quantity: 1,
    memberIds: [memberId]
  }))
}

export function reconcileMonsterSource(input: {
  entryId: string
  groupId: string | null
  creatureId: string
  creatureName: string
  initiative: number
  memberIds: readonly string[]
  mobThreshold: number
  previous: readonly MonsterSourcePartition[]
}): MonsterSourcePartition[] {
  const wanted = new Set(input.memberIds)
  const retained = input.previous
    .filter(
      (source) =>
        source.sourceEntryId === input.entryId &&
        source.creatureId === input.creatureId
    )
    .map((source) => ({
      ...source,
      memberIds: source.memberIds.filter((id) => wanted.has(id))
    }))
    .filter((source) => source.memberIds.length > 0)
    .map((source) => ({
      ...source,
      quantity: source.memberIds.length
    }))
  const retainedIds = new Set(retained.flatMap((source) => source.memberIds))
  const additions = input.memberIds.filter((id) => !retainedIds.has(id))
  const mob = retained.find((source) => source.partitionKind === 'mob')
  if (mob) {
    mob.memberIds.push(...additions)
    mob.quantity = mob.memberIds.length
    return retained
  }
  if (retained.length === 0)
    return partitionMonsterSource({
      entryId: input.entryId,
      groupId: input.groupId,
      creatureId: input.creatureId,
      creatureName: input.creatureName,
      initiative: input.initiative,
      memberIds: additions,
      mobThreshold: input.mobThreshold
    })
  return [
    ...retained,
    ...additions.map((memberId, index) => ({
      kind: 'monster' as const,
      rowId: `monster:${input.entryId}:member:${memberId}`,
      sourceEntryId: input.entryId,
      partitionKind: 'individual' as const,
      displayOrdinal:
        input.memberIds.length === 1 ? null : retained.length + index + 1,
      groupId: input.groupId,
      creatureId: input.creatureId,
      name:
        input.memberIds.length === 1
          ? input.creatureName
          : `${input.creatureName} #${retained.length + index + 1}`,
      quantity: 1,
      memberIds: [memberId],
      initiative: retained[0]?.initiative ?? input.initiative
    }))
  ]
}
