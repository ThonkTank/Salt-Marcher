// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccessibleTabs } from '../../src/renderer/features/shared/accessible-tabs.js'
import { AccessibleTruncatedText } from '../../src/renderer/features/shared/accessible-truncated-text.js'
import {
  CompactRegister,
  ExpandableRegisterRow
} from '../../src/renderer/features/shared/compact-register.js'
import { ResizeSeparator } from '../../src/renderer/features/shared/resize-separator.js'

afterEach(cleanup)

describe('session accessibility primitives', () => {
  it('moves tab selection and focus with arrows, Home and End', () => {
    function Harness() {
      const [selected, setSelected] = useState<'details' | 'map' | 'notes'>(
        'details'
      )
      return (
        <AccessibleTabs
          label="Ansicht"
          items={[
            { value: 'details', label: 'Details' },
            { value: 'map', label: 'Karte' },
            { value: 'notes', label: 'Notizen' }
          ]}
          selected={selected}
          changed={setSelected}
        >
          {selected}
        </AccessibleTabs>
      )
    }
    render(<Harness />)
    const details = screen.getByRole('tab', { name: 'Details' })
    details.focus()
    fireEvent.keyDown(details, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Karte' })).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('map')
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Notizen' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(details).toHaveFocus()
  })

  it('derives resize ARIA and keyboard behavior from the same limits', () => {
    const changed = vi.fn()
    render(
      <ResizeSeparator
        label="Breite"
        edge="right"
        value={300}
        minimum={264}
        maximum={420}
        changed={changed}
      />
    )
    const separator = screen.getByRole('separator', { name: 'Breite' })
    expect(separator).toHaveAttribute('aria-valuemin', '264')
    expect(separator).toHaveAttribute('aria-valuemax', '420')
    expect(separator).toHaveAttribute('aria-valuenow', '300')
    fireEvent.keyDown(separator, { key: 'ArrowLeft' })
    expect(changed).toHaveBeenLastCalledWith(310)
    fireEvent.keyDown(separator, { key: 'ArrowRight' })
    expect(changed).toHaveBeenLastCalledWith(290)
  })

  it('captures pointer resizing and removes global listeners on unmount', () => {
    const changed = vi.fn()
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    const view = render(
      <div>
        <ResizeSeparator
          label="Breite"
          edge="left"
          value={300}
          minimum={240}
          maximum={520}
          changed={changed}
        />
      </div>
    )
    const separator = screen.getByRole('separator', { name: 'Breite' })
    Object.assign(separator, {
      setPointerCapture,
      hasPointerCapture: () => true,
      releasePointerCapture
    })
    Object.defineProperty(separator.parentElement, 'getBoundingClientRect', {
      value: () => ({ left: 100, right: 900 })
    })
    fireEvent.pointerDown(separator, { pointerId: 7, clientX: 430 })
    expect(setPointerCapture).toHaveBeenCalledWith(7)
    expect(changed).toHaveBeenLastCalledWith(330)
    expect(add).toHaveBeenCalledWith('pointermove', expect.any(Function))
    view.unmount()
    expect(remove).toHaveBeenCalledWith('pointermove', expect.any(Function))
    expect(releasePointerCapture).toHaveBeenCalledWith(7)
  })

  it('exposes compact register headers, expansion and full truncated names', () => {
    render(
      <CompactRegister label="Gruppen" columns={['Status', 'Name', 'Zahl']}>
        <ExpandableRegisterRow
          className="group-row"
          expanded
          expandLabel="Sehr lange Gruppe zuklappen"
          toggle={vi.fn()}
          cells={[
            <span key="status">Aktiv</span>,
            <AccessibleTruncatedText
              key="name"
              value="Eine außergewöhnlich lange Gruppe"
            />
          ]}
        >
          Vollständiger Inhalt
        </ExpandableRegisterRow>
      </CompactRegister>
    )
    const table = screen.getByRole('table', { name: 'Gruppen' })
    expect(table).toHaveAttribute('aria-colcount', '3')
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(
      screen.getByLabelText('Eine außergewöhnlich lange Gruppe')
    ).toHaveAttribute('tabindex', '0')
    expect(
      screen.getByRole('button', { name: 'Sehr lange Gruppe zuklappen' })
    ).toHaveAttribute('aria-expanded', 'true')
  })
})
