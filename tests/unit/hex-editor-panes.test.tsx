// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HexStatePane } from '../../src/renderer/features/hex/hex-editor-panes.js'
import type { HexTerrainCatalog } from '../../src/shared/contracts/hex.js'
import type { WorldLocationSnapshot } from '../../src/shared/contracts/world-location.js'
import type { LocationSymbolPage } from '../../src/shared/contracts/location-symbol.js'

afterEach(cleanup)

const terrains: HexTerrainCatalog = {
  version: 'saltmarcher-v1',
  terrains: [
    ['grassland', 'Grasland', '#75934e', true, 1],
    ['desert', 'Wüste', '#c79a54', true, 1],
    ['forest', 'Wald', '#365f3d', true, 2],
    ['swamp', 'Sumpf', '#536b57', true, 2],
    ['mountain', 'Gebirge', '#777777', false, 3],
    ['water', 'Wasser', '#477fa3', false, 2]
  ].map(([id, label, color, passable, travelCost]) => ({
    id,
    label,
    color,
    passable,
    travelCost
  })) as HexTerrainCatalog['terrains']
}
const locationId = '01900000-0000-7000-8000-000000000040'
const symbolId = '01900000-0000-7000-8000-000000000041'
const locations: WorldLocationSnapshot = {
  revision: 1,
  locations: [
    {
      id: locationId,
      displayName: 'Schwarzes Kap',
      kind: 'Ruine',
      region: 'Küste',
      notes: '',
      position: 0,
      factionIds: [],
      encounterTableIds: [],
      mapPresentation: {
        revision: 1,
        titleOverride: null,
        symbolId,
        symbolSize: 44,
        labelCurve: 0,
        labelPosition: 'below'
      }
    }
  ]
}
const symbols: LocationSymbolPage = {
  revision: 2,
  total: 25,
  offset: 0,
  symbols: [
    {
      id: symbolId,
      displayName: 'Leuchtturm',
      viewBox: { minX: 0, minY: 0, width: 10, height: 10 },
      pathData: 'M0 10 L5 0 L10 10 Z',
      fillRule: 'nonzero',
      position: 0
    }
  ]
}

function props(tool: 'select' | 'terrain' | 'location') {
  return {
    selected: { q: 0, r: 0 },
    tile: null,
    terrains,
    locations,
    symbols,
    selectedCustomSymbol: symbols.symbols[0]!,
    tool,
    terrainMode: 'paint' as const,
    terrainId: 'grassland' as const,
    brushLevel: 1,
    locationId,
    onPaintMode: vi.fn(),
    onBrushLevelChange: vi.fn(),
    onTerrainChange: vi.fn(),
    onLocationChange: vi.fn(),
    onCreateLocation: vi.fn(),
    locationDialogOpen: false,
    onPresentationChange: vi.fn(),
    onPresentationCommit: vi.fn(),
    onImportSymbol: vi.fn(),
    onSymbolSearch: vi.fn(),
    onSymbolPage: vi.fn(),
    onRenameSymbol: vi.fn(),
    onInspectSymbolDelete: vi.fn().mockResolvedValue({
      symbolId,
      symbolName: 'Leuchtturm',
      totalLocations: 1,
      usages: []
    }),
    onDeleteSymbol: vi.fn(),
    onRemoveLocation: vi.fn()
  }
}

describe('hex editor state panes', () => {
  it('renders the explicit selection, terrain and location modes', () => {
    const rendered = render(<HexStatePane {...props('select')} />)
    expect(screen.getByRole('heading', { name: 'Hexfeld' })).toBeVisible()

    rendered.rerender(<HexStatePane {...props('terrain')} />)
    expect(screen.getByRole('button', { name: 'Malen' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.getAllByRole('button', {
        name: /Grasland|Wüste|Wald|Sumpf|Gebirge|Wasser/
      })
    ).toHaveLength(6)

    const locationProps = props('location')
    rendered.rerender(<HexStatePane {...locationProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ort erstellen' }))
    expect(locationProps.onCreateLocation).toHaveBeenCalledOnce()
    expect(screen.getByRole('listbox', { name: 'Katalog-Orte' })).toBeVisible()
    expect(screen.getByRole('slider', { name: 'Symbolgröße' })).toHaveAttribute(
      'aria-valuemin',
      '24'
    )
    expect(
      screen.getByRole('slider', { name: 'Krümmung der Beschriftung' })
    ).toHaveAttribute('aria-valuemin', '-40')
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(locationProps.onSymbolPage).toHaveBeenCalledWith(24)
  })

  it('commits discrete marker presentation changes immediately', () => {
    const locationProps = props('location')
    render(<HexStatePane {...locationProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Leuchtturm' }))
    expect(locationProps.onPresentationChange).toHaveBeenCalledWith(
      locationId,
      expect.objectContaining({ symbolId })
    )
    expect(locationProps.onPresentationCommit).toHaveBeenCalledWith(locationId)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Symbolgröße' }), {
      key: 'ArrowRight'
    })
    expect(locationProps.onPresentationChange).toHaveBeenCalledWith(
      locationId,
      expect.objectContaining({ symbolSize: 45 })
    )
  })
})
