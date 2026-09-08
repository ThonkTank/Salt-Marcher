import { useState } from 'react'
import type {
  SceneGroup,
  SceneSnapshot
} from '../../../shared/contracts/scene.js'
import type { Treasure } from '../../../shared/contracts/loot.js'
import {
  sameExpansionTarget,
  type SessionExpansionTarget,
  type SessionRegisterRow
} from './session-workspace-model.js'

export function useSessionGroupController(input: {
  scene: SceneSnapshot['scenes'][number]
  groupTreasures: readonly Readonly<{
    groupId: string
    treasures: readonly Treasure[]
  }>[]
  onDelete: (group: SceneGroup) => void
}) {
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)
  const [expandedByScene, setExpandedByScene] = useState<
    Record<string, SessionExpansionTarget>
  >({})
  const activeGroups = input.scene.groups.filter((group) => !group.archived)
  const storedExpansion = expandedByScene[input.scene.id]
  const expansion: SessionExpansionTarget = validExpansion(
    storedExpansion,
    input.scene.groups
  )
    ? storedExpansion
    : activeGroups[0]
      ? { kind: 'group', groupId: activeGroups[0].id }
      : null
  const groupLoot = new Map(
    input.groupTreasures.map((entry) => [entry.groupId, entry.treasures])
  )
  const activeRows: SessionRegisterRow[] = [
    ...activeGroups.map((group) => ({
      kind: 'active-group' as const,
      key: group.id,
      sceneId: input.scene.id,
      group,
      count: group.entries.reduce((sum, entry) => sum + entry.quantity, 0),
      expanded: sameExpansionTarget(expansion, {
        kind: 'group',
        groupId: group.id
      }),
      treasures: groupLoot.get(group.id) ?? []
    }))
  ]
  const archivedRows: SessionRegisterRow[] = input.scene.groups
    .filter((group) => group.archived)
    .map((group) => ({
      kind: 'archived-group' as const,
      key: group.id,
      sceneId: input.scene.id,
      group,
      count: group.entries.reduce((sum, entry) => sum + entry.quantity, 0),
      expanded: sameExpansionTarget(expansion, {
        kind: 'group',
        groupId: group.id
      }),
      treasures: groupLoot.get(group.id) ?? [],
      deleteState: deleteGroupId === group.id ? 'confirming' : 'idle'
    }))

  return {
    activeRows,
    archivedRows,
    toggleRow: (target: Exclude<SessionExpansionTarget, null>) =>
      setExpandedByScene((current) => ({
        ...current,
        [input.scene.id]: sameExpansionTarget(expansion, target) ? null : target
      })),
    requestDelete: setDeleteGroupId,
    cancelDelete: () => setDeleteGroupId(null),
    confirmDelete: (group: SceneGroup) => {
      setDeleteGroupId(null)
      input.onDelete(group)
    }
  } as const
}

function validExpansion(
  value: SessionExpansionTarget | undefined,
  groups: readonly SceneGroup[]
): value is SessionExpansionTarget {
  return (
    value === null ||
    (value?.kind === 'group' &&
      groups.some((group) => group.id === value.groupId))
  )
}
