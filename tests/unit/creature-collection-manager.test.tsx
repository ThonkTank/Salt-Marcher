// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreatureCollectionManagerDialog } from '../../src/renderer/features/creature-collection/creature-collection.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'

describe('CreatureCollectionManagerDialog', () => {
  afterEach(cleanup)

  it('always owns every named layout area and a fixed divider', () => {
    render(
      <ModalLayerProvider>
        <CreatureCollectionManagerDialog
          title="Manager"
          closeLabel="Schließen"
          close={vi.fn()}
          catalog={<p>Katalog</p>}
          divider={{ kind: 'fixed' }}
          draft={<p>Entwurf</p>}
          footer={<span>Fußzeile</span>}
        />
      </ModalLayerProvider>
    )

    expect(
      document.querySelector('.creature-collection-catalog')
    ).toHaveTextContent('Katalog')
    expect(
      document.querySelector('.creature-collection-divider')
    ).toHaveAttribute('aria-hidden', 'true')
    expect(
      document.querySelector('.creature-collection-draft')
    ).toHaveTextContent('Entwurf')
    expect(
      document.querySelector('.creature-collection-footer')
    ).toHaveTextContent('Fußzeile')
  })

  it('renders and operates the accessible resizable divider', () => {
    const changed = vi.fn()
    render(
      <ModalLayerProvider>
        <CreatureCollectionManagerDialog
          title="Manager"
          closeLabel="Schließen"
          close={vi.fn()}
          catalog={<p>Katalog</p>}
          divider={{
            kind: 'resizable',
            value: 460,
            minimum: 400,
            maximum: 620,
            label: 'Entwurfsbreite',
            changed
          }}
          draft={<p>Entwurf</p>}
          footer={<span>Fußzeile</span>}
        />
      </ModalLayerProvider>
    )

    const divider = screen.getByRole('separator', { name: 'Entwurfsbreite' })
    expect(divider).toHaveAttribute('aria-valuenow', '460')
    fireEvent.keyDown(divider, { key: 'ArrowLeft' })
    expect(changed).toHaveBeenCalledWith(470)
  })

  it('automatically disables the common close button while busy', () => {
    const close = vi.fn()
    render(
      <ModalLayerProvider>
        <CreatureCollectionManagerDialog
          title="Manager"
          closeLabel="Schließen"
          close={close}
          busy
          catalog={<p>Katalog</p>}
          divider={{ kind: 'fixed' }}
          draft={<p>Entwurf</p>}
          footer={<span>Fußzeile</span>}
        />
      </ModalLayerProvider>
    )

    const closeButton = screen.getByRole('button', { name: 'Schließen' })
    expect(closeButton).toBeDisabled()
    fireEvent.click(closeButton)
    expect(close).not.toHaveBeenCalled()
  })
})
