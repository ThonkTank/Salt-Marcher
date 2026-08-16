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
              itemReference: null,
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
    expect(screen.getByLabelText('Container')).toHaveAccessibleDescription(
      'Invalid'
    )
    expect(screen.getByText('Invalid')).toBeVisible()
    expect(screen.getByLabelText('Item')).not.toHaveAttribute('aria-invalid')
  })

  it('anchors row-level provenance issues on the row name control', () => {
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
          invalidField: 'Invalid origin'
        }}
        draft={{
          label: 'Fund',
          containers: [],
          items: [
            {
              draftId: 'item-a',
              itemReference: null,
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
            code: 'catalog_entry_unknown',
            path: ['items', 'item-a', 'origin'],
            parameters: { catalogId: 'missing' }
          }
        ]}
        labelChanged={vi.fn()}
        patchItem={vi.fn()}
        removeItem={vi.fn()}
        patchContainer={vi.fn()}
        removeContainer={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Item')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByLabelText('Item')).toHaveAccessibleDescription(
      'Invalid origin'
    )
  })

  it('keeps definition and removal controls fixed while quantity and packing stay editable', () => {
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
          containers: [
            {
              draftId: 'container-a',
              catalogContainerId: 'container:chest',
              name: 'Chest',
              capacity: 20
            }
          ],
          items: [
            {
              draftId: 'item-a',
              itemReference: null,
              name: 'Coin',
              quantity: 2,
              unitValueCp: 1,
              stackable: true,
              containerId: null
            },
            {
              draftId: 'item-b',
              itemReference: null,
              name: 'Ring',
              quantity: 1,
              unitValueCp: 0,
              stackable: false,
              containerId: null
            }
          ]
        }}
        labelChanged={vi.fn()}
        patchItem={vi.fn()}
        removeItem={vi.fn()}
        patchContainer={vi.fn()}
        removeContainer={vi.fn()}
        itemDefinitionReadOnly={() => true}
        itemRemovalReadOnly={() => true}
        containerDefinitionReadOnly={() => true}
        containerRemovalReadOnly={() => true}
      />
    )

    expect(screen.getByDisplayValue('Chest')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Capacity')).toHaveAttribute('readonly')
    expect(
      screen.getByRole('button', { name: 'Remove container' })
    ).toBeDisabled()
    expect(screen.getByDisplayValue('Coin')).toHaveAttribute('readonly')
    expect(screen.getAllByLabelText('Value copper')[0]).toHaveAttribute(
      'readonly'
    )
    expect(screen.getAllByLabelText('Stackable')[0]).toBeDisabled()
    expect(
      screen.getAllByRole('button', { name: 'Remove item' })[0]
    ).toBeDisabled()
    expect(screen.getAllByLabelText('Quantity')[0]).toBeEnabled()
    expect(screen.getAllByLabelText('Container').at(-1)).toBeEnabled()
  })
})
