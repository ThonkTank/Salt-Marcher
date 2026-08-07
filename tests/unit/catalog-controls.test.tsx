// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render as testingRender,
  screen
} from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type {
  CreatureCatalogQuery,
  CreatureFilterOptions
} from '../../src/shared/contracts/encounter.js'
import {
  CreatureFilters,
  FilterChips
} from '../../src/renderer/features/catalog/catalog-controls.js'
import { emptyQuery } from '../../src/renderer/features/catalog/catalog-state.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'

const render = (ui: Parameters<typeof testingRender>[0]) =>
  testingRender(ui, { wrapper: ModalLayerProvider })

const options: CreatureFilterOptions = {
  challengeRatings: ['0', '1/2', '1'],
  sizes: ['Klein', 'Mittel'],
  types: ['Humanoid'],
  subtypes: ['Goblinoid'],
  biomes: [{ id: 'coastal', label: 'Küste' }],
  alignments: ['Neutral'],
  encounterTables: [{ id: 'table-1', label: 'Küstenwache' }],
  factions: [{ id: 'faction-1', label: 'Tiefenbund' }],
  locations: [{ id: 'location-1', label: 'Klippenpfad' }]
}

afterEach(cleanup)

function Harness() {
  const [query, setQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    offset: 20
  })
  return (
    <>
      <CreatureFilters
        query={query}
        options={options}
        changed={setQuery}
        clustered
      />
      <div className="filter-chips">
        <FilterChips query={query} changed={setQuery} options={options} />
      </div>
      <output data-testid="offset">{query.offset}</output>
    </>
  )
}

function CompactHarness() {
  const [query, setQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    offset: 20
  })
  return (
    <>
      <CreatureFilters query={query} options={options} changed={setQuery} />
      <div className="filter-chips">
        <FilterChips query={query} changed={setQuery} options={options} />
      </div>
      <output data-testid="offset">{query.offset}</output>
    </>
  )
}

describe('clustered creature filters', () => {
  it('adds values from closed selects and removes them through chips', () => {
    render(<Harness />)

    const size = screen.getByLabelText('Größe')
    expect(size).toHaveValue('')
    fireEvent.change(size, { target: { value: 'Klein' } })

    expect(screen.getByRole('button', { name: 'Klein ×' })).toBeInTheDocument()
    expect(size).toHaveValue('')
    expect(screen.getByTestId('offset')).toHaveTextContent('0')

    fireEvent.click(screen.getByRole('button', { name: 'Klein ×' }))
    expect(
      screen.queryByRole('button', { name: 'Klein ×' })
    ).not.toBeInTheDocument()
  })

  it('uses reference labels in active filter chips', () => {
    render(<Harness />)

    fireEvent.change(screen.getByLabelText('Tabelle'), {
      target: { value: 'table-1' }
    })
    fireEvent.change(screen.getByLabelText('Fraktion'), {
      target: { value: 'faction-1' }
    })

    expect(
      screen.getByRole('button', { name: 'Küstenwache ×' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Tiefenbund ×' })
    ).toBeInTheDocument()
  })
})

describe('searchable creature filters', () => {
  it('filters and adds categorical and reference values', () => {
    render(<CompactHarness />)

    const size = screen.getByRole('combobox', { name: 'Größe' })
    fireEvent.focus(size)
    fireEvent.change(size, { target: { value: 'kle' } })
    fireEvent.click(screen.getByRole('option', { name: 'Klein' }))
    expect(screen.getByRole('button', { name: 'Klein ×' })).toBeInTheDocument()
    expect(size).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(size, { key: 'Escape' })
    const table = screen.getByRole('combobox', { name: 'Tabelle' })
    fireEvent.focus(table)
    fireEvent.change(table, { target: { value: 'wache' } })
    fireEvent.click(screen.getByRole('option', { name: 'Küstenwache' }))
    expect(
      screen.getByRole('button', { name: 'Küstenwache ×' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('offset')).toHaveTextContent('0')
  })

  it('searches and selects one location with a readable chip', () => {
    render(<CompactHarness />)

    const location = screen.getByRole('combobox', { name: 'Ort' })
    fireEvent.focus(location)
    fireEvent.change(location, { target: { value: 'klippen' } })
    fireEvent.click(screen.getByRole('option', { name: 'Klippenpfad' }))

    expect(location).toHaveValue('Klippenpfad')
    expect(
      screen.getByRole('button', { name: 'Ort: Klippenpfad ×' })
    ).toBeInTheDocument()
  })
})
