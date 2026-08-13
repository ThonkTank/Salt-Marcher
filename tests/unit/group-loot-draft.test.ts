import { describe, expect, it } from 'vitest'
import {
  addLootCatalogEntry,
  beginGroupLootDraftTransaction,
  createGroupLootDraftHistory,
  endGroupLootDraftTransaction,
  groupLootBudget,
  groupLootCommitDraft,
  groupLootDraftDirty,
  groupLootDraftFromRun,
  mutateGroupLootDraft,
  patchGroupLootItem,
  redoGroupLootDraft,
  undoGroupLootDraft
} from '../../src/renderer/features/loot/group-loot-draft.js'
import type {
  LootCatalogEntry,
  LootRarity
} from '../../src/shared/contracts/loot.js'
import type { GroupRewardGeneratedRun } from '../../src/shared/contracts/session-generation.js'

describe('group Loot draft', () => {
  it('maps generated rows to stable draft origins and container assignments', () => {
    const draft = groupLootDraftFromRun(run())
    expect(draft.items).toHaveLength(2)
    expect(draft.containers).toHaveLength(1)
    expect(draft.items[0]!.containerId).toBe(draft.containers[0]!.draftId)
    const committed = groupLootCommitDraft(draft)
    expect(committed.label).toBe('Fund 1 · Encounter 1')
    expect(committed.containers[0]).toMatchObject({
      origin: {
        kind: 'generator',
        sourceContainerId: 'treasure:1:container:1'
      }
    })
    expect(committed.items[0]).toMatchObject({
      origin: {
        kind: 'generator',
        sourceLineId: 'treasure:1:item:1'
      }
    })
  })

  it('merges only unchanged stackable catalog rows and instances magic and containers', () => {
    let draft = groupLootDraftFromRun(run())
    draft = addLootCatalogEntry(draft, normalEntry)
    draft = addLootCatalogEntry(draft, normalEntry)
    const first = draft.items.find(
      (item) =>
        item.origin.kind === 'catalog' &&
        item.origin.catalogId === normalEntry.id
    )!
    expect(first.quantity).toBe(2)
    draft = patchGroupLootItem(draft, first.draftId, { name: 'Bearbeitet' })
    draft = addLootCatalogEntry(draft, normalEntry)
    expect(
      draft.items.filter(
        (item) =>
          item.origin.kind === 'catalog' &&
          item.origin.catalogId === normalEntry.id
      )
    ).toHaveLength(2)
    draft = addLootCatalogEntry(draft, magicEntry)
    draft = addLootCatalogEntry(draft, magicEntry)
    expect(
      draft.items.filter(
        (item) =>
          item.origin.kind === 'catalog' &&
          item.origin.catalogId === magicEntry.id
      )
    ).toHaveLength(2)
    draft = addLootCatalogEntry(draft, containerEntry)
    draft = addLootCatalogEntry(draft, containerEntry)
    expect(
      draft.containers.filter(
        (container) =>
          container.origin.kind === 'catalog' &&
          container.origin.catalogContainerId === containerEntry.id
      )
    ).toHaveLength(2)
  })

  it('undoes compound container removal, caches dirty meaning, and evaluates budget', () => {
    const initial = groupLootDraftFromRun(run())
    const containerId = initial.containers[0]!.draftId
    let history = createGroupLootDraftHistory(initial)
    history = mutateGroupLootDraft(history, {
      kind: 'remove-container',
      id: containerId
    })
    expect(history.draft.items[0]!.containerId).toBeNull()
    expect(groupLootDraftDirty(history)).toBe(true)
    history = undoGroupLootDraft(history)
    expect(history.draft.containers).toHaveLength(1)
    expect(history.draft.items[0]!.containerId).toBe(containerId)
    history = redoGroupLootDraft(history)
    expect(history.draft.containers).toHaveLength(0)

    expect(groupLootBudget(run(), initial)).toMatchObject({
      targetValueCp: 100,
      currentValueCp: 100,
      differenceCp: 0,
      status: 'within',
      magicTarget: 1,
      magicActual: 1
    })
  })

  it('coalesces one focused edit into a single undo step', () => {
    const initial = groupLootDraftFromRun(run())
    let history = createGroupLootDraftHistory(initial)
    history = beginGroupLootDraftTransaction(history, 'label')
    history = mutateGroupLootDraft(history, {
      kind: 'set-label',
      label: 'F'
    })
    history = mutateGroupLootDraft(history, {
      kind: 'set-label',
      label: 'Fund'
    })
    expect(history.past).toHaveLength(0)
    history = endGroupLootDraftTransaction(history)
    expect(history.past).toHaveLength(1)
    history = undoGroupLootDraft(history)
    expect(history.draft.label).toBe(initial.label)
  })
})

const normalEntry: LootCatalogEntry = {
  kind: 'item',
  id: 'item:test:coins',
  defaultName: 'Coins',
  type: 'currency',
  category: 'Coin',
  unitValueCp: 1,
  stackable: true,
  magic: false,
  rarity: null
}

const magicEntry: LootCatalogEntry = {
  kind: 'magic_item',
  id: 'magic:test:ring',
  defaultName: 'Magic Ring',
  type: 'Arcana',
  category: null,
  unitValueCp: 0,
  stackable: false,
  magic: true,
  rarity: 'Common'
}

const containerEntry: LootCatalogEntry = {
  kind: 'container',
  id: 'container:test:chest',
  defaultName: 'Chest',
  type: 'container',
  category: null,
  capacity: 100
}

function run(): GroupRewardGeneratedRun {
  const rarities: Record<LootRarity, number> = {
    Common: 1,
    Uncommon: 0,
    Rare: 0,
    'Very Rare': 0,
    Legendary: 0
  }
  return {
    id: '01900000-0000-7000-8000-000000000001',
    goldBudgetCp: 100,
    magicTargets: rarities,
    treasures: [
      {
        id: 'treasure:1',
        rewardChannel: 'encounter',
        anchorEncounterNumber: 1,
        containers: [
          {
            id: 'treasure:1:container:1',
            catalogContainerId: 'container:pouch',
            name: 'Pouch',
            capacity: 20,
            position: 0
          }
        ],
        items: [
          {
            id: 'treasure:1:item:1',
            catalogItemId: 'item:coins',
            name: 'Coins',
            quantity: 100,
            unitValueCp: 1,
            stackable: true,
            magic: false,
            rarity: null,
            curseName: null,
            containerId: 'treasure:1:container:1'
          },
          {
            id: 'treasure:1:item:2',
            catalogItemId: 'magic:ring',
            name: 'Ring',
            quantity: 1,
            unitValueCp: 0,
            stackable: false,
            magic: true,
            rarity: 'Common',
            curseName: null,
            containerId: null
          }
        ]
      }
    ]
  } as GroupRewardGeneratedRun
}
