// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type {
  AxialCoordinate,
  HexMapView,
  HexTerrainCatalog
} from '../../src/shared/contracts/hex.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'

const pixi = vi.hoisted(() => ({
  init: vi.fn<() => Promise<void>>(),
  destroy: vi.fn()
}))

vi.mock('pixi.js/unsafe-eval', () => ({}))
vi.mock('pixi.js', () => {
  class Container {
    position = {
      x: 0,
      y: 0,
      set: vi.fn((x: number, y: number) => {
        this.position.x = x
        this.position.y = y
      })
    }
    scale = {
      x: 1,
      y: 1,
      set: vi.fn((value: number) => {
        this.scale.x = value
        this.scale.y = value
      })
    }
    addChild = vi.fn()
    removeChild = vi.fn()
    removeChildren = vi.fn(() => [])
    destroy = vi.fn()
  }

  class Graphics {
    poly = vi.fn(() => this)
    fill = vi.fn(() => this)
    stroke = vi.fn(() => this)
    circle = vi.fn(() => this)
    moveTo = vi.fn(() => this)
    lineTo = vi.fn(() => this)
  }

  class Text {
    position = { set: vi.fn() }
  }

  class WebGLRenderer {
    canvas = document.createElement('canvas')
    init = pixi.init
    destroy = pixi.destroy
    render = vi.fn()
    resize = vi.fn()
  }

  return {
    WebGLRenderer,
    Container,
    Graphics,
    Text
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

const api = {
  runtime: {
    reportRendererIncident: vi.fn().mockResolvedValue(undefined),
    reloadRenderer: vi.fn().mockResolvedValue(undefined)
  }
} as unknown as SaltMarcherApi

function CanvasTestProvider(props: { children: ReactNode }) {
  return <CapabilityProvider api={api}>{props.children}</CapabilityProvider>
}

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
      />,
      { wrapper: CanvasTestProvider }
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die Kartenansicht konnte nicht initialisiert werden.'
    )
    expect(screen.getByRole('region', { name: 'Testkarte' })).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: 'Kartenansicht erneut laden' })
    )

    await waitFor(() => expect(pixi.init).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(view.container.querySelector('.hex-canvas canvas')).not.toBeNull()

    view.unmount()
    expect(pixi.destroy).toHaveBeenCalledTimes(2)
  })

  it('keeps one renderer when sparse map data changes', async () => {
    pixi.init.mockResolvedValue(undefined)
    const view = render(
      <HexMapCanvas
        snapshot={snapshot}
        terrains={terrains}
        selected={null}
        ariaLabel="Testkarte"
      />,
      { wrapper: CanvasTestProvider }
    )
    await waitFor(() => expect(pixi.init).toHaveBeenCalledTimes(1))

    view.rerender(
      <HexMapCanvas
        snapshot={{
          ...snapshot,
          map: { ...snapshot.map, contentRevision: 1 }
        }}
        terrains={terrains}
        selected={{ q: 1, r: 0 }}
        ariaLabel="Testkarte"
      />
    )

    await waitFor(() => expect(pixi.init).toHaveBeenCalledTimes(1))
    expect(screen.queryByLabelText('Q-Koordinate')).toBeNull()
    view.unmount()
  })

  it('supports all six axial keyboard neighbors', async () => {
    pixi.init.mockResolvedValue(undefined)
    const select = vi.fn<(coordinate: AxialCoordinate) => void>()
    const view = render(
      <HexMapCanvas
        snapshot={snapshot}
        terrains={terrains}
        selected={null}
        onTileClick={select}
        ariaLabel="Testkarte"
      />,
      { wrapper: CanvasTestProvider }
    )
    const region = await screen.findByRole('region', { name: 'Testkarte' })
    for (const key of [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'q',
      'e'
    ])
      fireEvent.keyDown(region, { key })
    expect(select.mock.calls.map(([coordinate]) => coordinate)).toEqual([
      { q: -1, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: -1 },
      { q: 0, r: 1 },
      { q: -1, r: 1 },
      { q: 1, r: -1 }
    ])
    view.unmount()
  })

  it('discards a stroke after pointer cancellation or capture loss', async () => {
    pixi.init.mockResolvedValue(undefined)
    const complete = vi.fn()
    const view = render(
      <HexMapCanvas
        snapshot={snapshot}
        terrains={terrains}
        selected={null}
        interaction="paint"
        onStrokeComplete={complete}
        ariaLabel="Testkarte"
      />,
      { wrapper: CanvasTestProvider }
    )
    await waitFor(() =>
      expect(view.container.querySelector('canvas')).not.toBeNull()
    )
    const canvas = view.container.querySelector('canvas')!
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1 })
    fireEvent.pointerCancel(canvas, { pointerId: 1 })
    fireEvent.pointerUp(canvas, { button: 0, pointerId: 1 })
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 2 })
    fireEvent(canvas, new Event('lostpointercapture'))
    fireEvent.pointerUp(canvas, { button: 0, pointerId: 2 })
    expect(complete).not.toHaveBeenCalled()
    view.unmount()
  })

  it('renders one identical custom marker projection in every canvas context', async () => {
    pixi.init.mockResolvedValue(undefined)
    const customSnapshot: HexMapView = {
      ...snapshot,
      tiles: [
        {
          id: '0:0',
          label: '0, 0',
          q: 0,
          r: 0,
          terrainId: 'grassland',
          location: {
            q: 0,
            r: 0,
            locationId: '01900000-0000-7000-8000-000000000070',
            displayName: 'Kap',
            marker: {
              revision: 1,
              title: 'Das Kap',
              symbol: {
                kind: 'custom',
                id: '01900000-0000-7000-8000-000000000071',
                viewBox: { minX: 0, minY: 0, width: 10, height: 20 },
                pathData: 'M0 20 L5 0 L10 20 Z',
                fillRule: 'evenodd'
              },
              symbolSize: 52,
              labelCurve: 8,
              labelPosition: 'both'
            }
          }
        }
      ]
    }
    const contexts = ['Editor', 'Session', 'Reise', 'Platzierung']
    const view = render(
      <>
        {contexts.map((context) => (
          <HexMapCanvas
            key={context}
            snapshot={customSnapshot}
            terrains={terrains}
            selected={null}
            ariaLabel={context}
          />
        ))}
      </>,
      { wrapper: CanvasTestProvider }
    )
    await waitFor(() => expect(pixi.init).toHaveBeenCalledTimes(4))
    const markers = [
      ...view.container.querySelectorAll<SVGPathElement>('.hex-location-symbol')
    ]
    expect(markers).toHaveLength(4)
    expect(new Set(markers.map((marker) => marker.getAttribute('d')))).toEqual(
      new Set(['M0 20 L5 0 L10 20 Z'])
    )
    const labelIds = [
      ...view.container.querySelectorAll<SVGPathElement>('path[id]')
    ].map((path) => path.id)
    expect(new Set(labelIds).size).toBe(labelIds.length)
    view.unmount()
  })
})
