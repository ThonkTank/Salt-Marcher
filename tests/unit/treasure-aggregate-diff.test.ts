import { describe, expect, it } from 'vitest'
import { buildTreasureAggregateDiff } from '../../src/core/loot/treasure-aggregate-diff.js'
import type {
  ParsedUpdateTreasureInput,
  Treasure
} from '../../src/shared/contracts/loot.js'

const ids = {
  treasure: '01900000-0000-7000-8000-000000000001',
  retainedItem: '01900000-0000-7000-8000-000000000002',
  movedItem: '01900000-0000-7000-8000-000000000003',
  deletedItem: '01900000-0000-7000-8000-000000000004',
  retainedContainer: '01900000-0000-7000-8000-000000000005',
  updatedContainer: '01900000-0000-7000-8000-000000000006',
  deletedContainer: '01900000-0000-7000-8000-000000000007',
  insertedContainer: '01900000-0000-7000-8000-000000000008'
} as const

describe('Treasure aggregate diff', () => {
  it('classifies retained, inserted, updated, deleted, and reassigned children', () => {
    const diff = buildTreasureAggregateDiff(currentTreasure(), {
      items: [
        itemDraft(ids.retainedItem, 'Münzen', 5, ids.retainedContainer),
        itemDraft(ids.movedItem, 'Polierter Rubin', 1, ids.updatedContainer),
        itemDraft(undefined, 'Neue Karte', 1, ids.insertedContainer)
      ],
      containers: [
        containerDraft(ids.retainedContainer, 'Beutel', 10),
        containerDraft(ids.updatedContainer, 'Verzierte Schatulle', 5),
        containerDraft(ids.insertedContainer, 'Kartenrolle', 3)
      ]
    })

    expect(diff.retained.map(({ draft }) => draft.id)).toEqual([
      ids.retainedItem
    ])
    expect(diff.updated.map(({ draft }) => draft.id)).toEqual([ids.movedItem])
    expect(diff.inserted).toHaveLength(1)
    expect(diff.deleted).toEqual([ids.deletedItem])
    expect(diff.retainedContainers.map(({ draft }) => draft.id)).toEqual([
      ids.retainedContainer
    ])
    expect(diff.updatedContainers.map(({ draft }) => draft.id)).toEqual([
      ids.updatedContainer
    ])
    expect(diff.insertedContainers.map(({ draft }) => draft.id)).toEqual([
      ids.insertedContainer
    ])
    expect(diff.deletedContainers).toEqual([ids.deletedContainer])
    expect(diff.containerReassignments).toEqual([
      {
        itemId: ids.movedItem,
        fromContainerId: ids.retainedContainer,
        toContainerId: ids.updatedContainer
      }
    ])
    expect(Object.isFrozen(diff)).toBe(true)
    expect(Object.isFrozen(diff.containerReassignments[0])).toBe(true)
  })

  it('protects allocated items and requires every packed edge to survive', () => {
    const current = currentTreasure()
    const base = inputFrom(current)
    expectValidationFailure(() =>
      buildTreasureAggregateDiff(current, {
        ...base,
        items: base.items.filter((item) => item.id !== ids.retainedItem)
      })
    )
    expectValidationFailure(() =>
      buildTreasureAggregateDiff(current, {
        ...base,
        items: base.items.map((item) =>
          item.id === ids.retainedItem ? { ...item, quantity: 1 } : item
        )
      })
    )
    expectValidationFailure(() =>
      buildTreasureAggregateDiff(current, {
        items: base.items,
        containers: base.containers.filter(
          (container) => container.id !== ids.retainedContainer
        )
      })
    )

    const reassigned = buildTreasureAggregateDiff(current, {
      items: base.items.map((item) =>
        item.containerId === ids.retainedContainer
          ? { ...item, containerId: ids.updatedContainer }
          : item
      ),
      containers: base.containers.filter(
        (container) => container.id !== ids.retainedContainer
      )
    })
    expect(reassigned.deletedContainers).toEqual([ids.retainedContainer])
    expect(reassigned.containerReassignments).toHaveLength(2)
  })
})

function currentTreasure(): Treasure {
  return {
    id: ids.treasure,
    revision: 2,
    label: 'Testfund',
    anchor: { kind: 'unplaced' },
    source: { kind: 'manual' },
    items: [
      item(ids.retainedItem, 'Münzen', 5, 2, ids.retainedContainer, 0),
      item(ids.movedItem, 'Rubin', 1, 0, ids.retainedContainer, 1),
      item(ids.deletedItem, 'Notiz', 1, 0, ids.deletedContainer, 2)
    ],
    containers: [
      persistedContainer(ids.retainedContainer, 'Beutel', 10, 0),
      persistedContainer(ids.updatedContainer, 'Schatulle', 5, 1),
      persistedContainer(ids.deletedContainer, 'Mappe', 2, 2)
    ],
    totalValueCp: 16,
    allocatedValueCp: 2,
    distributionState: 'partial',
    createdAt: '2026-08-09T10:00:00.000Z',
    updatedAt: '2026-08-09T10:00:00.000Z'
  }
}

function inputFrom(
  treasure: Treasure
): Pick<ParsedUpdateTreasureInput, 'items' | 'containers'> {
  return {
    items: treasure.items.map((entry) =>
      itemDraft(
        entry.id,
        entry.definition.name,
        entry.quantity,
        entry.containerId
      )
    ),
    containers: treasure.containers.map((entry) => ({
      id: entry.id,
      catalogContainerId:
        entry.provenance.kind === 'manual'
          ? null
          : entry.provenance.catalogContainerId,
      name: entry.name,
      capacity: entry.capacity
    }))
  }
}

function item(
  id: string,
  name: string,
  quantity: number,
  allocatedQuantity: number,
  containerId: string,
  position: number
) {
  return {
    id,
    provenance: { kind: 'manual' },
    itemReference: reference(name),
    definition: definition(name),
    quantity,
    allocatedQuantity,
    containerId,
    position
  } as const
}

function itemDraft(
  id: string | undefined,
  name: string,
  quantity: number,
  containerId: string | null
) {
  return {
    ...(id ? { id } : {}),
    itemReference: reference(name),
    quantity,
    containerId
  }
}

function reference(name: string) {
  return { kind: 'legacy' as const, definitionId: `test:${name}` }
}

function definition(name: string) {
  return {
    reference: reference(name),
    name,
    unitValueCp: 1,
    unitCapacity: 1,
    stackable: true,
    magic: false,
    rarity: null,
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

function containerDraft(id: string, name: string, capacity: number) {
  return { id, catalogContainerId: null, name, capacity }
}

function persistedContainer(
  id: string,
  name: string,
  capacity: number,
  position: number
) {
  return {
    ...containerDraft(id, name, capacity),
    provenance: { kind: 'manual' as const },
    position
  }
}

function expectValidationFailure(action: () => unknown): void {
  try {
    action()
    throw new Error('Expected validation failure')
  } catch (cause) {
    expect(cause).toMatchObject({ code: 'validation_failed' })
  }
}
