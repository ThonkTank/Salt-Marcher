// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ModalDialog } from '../../src/renderer/shell/modal-dialog.js'

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
  it('moves, traps and restores focus and closes with Escape', () => {
    const closed = vi.fn()
    render(<Fixture closed={closed} />)
    const opener = screen.getByRole('button', { name: 'Öffnen' })
    opener.focus()
    fireEvent.click(opener)

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
  })
})
