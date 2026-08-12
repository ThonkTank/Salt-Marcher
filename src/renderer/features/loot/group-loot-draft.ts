import type {
  GroupRewardTreasureContainerDraft,
  GroupRewardTreasureContainerOrigin,
  GroupRewardTreasureDraft,
  GroupRewardTreasureItemDraft,
  GroupRewardTreasureItemOrigin,
  LootCatalogEntry,
  LootRarity
} from '../../../shared/contracts/loot.js'
import type { GroupRewardGeneratedRun } from '../../../shared/contracts/session-generation.js'
import { generatedTreasureLabel } from './generated-loot-presenter.js'
import type {
  EditableTreasureContainer,
  EditableTreasureDraft,
  EditableTreasureItem
} from './treasure-draft.js'
import { reduceTreasureDraft } from './treasure-draft-reducer.js'

export type GroupLootDraftItem = EditableTreasureItem & {
  origin: GroupRewardTreasureItemOrigin
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
  past: readonly GroupLootDraft[]
  future: readonly GroupLootDraft[]
  transaction: Readonly<{
    key: string
    baseline: GroupLootDraft
  }> | null
}>

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
  run: GroupRewardGeneratedRun
): GroupLootDraft {
  const treasure = run.treasures[0]!
  const containerDraftIds = new Map<string, string>()
  const containers = treasure.containers.map((container) => {
    const draftId = crypto.randomUUID()
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
    return {
      draftId: crypto.randomUUID(),
      origin: { kind: 'generator' as const, sourceLineId: item.id },
      name: item.name,
      quantity: item.quantity,
      unitValueCp: item.unitValueCp,
      stackable: item.stackable,
      containerId: item.containerId
        ? (containerDraftIds.get(item.containerId) ?? null)
        : null,
      magic: item.magic,
      rarity: item.rarity,
      curseName: item.curseName,
      defaultName: item.name,
      defaultUnitValueCp: item.unitValueCp,
      defaultStackable: item.stackable
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
  update: (draft: GroupLootDraft) => GroupLootDraft
): GroupLootDraftHistory {
  const next = update(state.draft)
  if (next === state.draft) return state
  if (state.transaction)
    return {
      ...state,
      draft: next,
      future: []
    }
  return {
    ...state,
    draft: next,
    past: [...state.past, state.draft].slice(-50),
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
    transaction: { key, baseline: settled.draft }
  }
}

export function endGroupLootDraftTransaction(
  state: GroupLootDraftHistory
): GroupLootDraftHistory {
  const transaction = state.transaction
  if (!transaction) return state
  if (
    groupLootDraftSignature(transaction.baseline) ===
    groupLootDraftSignature(state.draft)
  )
    return { ...state, transaction: null }
  return {
    ...state,
    past: [...state.past, transaction.baseline].slice(-50),
    transaction: null
  }
}

export function undoGroupLootDraft(
  state: GroupLootDraftHistory
): GroupLootDraftHistory {
  const settled = endGroupLootDraftTransaction(state)
  const previous = settled.past.at(-1)
  if (!previous) return settled
  return {
    ...settled,
    draft: previous,
    past: settled.past.slice(0, -1),
    future: [settled.draft, ...settled.future]
  }
}

export function redoGroupLootDraft(
  state: GroupLootDraftHistory
): GroupLootDraftHistory {
  const settled = endGroupLootDraftTransaction(state)
  const next = settled.future[0]
  if (!next) return settled
  return {
    ...settled,
    draft: next,
    past: [...settled.past, settled.draft].slice(-50),
    future: settled.future.slice(1)
  }
}

export function addLootCatalogEntry(
  draft: GroupLootDraft,
  entry: LootCatalogEntry
): GroupLootDraft {
  if (entry.kind === 'container')
    return {
      ...draft,
      containers: [
        ...draft.containers,
        {
          draftId: crypto.randomUUID(),
          catalogContainerId: entry.id,
          origin: { kind: 'catalog', catalogContainerId: entry.id },
          name: entry.defaultName,
          capacity: entry.capacity
        }
      ]
    }

  if (entry.stackable) {
    const existing = draft.items.find(
      (item) =>
        item.origin.kind === 'catalog' &&
        item.origin.entryKind === entry.kind &&
        item.origin.catalogId === entry.id &&
        item.name === item.defaultName &&
        item.name === entry.defaultName &&
        item.unitValueCp === item.defaultUnitValueCp &&
        item.unitValueCp === entry.unitValueCp &&
        item.stackable === item.defaultStackable &&
        item.stackable === entry.stackable &&
        item.containerId === null
    )
    if (existing)
      return {
        ...draft,
        items: draft.items.map((item) =>
          item.draftId === existing.draftId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
  }

  return {
    ...draft,
    items: [
      ...draft.items,
      {
        draftId: crypto.randomUUID(),
        origin: {
          kind: 'catalog',
          entryKind: entry.kind,
          catalogId: entry.id
        },
        name: entry.defaultName,
        quantity: 1,
        unitValueCp: entry.unitValueCp,
        stackable: entry.stackable,
        containerId: null,
        magic: entry.magic,
        rarity: entry.rarity,
        curseName: null,
        defaultName: entry.defaultName,
        defaultUnitValueCp: entry.unitValueCp,
        defaultStackable: entry.stackable
      }
    ]
  }
}

export function patchGroupLootItem(
  draft: GroupLootDraft,
  id: string,
  patch: Partial<EditableTreasureItem>
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
  patch: Partial<EditableTreasureContainer>
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
      origin: item.origin,
      name: item.name,
      quantity: item.quantity,
      unitValueCp: item.unitValueCp,
      stackable: item.stackable,
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
  const currentValueCp = draft.items
    .filter((item) => !item.magic)
    .reduce((total, item) => total + item.quantity * item.unitValueCp, 0)
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
