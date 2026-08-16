import { describe, expect, it } from 'vitest'
import { materializeGroupRewardTreasureDraft } from '../../src/core/loot/group-reward-treasure-draft.js'
import type { GroupRewardTreasureDraft } from '../../src/shared/contracts/loot.js'
import type { GeneratedTreasure } from '../../src/shared/contracts/session-generation.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import type { CapabilityIssueCode } from '../../src/shared/errors/capability-issue.js'

const itemId = '01900000-0000-7000-8000-000000000001'
const secondItemId = '01900000-0000-7000-8000-000000000002'
const containerId = '01900000-0000-7000-8000-000000000003'

describe('group reward treasure materialization', () => {
  it('accepts only quantity and generated-container assignment changes', () => {
    const value = {
      ...draft(),
      items: [
        { ...draft().items[0]!, quantity: 7 },
        { ...draft().items[1]!, containerId }
      ]
    }

    const result = materializeGroupRewardTreasureDraft(generated(), value)

    expect(result.items).toMatchObject([
      { sourceLineId: 'source-item', quantity: 7 },
      {
        sourceLineId: 'source-item-2',
        quantity: 2,
        containerDraftId: containerId
      }
    ])
  })

  it('rejects unknown, duplicate, replaced and missing generated items', () => {
    expectIssue(
      {
        ...draft(),
        items: [{ ...draft().items[0]!, sourceLineId: 'missing' }]
      },
      'generator_item_unknown',
      ['items', itemId, 'itemReference']
    )
    expectIssue(
      {
        ...draft(),
        items: [
          draft().items[0]!,
          {
            ...draft().items[0]!,
            id: secondItemId
          }
        ]
      },
      'generator_item_duplicate',
      ['items', secondItemId, 'itemReference']
    )
    expectIssue(
      {
        ...draft(),
        items: [
          {
            ...draft().items[0]!,
            itemReference: generatedReference('replacement')
          },
          draft().items[1]!
        ]
      },
      'generator_item_unknown',
      ['items', itemId, 'itemReference']
    )
    expectIssue(
      { ...draft(), items: [draft().items[0]!] },
      'generator_item_unknown',
      ['items']
    )
    expectIssue(
      {
        ...draft(),
        items: [
          {
            ...draft().items[0]!,
            sourceLineId: null
          },
          draft().items[1]!
        ]
      },
      'generator_item_unknown',
      ['items', itemId, 'itemReference']
    )
  })

  it('rejects added, removed, duplicated or edited generated containers', () => {
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
    expectIssue(
      {
        ...draft(),
        containers: [
          {
            ...draft().containers[0]!,
            origin: {
              kind: 'catalog',
              catalogContainerId: 'container:chest'
            }
          }
        ]
      },
      'generator_container_unknown',
      ['containers', containerId, 'origin']
    )
    expectIssue({ ...draft(), containers: [] }, 'generator_container_unknown', [
      'containers'
    ])
    expectIssue(
      {
        ...draft(),
        containers: [{ ...draft().containers[0]!, name: 'Bearbeitet' }]
      },
      'generator_container_unknown',
      ['containers', containerId, 'origin']
    )
  })

  it('reports assignment and duplicate draft identities', () => {
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
    materializeGroupRewardTreasureDraft(generated(), value)
  } catch (error) {
    expect(error).toBeInstanceOf(CapabilityError)
    expect((error as CapabilityError).issues).toEqual([
      expect.objectContaining({ code, path })
    ])
    return
  }
  throw new Error(`Expected ${code}`)
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
        sourceLineId: 'source-item',
        itemReference: generatedReference('source-item'),
        quantity: 1,
        containerId
      },
      {
        id: secondItemId,
        sourceLineId: 'source-item-2',
        itemReference: generatedReference('source-item-2'),
        quantity: 2,
        containerId: null
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
      generatedItem('source-item', generatedReference('source-item'), 1),
      generatedItem('source-item-2', generatedReference('source-item-2'), 2)
    ]
  } as unknown as GeneratedTreasure
}

function generatedItem(
  id: string,
  itemReference: ReturnType<typeof generatedReference>,
  quantity: number
) {
  return {
    id,
    treasureId: 'generated-treasure',
    itemReference,
    role: 'useful' as const,
    quantity,
    containerId: id === 'source-item' ? 'source-container' : null,
    position: id === 'source-item' ? 0 : 1
  }
}

function generatedReference(id: string) {
  return {
    kind: 'generated' as const,
    runId: '01900000-0000-7000-8000-000000000099',
    definitionId: `definition:${id}`
  }
}
