// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DiscardChangesDialog,
  ModalCloseButton,
  ModalDialog,
  ModalForm
} from '../../src/renderer/shell/modal-dialog.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import { AnchoredPopup } from '../../src/renderer/shell/anchored-popup.js'

function Fixture(props: { closed: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Öffnen</button>
      {open && (
        <ModalDialog
          className="test-dialog"
          ariaLabel="Testdialog"
          onClose={() => {
            props.closed()
            setOpen(false)
          }}
        >
          <button>Erste Aktion</button>
          <button>Letzte Aktion</button>
        </ModalDialog>
      )}
    </>
  )
}

describe('ModalDialog', () => {
  afterEach(cleanup)

  it('moves, traps and restores focus and closes with Escape', () => {
    const closed = vi.fn()
    render(
      <ModalLayerProvider>
        <Fixture closed={closed} />
      </ModalLayerProvider>
    )
    const opener = screen.getByRole('button', { name: 'Öffnen' })
    opener.focus()
    fireEvent.click(opener)

    expect(document.querySelector('.modal-app-root')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(document.querySelector('.modal-app-root')).toHaveAttribute('inert')

    const first = screen.getByRole('button', { name: 'Erste Aktion' })
    const last = screen.getByRole('button', { name: 'Letzte Aktion' })
    expect(first).toHaveFocus()

    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()

    fireEvent.keyDown(last, { key: 'Escape' })
    expect(closed).toHaveBeenCalledOnce()
    expect(opener).toHaveFocus()
    expect(document.querySelector('.modal-app-root')).not.toHaveAttribute(
      'aria-hidden'
    )
  })

  it('keeps only the top nested dialog modal and restores the stack focus', () => {
    function NestedFixture() {
      const [outer, setOuter] = useState(false)
      const [inner, setInner] = useState(false)
      return (
        <>
          <button onClick={() => setOuter(true)}>Außen öffnen</button>
          {outer && (
            <ModalDialog
              className="outer"
              ariaLabel="Außendialog"
              onClose={() => setOuter(false)}
            >
              <button onClick={() => setInner(true)}>Innen öffnen</button>
              <ModalCloseButton>Außen schließen</ModalCloseButton>
            </ModalDialog>
          )}
          {inner && (
            <ModalDialog
              className="inner"
              ariaLabel="Innendialog"
              onClose={() => setInner(false)}
            >
              <ModalCloseButton>Innen schließen</ModalCloseButton>
            </ModalDialog>
          )}
        </>
      )
    }

    render(
      <ModalLayerProvider>
        <NestedFixture />
      </ModalLayerProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Außen öffnen' }))
    const innerOpener = screen.getByRole('button', { name: 'Innen öffnen' })
    fireEvent.click(innerOpener)

    expect(screen.getByRole('dialog', { name: 'Innendialog' })).toHaveAttribute(
      'aria-modal',
      'true'
    )
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2)
    expect(
      document.querySelector('[aria-label="Außendialog"]')
    ).toHaveAttribute('aria-hidden', 'true')
    const backdrops = [...document.querySelectorAll('.modal-backdrop')]
    expect(backdrops).toHaveLength(2)
    expect(backdrops[0]).toHaveAttribute('data-modal-bottom', 'true')
    expect(backdrops[0]).toHaveAttribute('data-modal-depth', '1')
    expect(backdrops[1]).toHaveAttribute('data-modal-bottom', 'false')
    expect(backdrops[1]).toHaveAttribute('data-modal-depth', '0')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(
      screen.queryByRole('dialog', { name: 'Innendialog' })
    ).not.toBeInTheDocument()
    expect(innerOpener).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })

  it('applies one scrim, cumulative depth styling and top-only behavior through four layers', () => {
    function FourLayerFixture() {
      const [depth, setDepth] = useState(0)
      return (
        <>
          <button onClick={() => setDepth(1)}>Ebene 1 öffnen</button>
          {depth >= 1 && (
            <ModalDialog
              className="level-1"
              ariaLabel="Ebene 1"
              onClose={() => setDepth(0)}
            >
              <button onClick={() => setDepth(2)}>Ebene 2 öffnen</button>
            </ModalDialog>
          )}
          {depth >= 2 && (
            <ModalDialog
              className="level-2"
              ariaLabel="Ebene 2"
              onClose={() => setDepth(1)}
            >
              <button onClick={() => setDepth(3)}>Ebene 3 öffnen</button>
            </ModalDialog>
          )}
          {depth >= 3 && (
            <ModalDialog
              className="level-3"
              ariaLabel="Ebene 3"
              onClose={() => setDepth(2)}
            >
              <button onClick={() => setDepth(4)}>Ebene 4 öffnen</button>
            </ModalDialog>
          )}
          {depth >= 4 && (
            <ModalDialog
              className="level-4"
              ariaLabel="Ebene 4"
              onClose={() => setDepth(3)}
            >
              <button>Oberste Aktion</button>
            </ModalDialog>
          )}
        </>
      )
    }

    render(
      <ModalLayerProvider>
        <FourLayerFixture />
      </ModalLayerProvider>
    )
    const rootOpener = screen.getByRole('button', { name: 'Ebene 1 öffnen' })
    rootOpener.focus()
    fireEvent.click(rootOpener)
    fireEvent.click(screen.getByRole('button', { name: 'Ebene 2 öffnen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ebene 3 öffnen' }))
    const fourthOpener = screen.getByRole('button', { name: 'Ebene 4 öffnen' })
    fireEvent.click(fourthOpener)

    const backdrops = [
      ...document.querySelectorAll<HTMLElement>('.modal-backdrop')
    ]
    expect(backdrops).toHaveLength(4)
    expect(
      backdrops.filter((layer) => layer.dataset['modalBottom'] === 'true')
    ).toHaveLength(1)
    expect(backdrops.map((layer) => layer.dataset['modalDepth'])).toEqual([
      '3',
      '2',
      '1',
      '0'
    ])
    expect(
      backdrops.map((layer) =>
        layer.style.getPropertyValue('--modal-stack-offset')
      )
    ).toEqual(['33px', '22px', '11px', '0px'])
    expect(
      backdrops.map((layer) =>
        layer.style.getPropertyValue('--modal-stack-opacity')
      )
    ).toEqual(['0.5', '0.5', '0.7', '1'])
    expect(
      backdrops.filter((layer) => layer.hasAttribute('inert'))
    ).toHaveLength(3)
    expect(
      screen
        .getAllByRole('dialog', { hidden: true })
        .filter((dialog) => dialog.hasAttribute('aria-modal'))
    ).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Oberste Aktion' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(fourthOpener).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Ebene 3 öffnen' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Ebene 2 öffnen' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(rootOpener).toHaveFocus()
  })

  it('dispatches pointer and Escape through popup, alert, child and parent', () => {
    function OverlayFixture() {
      const [parent, setParent] = useState(false)
      const [child, setChild] = useState(false)
      const [alert, setAlert] = useState(false)
      const [popup, setPopup] = useState(false)
      const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
      return (
        <>
          <button onClick={() => setParent(true)}>Parent öffnen</button>
          {parent && (
            <ModalDialog
              className="parent"
              ariaLabel="Parent"
              onClose={() => setParent(false)}
            >
              <button onClick={() => setChild(true)}>Child öffnen</button>
            </ModalDialog>
          )}
          {child && (
            <ModalDialog
              className="child"
              ariaLabel="Child"
              onClose={() => setChild(false)}
            >
              <button onClick={() => setAlert(true)}>Alert öffnen</button>
            </ModalDialog>
          )}
          {alert && (
            <ModalDialog
              role="alertdialog"
              className="alert"
              ariaLabel="Alert"
              onClose={() => setAlert(false)}
            >
              <button
                ref={setAnchor}
                aria-label="Popup öffnen"
                onClick={() => setPopup(true)}
              >
                Popup öffnen
              </button>
              <AnchoredPopup
                open={popup}
                anchor={anchor}
                className="test-popup"
                onDismiss={() => setPopup(false)}
              >
                <div role="menu">Popup-Inhalt</div>
              </AnchoredPopup>
            </ModalDialog>
          )}
        </>
      )
    }

    render(
      <ModalLayerProvider>
        <OverlayFixture />
      </ModalLayerProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Parent öffnen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Child öffnen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Alert öffnen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Popup öffnen' }))
    expect(screen.getByRole('menu')).toBeVisible()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('alertdialog', { name: 'Alert' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Popup öffnen' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('alertdialog', { name: 'Alert' })).toBeVisible()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Child' })).toBeVisible()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(
      screen.queryByRole('dialog', { name: 'Child' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Parent' })).toBeVisible()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders discard confirmation as a focused alert dialog', () => {
    const cancel = vi.fn()
    const discard = vi.fn()
    render(
      <ModalLayerProvider>
        <DiscardChangesDialog
          message="Ungespeicherte Änderungen verwerfen?"
          cancelLabel="Abbrechen"
          discardLabel="Verwerfen"
          onCancel={cancel}
          onDiscard={discard}
        />
      </ModalLayerProvider>
    )

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }))
    expect(discard).toHaveBeenCalledOnce()
  })

  it('ignores Escape and common close buttons while busy', () => {
    const closed = vi.fn()
    render(
      <ModalLayerProvider>
        <ModalDialog
          className="busy-dialog"
          ariaLabel="Beschäftigt"
          onClose={closed}
          busy
        >
          <ModalCloseButton>Schließen</ModalCloseButton>
        </ModalDialog>
      </ModalLayerProvider>
    )

    const close = screen.getByRole('button', { name: 'Schließen' })
    expect(close).toBeDisabled()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(close)
    expect(closed).not.toHaveBeenCalled()
  })

  it('composes form semantics inside the stable dialog element', () => {
    const submit = vi.fn()
    render(
      <ModalLayerProvider>
        <ModalDialog
          className="form-dialog"
          ariaLabel="Formulardialog"
          onClose={vi.fn()}
        >
          <ModalForm
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <button>Speichern</button>
          </ModalForm>
        </ModalDialog>
      </ModalLayerProvider>
    )
    const dialog = screen.getByRole('dialog', { name: 'Formulardialog' })
    expect(dialog.tagName).toBe('SECTION')
    expect(dialog.querySelector('form')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(submit).toHaveBeenCalledOnce()
  })

  it('does not submit a parent modal form through a sibling child dialog', () => {
    const parentSubmit = vi.fn()
    const childSubmit = vi.fn()
    render(
      <ModalLayerProvider>
        <ModalDialog
          className="parent-form-dialog"
          ariaLabel="Elternformular"
          onClose={vi.fn()}
        >
          <ModalForm
            onSubmit={(event) => {
              event.preventDefault()
              parentSubmit()
            }}
          >
            <button>Elternaktion</button>
          </ModalForm>
        </ModalDialog>
        <ModalDialog
          className="child-form-dialog"
          ariaLabel="Kindformular"
          onClose={vi.fn()}
        >
          <ModalForm
            onSubmit={(event) => {
              event.preventDefault()
              childSubmit()
            }}
          >
            <button>Kind speichern</button>
          </ModalForm>
        </ModalDialog>
      </ModalLayerProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Kind speichern' }))

    expect(childSubmit).toHaveBeenCalledOnce()
    expect(parentSubmit).not.toHaveBeenCalled()
  })
})
