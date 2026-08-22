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
import { useGroupManagerLootCommands } from './use-group-manager-loot-commands.js'

const tuning: EncounterTuningOverride = {
  difficulty: 'preset',
  amount: 'preset',
  balance: 'preset',
  diversity: 'preset'
}

export function useGroupManagerCommands(
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
  save: () => Promise<void>
  archive: () => Promise<void>
  joinCombat: () => Promise<void>
  busy: boolean
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
  const lootCommands = useGroupManagerLootCommands(input, commands)

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
    generateLoot: lootCommands.generateLoot,
    commitLoot: lootCommands.commitLoot,
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
