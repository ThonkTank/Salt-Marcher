// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render as testingRender,
  screen
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SearchableSelect } from '../../src/renderer/shell/searchable-select.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import { ModalDialog } from '../../src/renderer/shell/modal-dialog.js'

const render = (ui: Parameters<typeof testingRender>[0]) =>
  testingRender(ui, { wrapper: ModalLayerProvider })

const options = [
  { id: 'coast', label: 'Küste', searchText: 'Meer' },
  { id: 'forest', label: 'Wald', searchText: 'Bäume' },
  { id: 'desert', label: 'Wüste', searchText: 'Sand' }
]

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SearchableSelect', () => {
  it('filters normalized labels and hidden search text', () => {
    render(
      <SearchableSelect
        mode="single"
        label="Ort"
        options={options}
        value={null}
        emptyText="Ort suchen"
        searchPlaceholder="Ort, Typ oder Region"
        noResultsText="Kein Treffer"
        changed={vi.fn()}
      />
    )

    const input = screen.getByRole('combobox', { name: 'Ort' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'kuste' } })
    expect(screen.getByRole('option', { name: 'Küste' })).toBeVisible()
    expect(
      screen.queryByRole('option', { name: 'Wald' })
    ).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'baume' } })
    expect(screen.getByRole('option', { name: 'Wald' })).toBeVisible()
  })

  it('selects one option with the keyboard and closes the popup', () => {
    const changed = vi.fn()
    render(
      <SearchableSelect
        mode="single"
        label="Ort"
        options={options}
        value={null}
        emptyText="Ort suchen"
        searchPlaceholder="Ort suchen"
        noResultsText="Kein Treffer"
        changed={changed}
      />
    )

    const input = screen.getByRole('combobox', { name: 'Ort' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'wald' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(changed).toHaveBeenCalledWith('forest')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('navigates options with arrow keys', () => {
    const changed = vi.fn()
    render(
      <SearchableSelect
        mode="single"
        label="Ort"
        options={options}
        value={null}
        emptyText="Ort suchen"
        searchPlaceholder="Ort suchen"
        noResultsText="Kein Treffer"
        changed={changed}
      />
    )

    const input = screen.getByRole('combobox', { name: 'Ort' })
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(changed).toHaveBeenCalledWith('forest')
  })

  it('keeps multiple selection open and toggles selected options', () => {
    const changed = vi.fn()
    const rendered = render(
      <SearchableSelect
        mode="multiple"
        label="Umgebung"
        options={options}
        values={[]}
        emptyText="Umgebung"
        selectedText={(count) => `Umgebung (${String(count)})`}
        searchPlaceholder="Umgebung durchsuchen"
        noResultsText="Kein Treffer"
        changed={changed}
      />
    )

    const input = screen.getByRole('combobox', { name: 'Umgebung' })
    fireEvent.focus(input)
    fireEvent.click(screen.getByRole('option', { name: 'Küste' }))
    expect(changed).toHaveBeenCalledWith(['coast'])
    expect(input).toHaveAttribute('aria-expanded', 'true')

    rendered.rerender(
      <SearchableSelect
        mode="multiple"
        label="Umgebung"
        options={options}
        values={['coast']}
        emptyText="Umgebung"
        selectedText={(count) => `Umgebung (${String(count)})`}
        searchPlaceholder="Umgebung durchsuchen"
        noResultsText="Kein Treffer"
        changed={changed}
      />
    )
    fireEvent.click(screen.getByRole('option', { name: 'Küste' }))
    expect(changed).toHaveBeenLastCalledWith([])
  })

  it('closes on Escape without changing the selection', () => {
    const changed = vi.fn()
    render(
      <SearchableSelect
        mode="single"
        label="Ort"
        options={options}
        value="coast"
        emptyText="Ort suchen"
        searchPlaceholder="Ort suchen"
        noResultsText="Kein Treffer"
        changed={changed}
      />
    )

    const input = screen.getByRole('combobox', { name: 'Ort' })
    expect(input).toHaveValue('Küste')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'nichts' } })
    expect(screen.getByText('Kein Treffer')).toBeVisible()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveValue('Küste')
    expect(changed).not.toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'w' })
    expect(input).toHaveValue('w')
    expect(screen.getByRole('option', { name: 'Wald' })).toBeVisible()
  })

  it('closes when the user points outside the control and popup', () => {
    render(
      <SearchableSelect
        mode="single"
        label="Ort"
        options={options}
        value={null}
        emptyText="Ort suchen"
        searchPlaceholder="Ort suchen"
        noResultsText="Kein Treffer"
        changed={vi.fn()}
      />
    )

    const input = screen.getByRole('combobox', { name: 'Ort' })
    fireEvent.focus(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    fireEvent.pointerDown(document.body)
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps a popup inside its owning modal dialog', () => {
    render(
      <ModalDialog className="editor" ariaLabel="Editor" onClose={vi.fn()}>
        <SearchableSelect
          mode="single"
          label="Ort"
          options={options}
          value={null}
          emptyText="Ort suchen"
          searchPlaceholder="Ort suchen"
          noResultsText="Kein Treffer"
          changed={vi.fn()}
        />
      </ModalDialog>
    )

    fireEvent.focus(screen.getByRole('combobox', { name: 'Ort' }))
    const dialog = screen.getByRole('dialog', { name: 'Editor' })
    expect(dialog).not.toHaveAttribute('aria-hidden')
    expect(screen.getByRole('listbox', { name: 'Ort' })).toBeVisible()
  })

  it('debounces remote option searches and renders only the returned page', async () => {
    vi.useFakeTimers()
    const searchOptions = vi
      .fn()
      .mockResolvedValue([{ id: 'custom', label: 'Kristallwald' }])
    render(
      <SearchableSelect
        mode="multiple"
        label="Biom"
        options={options}
        values={[]}
        emptyText="Biom"
        selectedText={(count) => `Biom (${String(count)})`}
        searchPlaceholder="Biom durchsuchen"
        noResultsText="Kein Treffer"
        searchOptions={searchOptions}
        changed={vi.fn()}
      />
    )

    const input = screen.getByRole('combobox', { name: 'Biom' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Kristall' } })
    expect(searchOptions).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180)
    })
    expect(searchOptions).toHaveBeenLastCalledWith('Kristall')
    expect(screen.getByRole('option', { name: 'Kristallwald' })).toBeVisible()
    expect(
      screen.queryByRole('option', { name: 'Küste' })
    ).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
