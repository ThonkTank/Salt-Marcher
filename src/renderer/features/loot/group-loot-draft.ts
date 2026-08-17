import type {
  ItemDefinition,
  GroupRewardTreasureContainerDraft,
  GroupRewardTreasureContainerOrigin,
  GroupRewardTreasureDraft,
  GroupRewardTreasureItemDraft,
  GroupRewardTreasureItemOrigin,
  ItemReference,
  LootRarity
} from '../../../shared/contracts/loot.js'
import {
  itemDefinitionLineValueCp,
  itemReferenceKey
} from '../../../shared/values/item-definition-values.js'
import type { GroupRewardGeneratedRun } from '../../../shared/contracts/session-generation.js'
import {
  generatedItemDefinition,
  generatedTreasureLabel
} from './generated-loot-presenter.js'
import type {
  EditableTreasureContainer,
  EditableTreasureDraft,
  EditableTreasureItem
} from './treasure-draft.js'
import {
  applyTreasureDraftOperation,
  planTreasureDraftOperation,
  reduceTreasureDraft,
  type TreasureContainerPatch,
  type TreasureDraftCommand,
  type TreasureDraftOperation,
  type TreasureItemPatch
} from './treasure-draft-reducer.js'

export type GroupLootDraftItem = EditableTreasureItem & {
  origin: GroupRewardTreasureItemOrigin
  sourceLineId: string | null
  itemReference: ItemReference
  magic: boolean
  rarity: LootRarity | null
  curseName: string | null
  defaultName: string
  defaultUnitValueCp: number
  defaultStackable: boolean
}

export type GroupLootDraftContainer = EditableTreasureContainer & {
  origin: GroupRewardTreasureContainerOrigin
}

export type GroupLootDraft = EditableTreasureDraft<
  GroupLootDraftItem,
  GroupLootDraftContainer
>

export type GroupLootDraftHistory = Readonly<{
  draft: GroupLootDraft
  baseline: string
  past: readonly GroupLootDraftOperation[]
  future: readonly GroupLootDraftOperation[]
  transaction: Readonly<{
    key: string
    forward: readonly GroupLootDraftCommand[]
    backward: readonly GroupLootDraftCommand[]
  }> | null
}>

export type GroupLootDraftCommand = TreasureDraftCommand<
  GroupLootDraftItem,
  GroupLootDraftContainer
>
export type GroupLootDraftOperation = TreasureDraftOperation<
  GroupLootDraftItem,
  GroupLootDraftContainer
>

export type GroupLootBudget = Readonly<{
  targetValueCp: number
  currentValueCp: number
  differenceCp: number
  status: 'below' | 'within' | 'above'
  percentage: number
  magicTarget: number
  magicActual: number
}>

export function groupLootDraftFromRun(
  run: GroupRewardGeneratedRun,
  createId: () => string = () => crypto.randomUUID()
): GroupLootDraft {
  const treasure = run.treasures[0]
  if (!treasure)
    return {
      label: 'Kein zusätzlicher Loot',
      containers: [],
      items: []
    }
  const containerDraftIds = new Map<string, string>()
  const containers = treasure.containers.map((container) => {
    const draftId = createId()
    containerDraftIds.set(container.id, draftId)
    return {
      draftId,
      catalogContainerId: container.catalogContainerId,
      origin: {
        kind: 'generator' as const,
        sourceContainerId: container.id
      },
      name: container.name,
      capacity: container.capacity
    }
  })
  const items = treasure.items.map((item) => {
    const definition = generatedItemDefinition(run, item)
    return {
      draftId: createId(),
      origin: { kind: 'generator' as const, sourceLineId: item.id },
      sourceLineId: item.id,
      itemReference: item.itemReference,
      name: definition.name,
      quantity: item.quantity,
      unitValueCp: definition.unitValueCp,
      stackable: definition.stackable,
      containerId: item.containerId
        ? (containerDraftIds.get(item.containerId) ?? null)
        : null,
      magic: definition.magic,
      rarity: definition.rarity,
      curseName: definition.curse?.name ?? null,
      defaultName: definition.name,
      defaultUnitValueCp: definition.unitValueCp,
      defaultStackable: definition.stackable
    }
  })
  return {
    label: generatedTreasureLabel(treasure, 1),
    containers,
    items
  }
}

export function createGroupLootDraftHistory(
  draft: GroupLootDraft
): GroupLootDraftHistory {
  return {
    draft,
    baseline: groupLootDraftSignature(draft),
    past: [],
    future: [],
    transaction: null
  }
}

export function replaceGroupLootDraft(
  draft: GroupLootDraft
): GroupLootDraftHistory {
  return createGroupLootDraftHistory(draft)
}

export function mutateGroupLootDraft(
  state: GroupLootDraftHistory,
  command: GroupLootDraftCommand
): GroupLootDraftHistory {
  const operation = planTreasureDraftOperation(state.draft, command, 'catalog')
  if (!operation) return state
  const draft = applyTreasureDraftOperation(
    state.draft,
    operation,
    'forward',
    'catalog'
  )
  if (state.transaction) {
    const transaction = state.transaction
    return {
      ...state,
      draft,
      transaction: {
        ...transaction,
        forward: [...transaction.forward, ...operation.forward],
        backward: [...operation.backward, ...transaction.backward]
      },
      future: []
    }
  }
  return {
    ...state,
    draft,
    past: [...state.past, operation].slice(-50),
    future: []
  }
}

