import type {
  CommitGroupRewardInput,
  CommitGroupRewardResult
} from '../../../shared/contracts/loot.js'
import { capabilityErrorIssues } from '../../../shared/errors/capability-error.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { message } from '../../i18n/session-runtime.de.js'
import {
  groupLootCommitDraft,
  groupLootDraftSignature,
  groupLootDraftFromRun
} from '../loot/group-loot-draft.js'
import { generationSeed } from './generation-seed.js'
import { applySceneGroupCommandResult } from './session-patches.js'
import { acknowledgeGroupSave } from './group-manager-save-result.js'
import type { GroupManagerCommandInput } from './group-manager-command-input.js'

export function createGroupManagerLootCommands(
  input: GroupManagerCommandInput,
  commands: AsyncCommandCoordinator
): Readonly<{
  generateLoot: (
    rewardEntries?: GroupManagerCommandInput['entries'],
    seed?: number,
    key?: string | null
  ) => Promise<boolean>
  commitLoot: () => Promise<CommitGroupRewardResult | null>
}> {
  const {
    dispatch,
    entries,
    focused,
    group,
    lootChanged,
    ports,
    rewardGroupId,
    saved,
    selectedPersistedGroup,
    session,
    snapshot,
    state
  } = input

  async function generateLoot(
    rewardEntries = entries,
    seed = generationSeed(ports.runtime.e2e),
    key = state.activeKey
  ): Promise<boolean> {
    if (!key || rewardEntries.length === 0) return false
    dispatch({ kind: 'loot-request-began', key, phase: 'generating', seed })
    const outcome = await commands.run({
      scope: 'group-manager.loot',
      entityKey: key,
      mode: 'latest-only',
      execute: async () => {
        const rules = await ports.campaignRules.read()
        return ports.loot.generateForGroupDraft({
          sceneId: focused.id,
          groupId: rewardGroupId,
          expectedSceneRevision: snapshot.scene.revision,
          expectedGroupRevision: selectedPersistedGroup?.revision ?? null,
          expectedPartyRevision: snapshot.party.revision,
          expectedCampaignRulesRevision: rules.revision,
          entries: [...rewardEntries],
          seed
        })
      }
    })
    if (outcome.status === 'success') {
      const result = outcome.value
      if (result.status !== 'success') {
        dispatch({
          kind: 'loot-failed',
          key,
          error: result.issues[0]?.code ?? result.status,
          issues: []
        })
        return false
      }
      dispatch({
        kind: 'loot-generated',
        key,
        run: result.run,
        draft: groupLootDraftFromRun(result.run, () => crypto.randomUUID()),
        seed
      })
      return true
    }
    if (outcome.status === 'failure') {
      input.failed?.(outcome.cause)
      dispatch({
        kind: 'loot-failed',
        key,
        error: capabilityErrorText(outcome.cause),
        issues: capabilityErrorIssues(outcome.cause)
      })
    }
    return false
  }

  async function commitLoot(): Promise<CommitGroupRewardResult | null> {
    const key = state.activeKey
    const run = session?.loot.run
    const treasure = run?.treasures[0]
    const history = session?.loot.history
    if (!key || !run || !history || !availableMonster()) return null
    dispatch({ kind: 'loot-request-began', key, phase: 'committing' })
    const request: CommitGroupRewardInput = {
      commandId: crypto.randomUUID(),
      runId: run.id,
      generatedTreasureId: treasure?.id ?? null,
      treasureDraft: treasure ? groupLootCommitDraft(history.draft) : null,
      sceneId: focused.id,
      groupId: rewardGroupId,
      expectedSceneRevision: snapshot.scene.revision,
      expectedGroupRevision: selectedPersistedGroup?.revision ?? null,
      name: group.name.trim(),
      note: group.note.trim(),
      disposition: group.disposition,
      entries: [...entries]
    }
    const acknowledge = (result: CommitGroupRewardResult) => {
      const savedKey = acknowledgeGroupSave(input, result.groupResult)
      dispatch({
        kind: 'loot-committed',
        key: savedKey,
        runId: run.id,
        signature: groupLootDraftSignature(history.draft)
      })
      if (result.treasure) lootChanged()
    }
    const reconcile = async () => {
      const receipt = await ports.loot.groupRewardReceipt(request)
      const fresh = await ports.session.read()
      if (receipt) acknowledge(receipt)
      else {
        dispatch({
          kind: 'group-message',
          key,
          message: message('group.saveNotApplied')
        })
        dispatch({
          kind: 'loot-failed',
          key,
          error: message('group.saveNotApplied'),
          issues: []
        })
      }
      dispatch({
        kind: 'sync-external',
        groups:
          fresh.scene.scenes.find((scene) => scene.id === focused.id)?.groups ??
          []
      })
      return fresh
    }
    const outcome = await commands.run({
      scope: 'group-manager.loot',
      entityKey: key,
      mode: 'latest-only',
      execute: () => ports.loot.commitGroupReward(request)
    })
    if (outcome.status === 'success') {
      acknowledge(outcome.value)
      saved(applySceneGroupCommandResult(snapshot, outcome.value.groupResult))
      return outcome.value
    }
    if (outcome.status === 'failure') {
      input.failed?.(outcome.cause, reconcile)
      dispatch({
        kind: 'loot-failed',
        key,
        error: capabilityErrorText(outcome.cause),
        issues: capabilityErrorIssues(outcome.cause)
      })
    }
    return null
  }

  function availableMonster(): boolean {
    const available =
      entries.length === 0 ||
      entries.some((entry) => group.facts[entry.creatureId]?.available === true)
    if (!available && state.activeKey)
      dispatch({
        kind: 'group-message',
        key: state.activeKey,
        message: message('group.validation.availableMonster')
      })
    return available
  }

  return { generateLoot, commitLoot }
}

export function useGroupManagerLootCommands(
  input: GroupManagerCommandInput,
  commands: AsyncCommandCoordinator
) {
  return createGroupManagerLootCommands(input, commands)
}
