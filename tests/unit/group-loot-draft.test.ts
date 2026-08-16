import { describe, expect, it } from 'vitest'
import {
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
import type { LootRarity } from '../../src/shared/contracts/loot.js'
import type { GroupRewardGeneratedRun } from '../../src/shared/contracts/session-generation.js'

const runId = '01900000-0000-7000-8000-000000000001'

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
      sourceLineId: 'treasure:1:item:1',
      itemReference: generatedReference('coins')
    })
  })

  it('keeps the generated item set and references while editing instance state', () => {
    const initial = groupLootDraftFromRun(run())
    const first = initial.items[0]!
    const second = initial.items[1]!
    let draft = patchGroupLootItem(initial, first.draftId, {
      quantity: first.quantity + 2,
      containerId: null
    })
    draft = patchGroupLootItem(draft, second.draftId, {
      containerId: initial.containers[0]!.draftId
    })

    const committed = groupLootCommitDraft(draft)
    expect(committed.items).toHaveLength(initial.items.length)
    expect(committed.items.map((item) => item.itemReference)).toEqual(
      initial.items.map((item) => item.itemReference)
    )
    expect(committed.items[0]).toMatchObject({
      quantity: first.quantity + 2,
      containerId: null
    })
    expect(committed.items[1]!.containerId).toBe(initial.containers[0]!.draftId)
  })

  it('undoes container assignment, caches dirty meaning, and evaluates budget', () => {
    const initial = groupLootDraftFromRun(run())
    const itemId = initial.items[0]!.draftId
    let history = createGroupLootDraftHistory(initial)
    history = mutateGroupLootDraft(history, {
      kind: 'patch-item',
      id: itemId,
      patch: { containerId: null }
    })
    expect(history.draft.items[0]!.containerId).toBeNull()
    expect(groupLootDraftDirty(history)).toBe(true)
    history = undoGroupLootDraft(history)
    expect(history.draft.items[0]!.containerId).toBe(
      initial.containers[0]!.draftId
    )
    history = redoGroupLootDraft(history)
    expect(history.draft.items[0]!.containerId).toBeNull()

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
    itemDefinitions: [
      definition(generatedReference('coins'), 'Coins', 1, true, false, null),
      definition(generatedReference('ring'), 'Ring', 0, false, true, 'Common')
    ],
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
            treasureId: 'treasure:1',
            itemReference: generatedReference('coins'),
            role: 'compact_value',
            quantity: 100,
            containerId: 'treasure:1:container:1',
            position: 0
          },
          {
            id: 'treasure:1:item:2',
            treasureId: 'treasure:1',
            itemReference: generatedReference('ring'),
            role: 'magic',
            quantity: 1,
            containerId: null,
            position: 1
          }
        ]
      }
    ]
  } as unknown as GroupRewardGeneratedRun
}

function generatedReference(id: string) {
  return { kind: 'generated' as const, runId, definitionId: `definition:${id}` }
}

function definition(
  reference: ReturnType<typeof generatedReference>,
  name: string,
  unitValueCp: number,
  stackable: boolean,
  magic: boolean,
  rarity: LootRarity | null
) {
  return {
    reference,
    name,
    unitValueCp,
    unitCapacity: 1,
    stackable,
    magic,
    rarity,
    curse: null,
    components: {
      baseItemId: null,
      modifierId: null,
      componentId: null,
      magicItemId: null,
      magicVariantId: null,
      spellId: null,
      enspelledRuleId: null,
      curseId: null,
      coinDenominations: []
    }
  }
}
