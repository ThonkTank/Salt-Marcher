// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopWindow } from '../../src/renderer/features/scene-desktop/desktop-window.js'
import { initialOverviewWindow } from '../../src/renderer/features/scene-desktop/desktop-state.js'

const size = { width: 900, height: 600 }
afterEach(cleanup)
function fixture() {
  const dispatch = vi.fn()
  const preview = vi.fn()
  const view = render(
    <DesktopWindow
      window={initialOverviewWindow}
      size={size}
      others={[]}
      raised
      disabled={false}
      dispatch={dispatch}
      preview={preview}
    >
      Content
    </DesktopWindow>
  )
  const header = view.container.querySelector('header')!
  Object.assign(header, {
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => false,
    releasePointerCapture: vi.fn()
  })
  return { ...view, header, dispatch, preview }
}
function pointer(target: Element, type: string, x: number, y: number) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  fireEvent(target, event)
}

describe('desktop window interaction', () => {
  it('closes arrangement choices after a selection or Escape', () => {
    const view = fixture()
    const menu = view.container.querySelector('details')!
    menu.open = true
    fireEvent.click(view.getByText('Linke Hälfte'))
    expect(menu.open).toBe(false)
    menu.open = true
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(menu.open).toBe(false)
    expect(document.activeElement).toBe(menu.querySelector('summary'))
  })

  it('offers keyboard movement, resizing and arrangement alongside window controls', () => {
    const view = fixture()
    fireEvent.keyDown(
      view.getByRole('button', { name: 'Fenster mit Pfeiltasten verschieben' }),
      { key: 'ArrowRight' }
    )
    expect(view.dispatch).toHaveBeenLastCalledWith({
      type: 'bounds',
      id: 'overview',
      bounds: { ...initialOverviewWindow.bounds, x: 30 }
    })
    fireEvent.keyDown(
      view.getByRole('button', { name: 'Fenstergröße mit Pfeiltasten ändern' }),
      { key: 'ArrowDown' }
    )
    expect(view.dispatch).toHaveBeenLastCalledWith({
      type: 'bounds',
      id: 'overview',
      bounds: { ...initialOverviewWindow.bounds, height: 440 }
    })
    fireEvent.click(view.getByText('Linke Hälfte'))
    expect(view.dispatch).toHaveBeenLastCalledWith({
      type: 'snap',
      id: 'overview',
      side: 'left'
    })
    fireEvent.click(view.getByRole('button', { name: 'Minimieren' }))
    expect(view.dispatch).toHaveBeenLastCalledWith({
      type: 'minimize',
      id: 'overview'
    })
    fireEvent.click(view.getByRole('button', { name: 'Fenster schließen' }))
    expect(view.dispatch).toHaveBeenLastCalledWith({
      type: 'close',
      id: 'overview'
    })
  })

  it('writes a drag only at completion and leaves a click without movement alone', () => {
    const view = fixture()
    pointer(view.header, 'pointerdown', 100, 100)
    pointer(view.header, 'pointerup', 100, 100)
    expect(view.dispatch).not.toHaveBeenCalled()
    pointer(view.header, 'pointerdown', 100, 100)
    pointer(view.header, 'pointermove', 160, 140)
    expect(view.dispatch).not.toHaveBeenCalled()
    pointer(view.header, 'pointerup', 160, 140)
    expect(view.dispatch).toHaveBeenCalledExactlyOnceWith({
      type: 'bounds',
      id: 'overview',
      bounds: { ...initialOverviewWindow.bounds, x: 80, y: 60 }
    })
  })

  it('previews side snapping and discards cancelled or unmounted gestures', () => {
    const view = fixture()
    pointer(view.header, 'pointerdown', 100, 100)
    pointer(view.header, 'pointermove', 10, 110)
    expect(view.preview).toHaveBeenLastCalledWith('left')
    pointer(view.header, 'pointercancel', 10, 110)
    expect(view.dispatch).not.toHaveBeenCalled()
    expect(view.preview).toHaveBeenLastCalledWith(null)
    pointer(view.header, 'pointerdown', 100, 100)
    pointer(view.header, 'pointermove', 10, 110)
    view.unmount()
    pointer(view.header, 'pointerup', 10, 110)
    expect(view.dispatch).not.toHaveBeenCalled()
  })
})
