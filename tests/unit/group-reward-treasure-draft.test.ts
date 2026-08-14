import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { materializeGroupRewardTreasureDraft } from '../../src/core/loot/group-reward-treasure-draft.js'
import { createLootCatalogIndex } from '../../src/core/loot/loot-catalog-index.js'
import type { GroupRewardTreasureDraft } from '../../src/shared/contracts/loot.js'
import type { GeneratedTreasure } from '../../src/shared/contracts/session-generation.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import type { CapabilityIssueCode } from '../../src/shared/errors/capability-issue.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'

const itemId = '01900000-0000-7000-8000-000000000001'
const secondItemId = '01900000-0000-7000-8000-000000000002'
const containerId = '01900000-0000-7000-8000-000000000003'
const catalog = createLootCatalogIndex(
  new BundledEncounterCatalogProvider(
    join(process.cwd(), 'resources/sessiongeneration/catalog-2026-07-16')
  ).loadFull()
)

describe('group reward treasure materialization issues', () => {
  it('reports stable issue codes and draft-id paths for invalid generator origins', () => {
    expectIssue(
      {
        ...draft(),
        items: [
          {
            ...draft().items[0]!,
            origin: { kind: 'generator', sourceLineId: 'missing' }
          }
        ]
      },
      'generator_item_unknown',
      ['items', itemId, 'origin']
    )
    expectIssue(
      {
        ...draft(),
        items: [draft().items[0]!, { ...draft().items[0]!, id: secondItemId }]
      },
      'generator_item_duplicate',
      ['items', secondItemId, 'origin']
    )
    expectIssue(
      {
        ...draft(),
        containers: [
          {
            ...draft().containers[0]!,
            origin: { kind: 'generator', sourceContainerId: 'missing' }
          }
        ]
      },
      'generator_container_unknown',
      ['containers', containerId, 'origin']
    )
    expectIssue(
      {
        ...draft(),
        containers: [
          draft().containers[0]!,
          {
            ...draft().containers[0]!,
            id: '01900000-0000-7000-8000-000000000004'
          }
        ]
      },
      'generator_container_duplicate',
      ['containers', '01900000-0000-7000-8000-000000000004', 'origin']
    )
  })

  it('reports catalog kind, activity, visibility, assignment and identity issues', () => {
    expectIssue(catalogItem('item', 'item:missing'), 'catalog_entry_unknown', [
      'items',
      itemId,
      'origin'
    ])
    expectIssue(
      catalogItem('item', 'magic:arcana:common:bead-of-nourishment'),
      'catalog_entry_kind_mismatch',
      ['items', itemId, 'origin']
    )
    expectIssue(
      catalogItem('item', 'item:material:oil-flask'),
      'catalog_entry_inactive',
      ['items', itemId, 'origin']
    )
    expectIssue(
      {
        ...draft(),
        containers: [
          {
            ...draft().containers[0]!,
            origin: {
              kind: 'catalog',
              catalogContainerId: 'container:missing'
            }
          }
        ]
      },
      'catalog_container_unknown',
      ['containers', containerId, 'origin']
    )
    expectIssue(
      {
        ...draft(),
        containers: [
          {
            ...draft().containers[0]!,
            origin: {
              kind: 'catalog',
              catalogContainerId: 'container:pocket'
            }
          }
        ]
      },
      'catalog_container_hidden',
      ['containers', containerId, 'origin']
    )
    expectIssue(
      {
        ...draft(),
        items: [{ ...draft().items[0]!, containerId: secondItemId }]
      },
      'container_assignment_unknown',
      ['items', itemId, 'containerId']
    )
    expectIssue(
      {
        ...draft(),
        containers: [{ ...draft().containers[0]!, id: itemId }]
      },
      'duplicate_draft_id',
      ['items', itemId, 'id']
    )
  })
})

function expectIssue(
  value: GroupRewardTreasureDraft,
  code: CapabilityIssueCode,
  path: readonly string[]
): void {
  try {
    materializeGroupRewardTreasureDraft(generated(), value, catalog)
  } catch (error) {
    expect(error).toBeInstanceOf(CapabilityError)
    expect((error as CapabilityError).issues).toEqual([
      expect.objectContaining({ code, path })
    ])
    return
  }
  throw new Error(`Expected ${code}`)
}

function catalogItem(
  entryKind: 'item' | 'magic_item',
  catalogId: string
): GroupRewardTreasureDraft {
  return {
    ...draft(),
    items: [
      {
        ...draft().items[0]!,
        origin: { kind: 'catalog', entryKind, catalogId }
      }
    ]
  }
}

function draft(): GroupRewardTreasureDraft {
  return {
    label: 'Fund',
    containers: [
      {
        id: containerId,
        origin: {
          kind: 'generator',
          sourceContainerId: 'source-container'
        },
        name: 'Kiste',
        capacity: 10
      }
    ],
    items: [
      {
        id: itemId,
        origin: { kind: 'generator', sourceLineId: 'source-item' },
        name: 'Münzen',
        quantity: 1,
        unitValueCp: 1,
        stackable: true,
        containerId
      }
    ]
  }
}

function generated(): GeneratedTreasure {
  return {
    id: 'generated-treasure',
    containers: [
      {
        id: 'source-container',
        catalogContainerId: 'container:chest',
        name: 'Kiste',
        capacity: 10
      }
    ],
    items: [
      {
        id: 'source-item',
        catalogItemId: 'item:object:abacus',
        name: 'Abacus',
        quantity: 1,
        unitValueCp: 200,
        stackable: false,
        magic: false,
        rarity: null,
        curseName: null,
        containerId: 'source-container'
      }
    ]
  } as GeneratedTreasure
}
