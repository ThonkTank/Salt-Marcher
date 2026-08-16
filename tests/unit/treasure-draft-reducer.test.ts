import { describe, expect, it } from 'vitest'
import { reduceTreasureDraft } from '../../src/renderer/features/loot/treasure-draft-reducer.js'
import type { EditableTreasureDraft } from '../../src/renderer/features/loot/treasure-draft.js'

const draft = (): EditableTreasureDraft => ({
  label: 'Fund',
  containers: [
    {
      draftId: 'container-a',
      catalogContainerId: null,
      name: 'Kiste',
      capacity: 10
    }
  ],
  items: [
    {
      draftId: 'item-a',
      itemReference: null,
      name: 'Münzen',
      quantity: 2,
      unitValueCp: 1,
      stackable: true,
      containerId: 'container-a'
    }
  ]
})

describe('treasure draft reducer', () => {
  it('applies shared edits and detaches assignments when removing containers', () => {
    const result = reduceTreasureDraft(
      draft(),
      { kind: 'remove-container', id: 'container-a' },
      'manual'
    )
    expect(result.containers).toEqual([])
    expect(result.items[0]!.containerId).toBeNull()
    expect(
      reduceTreasureDraft(
        result,
        { kind: 'remove-item', id: 'item-a' },
        'manual'
      )
    ).toBe(result)
  })

  it('allows free rows only under the manual policy', () => {
    const item = {
      draftId: 'item-b',
      itemReference: null,
      name: 'Seil',
      quantity: 1,
      unitValueCp: 20,
      stackable: false,
      containerId: null
    }
    expect(
      reduceTreasureDraft(draft(), { kind: 'add-item', item }, 'catalog')
    ).toEqual(draft())
    expect(
      reduceTreasureDraft(draft(), { kind: 'add-item', item }, 'manual').items
    ).toHaveLength(2)
  })
})
