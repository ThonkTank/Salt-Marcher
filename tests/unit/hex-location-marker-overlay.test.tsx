// @vitest-environment jsdom

import { act, createRef } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { HexMapView } from '../../src/shared/contracts/hex.js'
import {
  markerLabelPath,
  markerSymbolTransform
} from '../../src/renderer/features/hex/hex-location-marker-geometry.js'
import {
  HexLocationMarkerOverlay,
  type HexLocationMarkerOverlayHandle
} from '../../src/renderer/features/hex/hex-location-marker-overlay.js'

const mapId = '01900000-0000-7000-8000-000000000020'
const locationId = '01900000-0000-7000-8000-000000000021'
const symbolId = '01900000-0000-7000-8000-000000000022'
const view: HexMapView = {
  map: {
    id: mapId,
    displayName: 'Küste',
    metadataRevision: 0,
    contentRevision: 0,
    position: 0
  },
  center: { q: 0, r: 0 },
  biomes: [],
  tiles: [
    {
      q: 0,
      r: 0,
      id: '0:0',
      label: '0, 0',
      biomeId: 'grassland',
      location: {
        q: 0,
        r: 0,
        locationId,
        displayName: 'Kap',
        marker: {
          revision: 2,
          title: 'Schwarzes Kap',
          symbol: {
            kind: 'custom',
            id: symbolId,
            viewBox: { minX: 0, minY: 0, width: 10, height: 20 },
            pathData: 'M0 0 L10 20 Z',
            fillRule: 'evenodd'
          },
          symbolSize: 40,
          labelCurve: 10,
          labelPosition: 'both'
        }
      }
    }
  ]
}

describe('hex location marker overlay', () => {
  it('keeps symbol and label geometry deterministic', () => {
    expect(
      markerSymbolTransform({ x: 100, y: 50 }, 40, {
        minX: 10,
        minY: 20,
        width: 20,
        height: 40
      })
    ).toBe('translate(80 30) scale(2 1) translate(-10 -20)')
    expect(markerLabelPath({ x: 100, y: 50 }, 'Kap', 40, 10, 'above')).toBe(
      'M 35 18 Q 100 -2 165 18'
    )
    expect(markerLabelPath({ x: 100, y: 50 }, 'Kap', 40, 10, 'below')).toBe(
      'M 35 96 Q 100 116 165 96'
    )
  })

  it('renders complete custom markers with collision-free text-path IDs', () => {
    const first = render(<HexLocationMarkerOverlay snapshot={view} />)
    const second = render(<HexLocationMarkerOverlay snapshot={view} />)
    const firstIds = [...first.container.querySelectorAll('path[id]')].map(
      (path) => path.id
    )
    const secondIds = [...second.container.querySelectorAll('path[id]')].map(
      (path) => path.id
    )

    expect(firstIds).toHaveLength(2)
    expect(secondIds).toHaveLength(2)
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false)
    expect(
      first.container.querySelector('.hex-location-symbol')
    ).toHaveAttribute('d', 'M0 0 L10 20 Z')
    expect(
      first.container.querySelector('.hex-location-symbol')
    ).toHaveAttribute('fill-rule', 'evenodd')
    expect(first.container.querySelectorAll('textPath')).toHaveLength(2)
  })

  it('moves the outer SVG camera imperatively without changing marker data', () => {
    const reference = createRef<HexLocationMarkerOverlayHandle>()
    const rendered = render(
      <HexLocationMarkerOverlay ref={reference} snapshot={view} />
    )
    const markerBefore = rendered.container
      .querySelector('.hex-location-symbol')
      ?.getAttribute('d')
    act(() =>
      reference.current?.setCamera({
        x: 12,
        y: -8,
        scale: 1.5,
        width: 640,
        height: 480
      })
    )

    expect(rendered.container.querySelector('svg')).toHaveAttribute(
      'viewBox',
      '0 0 640 480'
    )
    expect(rendered.container.querySelector('svg > g')).toHaveAttribute(
      'transform',
      'translate(12 -8) scale(1.5)'
    )
    expect(
      rendered.container.querySelector('.hex-location-symbol')
    ).toHaveAttribute('d', markerBefore)
  })
})
