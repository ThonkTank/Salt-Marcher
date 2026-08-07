// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HexMapDialog } from '../../src/renderer/features/hex/hex-map-dialog.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import type { HexMapSummary } from '../../src/shared/contracts/hex.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

const saved: HexMapSummary = {
  id: '01900000-0000-7000-8000-000000000082',
  displayName: 'Inseln',
  metadataRevision: 0,
  contentRevision: 0,
  position: 0
}

afterEach(cleanup)

describe('HexMapDialog', () => {
  it.each([
    {
      invocation: { kind: 'catalog' } as const,
      breadcrumb: 'Hex-Editor › Karten',
      action: 'Erstellen'
    },
    {
      invocation: { kind: 'location-link' } as const,
      breadcrumb: 'World Planner › Orte › Ort erstellen',
      action: 'Erstellen und verknüpfen'
    }
  ])(
    'derives the $invocation.kind breadcrumb and action from its invocation',
    ({ invocation, breadcrumb, action }) => {
      renderDialog(invocation)
      expect(screen.getByText(breadcrumb)).toBeVisible()
      expect(screen.getByRole('button', { name: action })).toBeVisible()
    }
  )

  it('retries only reconciliation after persistence', async () => {
    const create = vi.fn().mockResolvedValue(saved)
    const created = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('projection failed')
      })
      .mockImplementationOnce(() => undefined)
    renderDialog({ kind: 'catalog' }, create, created)
    fireEvent.change(screen.getByRole('textbox', { name: 'Kartenname' }), {
      target: { value: 'Inseln' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }))

    const retry = await screen.findByRole('button', {
      name: 'Erneut versuchen'
    })
    fireEvent.click(retry)
    await waitFor(() => expect(created).toHaveBeenCalledTimes(2))
    expect(create).toHaveBeenCalledOnce()
    expect(created).toHaveBeenNthCalledWith(2, saved)
  })

  it('reports unexpected mutation failures once and keeps expected failures local', async () => {
    const onError = vi.fn()
    const create = vi
      .fn()
      .mockRejectedValueOnce(new CapabilityError('validation_failed', false))
      .mockRejectedValueOnce(new Error('offline'))
    renderDialog({ kind: 'catalog' }, create, vi.fn(), onError)
    const name = screen.getByRole('textbox', { name: 'Kartenname' })
    fireEvent.change(name, { target: { value: 'Inseln' } })
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }))
    await screen.findByRole('alert')
    expect(onError).not.toHaveBeenCalled()

    fireEvent.change(name, { target: { value: 'Andere Inseln' } })
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }))
    await waitFor(() => expect(onError).toHaveBeenCalledOnce())
    expect(screen.getByRole('alert')).toBeVisible()
  })
})

function renderDialog(
  invocation: { kind: 'catalog' } | { kind: 'location-link' },
  create = vi.fn().mockResolvedValue(saved),
  created = vi.fn(),
  onError = vi.fn()
) {
  render(
    <ModalLayerProvider>
      <HexMapDialog
        close={vi.fn()}
        create={create}
        created={created}
        onError={onError}
        invocation={invocation}
      />
    </ModalLayerProvider>
  )
}
