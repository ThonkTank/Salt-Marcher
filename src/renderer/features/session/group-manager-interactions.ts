import type { Dispatch } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { SceneGroupDisposition } from '../../../shared/contracts/scene.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { GroupLootDraftCommand } from '../loot/group-loot-draft.js'
import {
  creatureFact,
  groupDraftEntries,
  type GroupDraftMutation,
  type GroupDraftState
} from './group-draft.js'
import {
  groupManagerAnyDirty,
  groupManagerCurrentLootDirty,
  type GroupDraftSession,
  type GroupManagerAction,
  type GroupManagerState
} from './group-manager-state.js'
import {
  groupManagerIntentGuard,
  groupManagerIntentNeedsConfirmation,
  type GroupManagerIntent
} from './group-manager-intent.js'
import { generationSeed } from './generation-seed.js'
import type { useGroupManagerCommands } from './use-group-manager-commands.js'
import type { GroupManagerPorts } from './use-group-manager-capability-ports.js'

export function createGroupManagerInteractions(input: {
  state: GroupManagerState
  session: GroupDraftSession | null
  group: GroupDraftState
  entries: ReturnType<typeof groupDraftEntries>
  commands: ReturnType<typeof useGroupManagerCommands>
  ports: GroupManagerPorts
  dispatch: Dispatch<GroupManagerAction>
  close: () => void
  inspect: (creature: Creature) => void
}) {
  const { commands, dispatch, entries, group, ports, session, state } = input

  function requestIntent(intent: GroupManagerIntent) {
    const guard = groupManagerIntentGuard(intent)
    if (
      groupManagerIntentNeedsConfirmation(guard, {
        anyDraft: groupManagerAnyDirty(state),
        currentLoot: groupManagerCurrentLootDirty(state)
      })
    ) {
      dispatch({ kind: 'pending-intent', pending: { intent, guard } })
      return
    }
    performIntent(intent)
  }

  function performIntent(intent: GroupManagerIntent) {
    dispatch({ kind: 'pending-intent', pending: null })
    switch (intent.kind) {
      case 'close':
        input.close()
        return
      case 'add-creature':
        addCreature(intent.creature)
        return
      case 'change-quantity':
        changeQuantity(intent.creatureId, intent.delta, intent.quantityKind)
        return
      case 'remove-creature':
        removeCreature(intent.creatureId)
        return
      case 'roster-history':
        mutateGroup({ kind: intent.direction })
        return
      case 'generate-roster':
        void commands.generateRoster(intent.mode)
        return
      case 'regenerate-loot':
        void commands.generateLoot(
          entries,
          intent.mode === 'retry'
            ? (session?.loot.seed ?? generationSeed(ports.runtime.e2e))
            : generationSeed(ports.runtime.e2e)
        )
        return
      case 'save':
        void commands.save()
        return
      case 'archive':
        void commands.archive()
        return
      case 'join-combat':
        void commands.joinCombat()
    }
  }

  function mutateGroup(mutation: GroupDraftMutation): void {
    dispatch({ kind: 'mutate-group', mutation })
  }

  function addCreature(creature: Creature): void {
    if (!session) return
    mutateGroup({
      kind: 'roster',
      update: {
        quantities: {
          ...group.quantities,
          [creature.id]: Math.min(999, (group.quantities[creature.id] ?? 0) + 1)
        },
        deadQuantities: group.deadQuantities
      }
    })
    mutateGroup({
      kind: 'facts',
      update: { ...group.facts, [creature.id]: creatureFact(creature) }
    })
  }

  function changeQuantity(
    creatureId: string,
    delta: number,
    quantityKind: 'alive' | 'dead'
  ): void {
    const current =
      quantityKind === 'alive' ? group.quantities : group.deadQuantities
    const quantity = Math.max(
      0,
      Math.min(999, (current[creatureId] ?? 0) + delta)
    )
    const next = { ...current }
    if (quantity === 0) delete next[creatureId]
    else next[creatureId] = quantity
    mutateGroup({
      kind: 'roster',
      update: {
        quantities: quantityKind === 'alive' ? next : group.quantities,
        deadQuantities: quantityKind === 'dead' ? next : group.deadQuantities
      }
    })
  }

  function removeCreature(creatureId: string): void {
    const quantities = { ...group.quantities }
    const deadQuantities = { ...group.deadQuantities }
    delete quantities[creatureId]
    delete deadQuantities[creatureId]
    mutateGroup({ kind: 'roster', update: { quantities, deadQuantities } })
  }

  async function inspectCreature(creature: Creature): Promise<void> {
    try {
      input.inspect(await ports.creatures.detail(creature.id))
    } catch (cause) {
      mutateGroup({ kind: 'message', update: capabilityErrorText(cause) })
    }
  }

  return {
    requestIntent,
    performIntent,
    mutateGroup,
    inspectCreature,
    setGroupField: <Kind extends 'name' | 'note' | 'disposition'>(
      kind: Kind,
      update: Kind extends 'disposition' ? SceneGroupDisposition : string
    ) => mutateGroup({ kind, update } as GroupDraftMutation),
    dispatchLoot: (command: GroupLootDraftCommand) => {
      if (state.activeKey)
        dispatch({ kind: 'loot-command', key: state.activeKey, command })
    },
    dispatchLootHistory: (direction: 'undo' | 'redo') => {
      if (state.activeKey)
        dispatch({ kind: 'loot-history', key: state.activeKey, direction })
    }
  }
}

export type GroupManagerInteractions = ReturnType<
  typeof createGroupManagerInteractions
>