export function beginGroupLootDraftTransaction(
  state: GroupLootDraftHistory,
  key: string
): GroupLootDraftHistory {
  if (state.transaction?.key === key) return state
  const settled = endGroupLootDraftTransaction(state)
  return {
    ...settled,
    transaction: { key, forward: [], backward: [] }
  }
}

export function endGroupLootDraftTransaction(
  state: GroupLootDraftHistory
): GroupLootDraftHistory {
  const transaction = state.transaction
  if (!transaction) return state
  if (transaction.forward.length === 0) return { ...state, transaction: null }
  return {
    ...state,
    past: [
      ...state.past,
      { forward: transaction.forward, backward: transaction.backward }
    ].slice(-50),
    transaction: null
  }
}

export function undoGroupLootDraft(
  state: GroupLootDraftHistory
): GroupLootDraftHistory {
  const settled = endGroupLootDraftTransaction(state)
  const operation = settled.past.at(-1)
  if (!operation) return settled
  return {
    ...settled,
    draft: applyTreasureDraftOperation(
      settled.draft,
      operation,
      'backward',
      'catalog'
    ),
    past: settled.past.slice(0, -1),
    future: [operation, ...settled.future]
  }
}

export function redoGroupLootDraft(
  state: GroupLootDraftHistory
): GroupLootDraftHistory {
  const settled = endGroupLootDraftTransaction(state)
  const operation = settled.future[0]
  if (!operation) return settled
  return {
    ...settled,
    draft: applyTreasureDraftOperation(
      settled.draft,
      operation,
      'forward',
      'catalog'
    ),
    past: [...settled.past, operation].slice(-50),
    future: settled.future.slice(1)
  }
}

export function patchGroupLootItem(
  draft: GroupLootDraft,
  id: string,
  patch: TreasureItemPatch
): GroupLootDraft {
  return reduceTreasureDraft(
    draft,
    { kind: 'patch-item', id, patch },
    'catalog'
  )
}

export function patchGroupLootContainer(
  draft: GroupLootDraft,
  id: string,
  patch: TreasureContainerPatch
): GroupLootDraft {
  return reduceTreasureDraft(
    draft,
    { kind: 'patch-container', id, patch },
    'catalog'
  )
}

export function removeGroupLootItem(
  draft: GroupLootDraft,
  id: string
): GroupLootDraft {
  return reduceTreasureDraft(draft, { kind: 'remove-item', id }, 'catalog')
}

export function removeGroupLootContainer(
  draft: GroupLootDraft,
  id: string
): GroupLootDraft {
  return reduceTreasureDraft(draft, { kind: 'remove-container', id }, 'catalog')
}

export function groupLootCommitDraft(
  draft: GroupLootDraft
): GroupRewardTreasureDraft {
  return {
    label: draft.label,
    containers: draft.containers.map(
      (container): GroupRewardTreasureContainerDraft => ({
        id: container.draftId,
        origin: container.origin,
        name: container.name,
        capacity: container.capacity
      })
    ),
    items: draft.items.map((item): GroupRewardTreasureItemDraft => ({
      id: item.draftId,
      sourceLineId: item.sourceLineId,
      itemReference: item.itemReference,
      quantity: item.quantity,
      containerId: item.containerId
    }))
  }
}

export function groupLootDraftSignature(draft: GroupLootDraft): string {
  return JSON.stringify(groupLootCommitDraft(draft))
}

export function groupLootDraftDirty(state: GroupLootDraftHistory): boolean {
  return groupLootDraftSignature(state.draft) !== state.baseline
}

export function groupLootBudget(
  run: GroupRewardGeneratedRun,
  draft: GroupLootDraft
): GroupLootBudget {
  const definitions = new Map<string, ItemDefinition>(
    run.itemDefinitions.map((definition) => [
      itemReferenceKey(definition.reference),
      definition
    ])
  )
  const currentValueCp = draft.items
    .filter((item) => !item.magic)
    .reduce((total, item) => {
      const definition = definitions.get(itemReferenceKey(item.itemReference))
      return (
        total +
        (definition
          ? itemDefinitionLineValueCp(definition, item.quantity)
          : item.quantity * item.unitValueCp)
      )
    }, 0)
  const targetValueCp = run.goldBudgetCp
  const differenceCp = currentValueCp - targetValueCp
  const within = Math.abs(differenceCp) * 20 <= targetValueCp * 3
  const status = within ? 'within' : differenceCp < 0 ? 'below' : 'above'
  return {
    targetValueCp,
    currentValueCp,
    differenceCp,
    status,
    percentage:
      targetValueCp === 0
        ? currentValueCp === 0
          ? 0
          : 100
        : Math.min(100, Math.round((currentValueCp / targetValueCp) * 100)),
    magicTarget: Object.values(run.magicTargets).reduce(
      (total, count) => total + count,
      0
    ),
    magicActual: draft.items
      .filter((item) => item.magic)
      .reduce((total, item) => total + item.quantity, 0)
  }
}
