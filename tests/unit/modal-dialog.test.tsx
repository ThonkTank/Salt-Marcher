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
})
