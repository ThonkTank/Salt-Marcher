// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TreasureDraftFields } from '../../src/renderer/features/loot/treasure-draft-fields.js'

afterEach(cleanup)

describe('TreasureDraftFields', () => {
  it('maps structured capability issue paths to their exact field', () => {
    render(
      <TreasureDraftFields
        policy="catalog"
        messages={{
          label: 'Label',
          container: 'Container',
          capacity: 'Capacity',
          item: 'Item',
          quantity: 'Quantity',
          valueCopper: 'Value',
          valueCopperLabel: 'Value copper',
          stackable: 'Stackable',
          noContainer: 'None',
          removeContainer: 'Remove container',
          removeItem: 'Remove item',
          addContainer: 'Add container',
          addItem: 'Add item',
          invalidField: 'Invalid'
        }}
        draft={{
          label: 'Fund',
          containers: [],
          items: [
            {
              draftId: 'item-a',
              name: 'Coin',
              quantity: 1,
              unitValueCp: 1,
              stackable: true,
              containerId: null
            }
          ]
        }}
        issues={[
          {
            code: 'container_assignment_unknown',
            path: ['items', 'item-a', 'containerId'],
            parameters: { containerId: 'missing' }
          }
        ]}
        labelChanged={vi.fn()}
        patchItem={vi.fn()}
        removeItem={vi.fn()}
        patchContainer={vi.fn()}
        removeContainer={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Container')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByLabelText('Item')).not.toHaveAttribute('aria-invalid')
  })
})
