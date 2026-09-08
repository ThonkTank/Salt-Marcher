import type { SaveSceneGroupInput } from '../../../shared/contracts/scene.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { EncounterTuningOverride } from '../../../shared/contracts/encounter-tuning.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { generationSeed } from './generation-seed.js'
import { groupDraftEntries, newGroupDraftKey } from './group-draft.js'
import {
  applyCombatCommandResult,
  applySceneGroupCommandResult
} from './session-patches.js'
import type { GroupManagerCommandInput } from './group-manager-command-input.js'
import { acknowledgeGroupSave } from './group-manager-save-result.js'
import {
  createGroupManagerLootCommands,
  useGroupManagerLootCommands
} from './use-group-manager-loot-commands.js'

const tuning: EncounterTuningOverride = {
  difficulty: 'preset',
  amount: 'preset',
  balance: 'preset',
  diversity: 'preset'
}

export function createGroupManagerCommands(
  input: GroupManagerCommandInput,
  commands: AsyncCommandCoordinator
): Readonly<{
  generateRoster: (mode: 'fill' | 'replace') => Promise<void>
  generateLoot: (
    rewardEntries?: ReturnType<typeof groupDraftEntries>,
    seed?: number,
    key?: string | null
  ) => Promise<boolean>
  commitLoot: ReturnType<typeof useGroupManagerLootCommands>['commitLoot']
  save: () => Promise<LiveSessionSnapshot | null>
  archive: () => Promise<void>
  joinCombat: () => Promise<void>
  busy: boolean
  pending: boolean
}> {
  const {
    canGenerate,
    dispatch,
    entries,
    focused,
    group,
    ports,
    saved,
    selectedPersistedGroup,
    snapshot,
    state
  } = input
  const lootCommands = createGroupManagerLootCommands(input, commands)

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
      await lootCommands.generateLoot(
        groupDraftEntries(quantities, deadQuantities),
        generationSeed(ports.runtime.e2e),
        key
      )
    } else if (outcome.status === 'failure') failCommand(key, outcome.cause)
  }

  async function save(): Promise<LiveSessionSnapshot | null> {
    const key = state.activeKey
    if (!key || !validateAvailableMonster()) return null
    const request: SaveSceneGroupInput = {
      commandId: crypto.randomUUID(),
      sceneId: focused.id,
      groupId: key === newGroupDraftKey ? null : key,
      name: group.name.trim(),
      note: group.note.trim(),
      disposition: group.disposition,
      entries: [...entries],
      expectedRevision: snapshot.scene.revision,
      expectedGroupRevision: selectedPersistedGroup?.revision ?? null
    }
    const reconcile = async () => {
      const receipt = await ports.scene.groupSaveReceipt(request)
      const fresh = await ports.session.read()
      if (receipt) acknowledgeGroupSave(input, receipt)
      else
        dispatch({
          kind: 'group-message',
          key,
          message: message('group.saveNotApplied')
        })
      dispatch({
        kind: 'sync-external',
        groups:
          fresh.scene.scenes.find((scene) => scene.id === focused.id)?.groups ??
          []
      })
      return fresh
    }
    const outcome = await runCommand(
      key,
      () =>
        ports.scene.saveGroup(
          request.sceneId,
          request.groupId,
          request.name,
          request.note,
          request.disposition,
          request.entries,
          request.expectedRevision,
          request.expectedGroupRevision,
          request.commandId
        ),
      reconcile
    )
    if (!outcome) return null
    acknowledgeGroupSave(input, outcome)
    const next = applySceneGroupCommandResult(snapshot, outcome)
    saved(next)
    return next
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
    execute: () => Promise<Value>,
    reconcile?: () => Promise<LiveSessionSnapshot | null>
  ): Promise<Value | null> {
    const outcome = await commands.run({
      scope: 'group-manager.command',
      mode: 'latest-only',
      execute
    })
    if (outcome.status === 'success') return outcome.value
    if (outcome.status === 'failure') failCommand(key, outcome.cause, reconcile)
    return null
  }

  function failCommand(
    key: string,
    cause: unknown,
    reconcile?: () => Promise<LiveSessionSnapshot | null>
  ): void {
    input.failed?.(cause, reconcile)
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
    generateLoot: lootCommands.generateLoot,
    commitLoot: lootCommands.commitLoot,
    save,
    archive,
    joinCombat,
    busy: commands.hasPending(['group-manager.command', 'group-manager.loot']),
    pending: commands.hasPending([
      'group-manager.command',
      'group-manager.loot'
    ])
  }
}

function totalQuantity(quantities: Readonly<Record<string, number>>): number {
  return Object.values(quantities).reduce(
    (total, quantity) => total + quantity,
    0
  )
}

/** React-facing adapter; command construction itself owns no hooks. */
export function useGroupManagerCommands(
  input: GroupManagerCommandInput,
  commands: AsyncCommandCoordinator
) {
  return createGroupManagerCommands(input, commands)
}
