import type { Dispatch } from 'react'
import type { EncounterTuningOverride } from '../../../shared/contracts/encounter-tuning.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { CommitGroupRewardResult } from '../../../shared/contracts/loot.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'
import { capabilityErrorIssues } from '../../../shared/errors/capability-error.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import {
  groupLootCommitDraft,
  groupLootDraftFromRun
} from '../loot/group-loot-draft.js'
import { useAsyncCommandCoordinator } from '../shared/use-async-command-coordinator.js'
import { generationSeed } from './generation-seed.js'
import {
  groupDraftEntries,
  newGroupDraftKey,
  type GroupDraftState
} from './group-draft.js'
import type {
  GroupDraftSession,
  GroupManagerAction,
  GroupManagerState
} from './group-manager-state.js'
import {
  applyCombatCommandResult,
  applySceneGroupCommandResult
} from './session-patches.js'
import type { GroupManagerPorts } from './use-group-manager-capability-ports.js'

const tuning: EncounterTuningOverride = {
  difficulty: 'preset',
  amount: 'preset',
  balance: 'preset',
  diversity: 'preset'
}

export function useGroupManagerCommands(input: {
  snapshot: LiveSessionSnapshot
  focused: LiveSessionSnapshot['scene']['scenes'][number]
  state: GroupManagerState
  session: GroupDraftSession | null
  group: GroupDraftState
  entries: ReturnType<typeof groupDraftEntries>
  selectedPersistedGroup: SceneGroup | undefined
  rewardGroupId: string
  canGenerate: boolean
  ports: GroupManagerPorts
  dispatch: Dispatch<GroupManagerAction>
  saved: (snapshot: LiveSessionSnapshot) => void
  lootChanged: () => void
}): Readonly<{
  generateRoster: (mode: 'fill' | 'replace') => Promise<void>
  generateLoot: (
    rewardEntries?: ReturnType<typeof groupDraftEntries>,
    seed?: number,
    key?: string | null
  ) => Promise<boolean>
  commitLoot: () => Promise<CommitGroupRewardResult | null>
  save: () => Promise<void>
  archive: () => Promise<void>
  joinCombat: () => Promise<void>
  busy: boolean
}> {
  const commands = useAsyncCommandCoordinator()
  const {
    canGenerate,
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

  async function generateRoster(mode: 'fill' | 'replace'): Promise<void> {
    const key = state.activeKey
    if (!key || !canGenerate) return
    const seed = generationSeed(ports.runtime.e2e)
    const outcome = await commands.run({
      scope: 'group-manager.command',
      mode: 'latest-only',
      execute: () =>
        ports.scene.generateGroupDraft(
          focused.id,
          entries,
          mode,
          state.creatureCatalog.query,
          tuning,
          seed,
          snapshot.scene.revision
        )
    })
    if (outcome.status === 'success') {
      const quantities = Object.fromEntries(
        outcome.value.entries.map((entry) => [entry.creatureId, entry.quantity])
      )
      const deadQuantities = mode === 'fill' ? group.deadQuantities : {}
      const previousCount = totalQuantity(group.quantities)
      const nextCount = totalQuantity(quantities)
      dispatch({
        kind: 'roster-generated',
        key,
        quantities,
        deadQuantities,
        facts: Object.fromEntries(
          outcome.value.entries.map((entry) => [
            entry.creatureId,
            {
              displayName: entry.displayName,
              cr: entry.cr,
              xp: entry.xp,
              available: entry.available
            }
          ])
        ),
        evaluation: outcome.value.evaluation,
        seed,
        message: outcome.value.message,
        generationSummary: formatMessage(
          mode === 'fill' ? 'group.generatedFilled' : 'group.generatedReplaced',
          {
            count:
              mode === 'fill'
                ? Math.max(0, nextCount - previousCount)
                : nextCount
          }
        )
      })
      await generateLoot(
        groupDraftEntries(quantities, deadQuantities),
        generationSeed(ports.runtime.e2e),
        key
      )
    } else if (outcome.status === 'failure') failCommand(key, outcome.cause)
  }

  async function generateLoot(
    rewardEntries = entries,
    seed = generationSeed(ports.runtime.e2e),
    key = state.activeKey
  ): Promise<boolean> {
    if (!key || rewardEntries.length === 0) return false
    dispatch({
      kind: 'loot-request-began',
      key,
      phase: 'generating',
      seed
    })
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
      const draft = groupLootDraftFromRun(result.run, () => crypto.randomUUID())
      dispatch({
        kind: 'loot-generated',
        key,
        run: result.run,
        draft,
        seed
      })
      return true
    }
    if (outcome.status === 'failure')
      dispatch({
        kind: 'loot-failed',
        key,
        error: capabilityErrorText(outcome.cause),
        issues: capabilityErrorIssues(outcome.cause)
      })
    return false
  }

  async function commitLoot(): Promise<CommitGroupRewardResult | null> {
    const key = state.activeKey
    const run = session?.loot.run
    const treasure = run?.treasures[0]
    const history = session?.loot.history
    if (!key || !run || !history || !validateAvailableMonster()) return null
    dispatch({ kind: 'loot-request-began', key, phase: 'committing' })
    const outcome = await commands.run({
      scope: 'group-manager.loot',
      entityKey: key,
      mode: 'latest-only',
      execute: () =>
        ports.loot.commitGroupReward({
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
        })
    })
    if (outcome.status === 'success') {
      dispatch({ kind: 'loot-committed', key })
      if (outcome.value.treasure) lootChanged()
      saved(applySceneGroupCommandResult(snapshot, outcome.value.groupResult))
      return outcome.value
    }
    if (outcome.status === 'failure')
      dispatch({
        kind: 'loot-failed',
        key,
        error: capabilityErrorText(outcome.cause),
        issues: capabilityErrorIssues(outcome.cause)
      })
    return null
  }

  async function save(): Promise<void> {
    const key = state.activeKey
    if (!key || !validateAvailableMonster()) return
    const outcome = await runCommand(key, () =>
      ports.scene.saveGroup(
        focused.id,
        key === newGroupDraftKey ? null : key,
        group.name.trim(),
        group.note.trim(),
        group.disposition,
        entries,
        snapshot.scene.revision,
        selectedPersistedGroup?.revision ?? null
      )
    )
    if (outcome) saved(applySceneGroupCommandResult(snapshot, outcome))
  }

  async function archive(): Promise<void> {
    const key = state.activeKey
    if (!key || key === newGroupDraftKey || !selectedPersistedGroup) return
    const outcome = await runCommand(key, () =>
      ports.scene.setGroupArchived(
        focused.id,
        key,
        true,
        selectedPersistedGroup.revision
      )
    )
    if (outcome) saved(applySceneGroupCommandResult(snapshot, outcome))
  }

  async function joinCombat(): Promise<void> {
    const key = state.activeKey
    const combat = snapshot.combat
    if (!key || key === newGroupDraftKey || !selectedPersistedGroup || !combat)
      return
    const outcome = await runCommand(key, () =>
      ports.combat.joinGroup({
        sceneId: focused.id,
        groupId: key,
        expectedGroupRevision: selectedPersistedGroup.revision,
        expectedCombatRevision: combat.revision
      })
    )
    if (outcome) saved(applyCombatCommandResult(snapshot, outcome))
  }

  async function runCommand<Value>(
    key: string,
    execute: () => Promise<Value>
  ): Promise<Value | null> {
    const outcome = await commands.run({
      scope: 'group-manager.command',
      mode: 'latest-only',
      execute
    })
    if (outcome.status === 'success') return outcome.value
    if (outcome.status === 'failure') failCommand(key, outcome.cause)
    return null
  }

  function failCommand(key: string, cause: unknown): void {
    dispatch({
      kind: 'group-message',
      key,
      message: capabilityErrorText(cause)
    })
  }

  function validateAvailableMonster(): boolean {
    if (
      entries.length > 0 &&
      !entries.some(
        (entry) => group.facts[entry.creatureId]?.available === true
      )
    ) {
      const key = state.activeKey
      if (key)
        dispatch({
          kind: 'group-message',
          key,
          message: message('group.validation.availableMonster')
        })
      return false
    }
    return true
  }

  return {
    generateRoster,
    generateLoot,
    commitLoot,
    save,
    archive,
    joinCombat,
    busy:
      commands.state({ scope: 'group-manager.command' }).status === 'pending'
  }
}

function totalQuantity(quantities: Readonly<Record<string, number>>): number {
  return Object.values(quantities).reduce(
    (total, quantity) => total + quantity,
    0
  )
}
