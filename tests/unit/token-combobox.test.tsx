// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TokenCombobox } from '../../src/renderer/shell/token-combobox.js'

const suggestions = [
  { id: 'a', label: 'Alfa' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' }
]

afterEach(cleanup)

function renderCombobox(overrides: Record<string, unknown> = {}) {
  const onSelect = vi.fn()
  const onRemove = vi.fn()
  render(
    <TokenCombobox
      inputLabel="Auswahl"
      placeholder="Suchen"
      selected={[{ id: 'selected', label: 'Gewählt' }]}
      suggestions={suggestions}
      query=""
      onQueryChange={vi.fn()}
      onSelect={onSelect}
      onRemove={onRemove}
      removeLabel={(option) => `${option.label} entfernen`}
      disabled={false}
      layout="stacked"
      {...overrides}
    />
  )
  return { onSelect, onRemove }
}

describe('TokenCombobox', () => {
  it('supports arrows, Home/End, Enter and active-descendant semantics', () => {
    const fixture = renderCombobox()
    const input = screen.getByRole('combobox', { name: 'Auswahl' })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('option', { name: 'Alfa' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: 'Bravo' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    fireEvent.keyDown(input, { key: 'End' })
    expect(screen.getByRole('option', { name: 'Charlie' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    fireEvent.keyDown(input, { key: 'Home' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(fixture.onSelect).toHaveBeenCalledWith(suggestions[0])
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens upward at the last item, closes with Escape and removes the last chip', () => {
    const fixture = renderCombobox()
    const input = screen.getByRole('combobox', { name: 'Auswahl' })

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(screen.getByRole('option', { name: 'Charlie' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(fixture.onRemove).toHaveBeenCalledWith({
      id: 'selected',
      label: 'Gewählt'
    })
  })

  it('exposes busy, disabled and single-selection state without losing ARIA links', () => {
    renderCombobox({ busy: true, disabled: true, selectionMode: 'single' })
    const input = screen.getByRole('combobox', { name: 'Auswahl' })
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('aria-busy', 'true')
    expect(input).toHaveAttribute('aria-controls')
    expect(input.closest('.token-combobox')).toHaveAttribute(
      'data-selection-mode',
      'single'
    )
  })
})
