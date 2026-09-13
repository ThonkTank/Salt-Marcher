import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { CommitGroupEditorInput } from '../../../shared/contracts/loot.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import type { GroupManagerCommandInput } from './group-manager-command-input.js'
import { editorLootChanges } from './group-editor-loot.js'
import { acknowledgeGroupSave } from './group-manager-save-result.js'
import { applySceneGroupCommandResult } from './session-patches.js'

export async function saveGroupEditor(
  input: GroupManagerCommandInput,
  commands: AsyncCommandCoordinator
) {
  const { session, state, ports, group, snapshot } = input
  if (
    (ports.loot.scene && !session?.lootLoaded) ||
    !session ||
    session.externalConflict ||
    !state.activeKey ||
    !ports.loot.commitGroupEditor ||
    !ports.loot.groupEditorReceipt
  )
    return null
  const request: CommitGroupEditorInput = {
    commandId: crypto.randomUUID(),
    sceneId: input.focused.id,
    groupId: input.selectedPersistedGroup?.id ?? null,
    prospectiveGroupId: input.rewardGroupId,
    expectedRevision: snapshot.scene.revision,
    expectedGroupRevision: session.sourceRevision,
    name: group.name.trim(),
    note: group.note.trim(),
    disposition: group.disposition,
    entries: [...input.entries],
    treasures: session.includeLoot !== false ? editorLootChanges(session) : []
  }
  const acknowledge = (
    result: NonNullable<
      Awaited<ReturnType<NonNullable<typeof ports.loot.commitGroupEditor>>>
    >
  ) => {
    const key = acknowledgeGroupSave(input, result.groupResult)
    input.dispatch({
      kind: 'editor-loot-saved',
      discardExcluded: session.includeLoot === false,
      key,
      treasures: result.treasures
    })
    if (result.treasures.length) input.lootChanged()
  }
  const reconcile = async () => {
    const receipt = await ports.loot.groupEditorReceipt!(request)
    const fresh = await ports.session.read()
    if (receipt) acknowledge(receipt)
    return fresh
  }
  const outcome = await commands.run({
    scope: 'group-manager.command',
    entityKey: state.activeKey,
    mode: 'latest-only',
    execute: () => ports.loot.commitGroupEditor!(request)
  })
  if (outcome.status === 'success') {
    acknowledge(outcome.value)
    const next = applySceneGroupCommandResult(
      snapshot,
      outcome.value.groupResult
    )
    input.saved(next)
    return outcome.value
  }
  if (outcome.status === 'failure') {
    input.failed?.(outcome.cause, reconcile)
    input.dispatch({
      kind: 'group-message',
      key: state.activeKey,
      message: capabilityErrorText(outcome.cause)
    })
  }
  return null
}
