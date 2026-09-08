import type { SceneGroupCommandResult } from '../../../shared/contracts/live-session.js'
import type { GroupManagerCommandInput } from './group-manager-command-input.js'
import { groupDraftSignature, newGroupDraftKey } from './group-draft.js'

/** Acknowledge the submitted group before publishing or closing its editor. */
export function acknowledgeGroupSave(
  input: GroupManagerCommandInput,
  result: SceneGroupCommandResult
): string {
  const key = input.state.activeKey
  if (!key) throw new Error('Saved group has no originating draft')
  const persisted =
    key === newGroupDraftKey
      ? result.scenePatch.upsertedGroups.find(
          (candidate) =>
            !input.focused.groups.some(
              (existing) => existing.id === candidate.id
            )
        )
      : result.scenePatch.upsertedGroups.find(
          (candidate) => candidate.id === key
        )
  if (!persisted)
    throw new Error('Saved group is missing from the command result')
  if (persisted.id !== key && input.state.sessions[persisted.id])
    throw new Error('Saved group would replace another open draft')
  const group = input.group
  input.dispatch({
    kind: 'group-saved',
    key,
    persisted,
    submittedSignature: groupDraftSignature(
      group.name,
      group.note,
      group.disposition,
      group.quantities,
      group.deadQuantities
    ),
    nextProspectiveGroupId: crypto.randomUUID()
  })
  return persisted.id
}
