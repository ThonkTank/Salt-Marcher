// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LootCatalogPane } from '../../src/renderer/features/loot/loot-catalog-pane.js'
import type { LootCatalogPage } from '../../src/shared/contracts/loot.js'

afterEach(cleanup)

const query = {
  search: '',
  types: [],
  categories: [],
  rarities: [],
  offset: 0,
  limit: 30
}

const page: LootCatalogPage = {
  runId: null,
  catalogVersion: 'catalog-test',
  catalogContentHash: 'a'.repeat(64),
  entries: [
    {
      kind: 'container',
      id: 'container:chest',
      defaultName: 'Chest',
      type: 'container',
      category: null,
      capacity: 20
    }
  ],
  total: 1,
  offset: 0,
  limit: 30,
  filterOptions: { types: ['container'], categories: [], rarities: [] }
}

describe('LootCatalogPane', () => {
  it('is searchable but has no insertion action in read-only Group mode', () => {
    const add = vi.fn()
    render(
      <LootCatalogPane
        readOnly
        query={query}
        page={page}
        error=""
        queryChanged={vi.fn()}
        add={add}
      />
    )

    expect(screen.getByText('Chest')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Chest hinzufügen' })
    ).toBeNull()
    expect(add).not.toHaveBeenCalled()
  })

  it('keeps catalog insertion available to the manual Treasure editor', () => {
    const add = vi.fn()
    render(
      <LootCatalogPane
        query={query}
        page={page}
        error=""
        queryChanged={vi.fn()}
        add={add}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Chest hinzufügen' }))
    expect(add).toHaveBeenCalledWith(page.entries[0])
  })
})
