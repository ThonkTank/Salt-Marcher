// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  HexMapView,
  HexTerrainCatalog
} from '../../src/shared/contracts/hex.js'

const pixi = vi.hoisted(() => ({
  init: vi.fn<() => Promise<void>>(),
  destroy: vi.fn()
}))

vi.mock('pixi.js/unsafe-eval', () => ({}))
vi.mock('pixi.js', () => {
  class Container {
    position = { x: 0, y: 0, set: vi.fn() }
    scale = { x: 1, y: 1, set: vi.fn() }
    addChild = vi.fn()
    destroy = vi.fn()
  }

  class Application {
    stage = new Container()
    canvas = document.createElement('canvas')
    init = pixi.init
    destroy = pixi.destroy
  }

  return {
    Application,
    Container,
    Graphics: class {},
    Text: class {}
  }
})

import { HexMapCanvas } from '../../src/renderer/features/hex/hex-map-canvas.js'

const snapshot = {
  map: {
    id: '00000000-0000-4000-8000-000000000001',
    displayName: 'Testkarte',
    metadataRevision: 0,
    contentRevision: 0,
    position: 0
  },
  center: { q: 0, r: 0 },
  tiles: []
} satisfies HexMapView

const terrains = {
  version: 'saltmarcher-v1',
  terrains: []
} as unknown as HexTerrainCatalog

describe('HexMapCanvas', () => {
  afterEach(() => {
    pixi.init.mockReset()
    pixi.destroy.mockReset()
  })

  it('retries a failed renderer initialization without losing map access', async () => {
    pixi.init
      .mockRejectedValueOnce(new Error('renderer unavailable'))
      .mockResolvedValueOnce(undefined)

    const view = render(
      <HexMapCanvas
        snapshot={snapshot}
        terrains={terrains}
        selected={null}
        ariaLabel="Testkarte"
      />
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die Kartenansicht konnte nicht initialisiert werden.'
    )
    expect(screen.getByRole('region', { name: 'Hex-Navigation' })).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: 'Kartenansicht erneut laden' })
    )

    await waitFor(() => expect(pixi.init).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(view.container.querySelector('.hex-canvas canvas')).not.toBeNull()

    view.unmount()
    expect(pixi.destroy).toHaveBeenCalledTimes(1)
  })
})
