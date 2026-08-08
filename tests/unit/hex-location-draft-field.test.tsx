// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { HexLocationDraftField } from '../../src/renderer/features/hex/hex-location-draft-field.js'
import { HexMapDialog } from '../../src/renderer/features/hex/hex-map-dialog.js'
import type { HexLocationPlacementProjectionPort } from '../../src/renderer/features/hex/hex-location-placement-port.js'
import type { HexMapApplicationPort } from '../../src/renderer/features/hex/hex-map-creation-port.js'
import { HexChunkCache } from '../../src/renderer/features/hex/hex-chunk-cache.js'
import type { WorldLocationPlacementState } from '../../src/renderer/features/worldplanner/world-location-editor-types.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import type {
  HexChunkKey,
  HexMapSummary
} from '../../src/shared/contracts/hex.js'

vi.mock('../../src/renderer/features/hex/hex-map-canvas.js', () => ({
  HexMapCanvas: (props: {
    ariaLabel: string
    onTileClick: (coordinate: { q: number; r: number }) => void
  }) => (
    <div data-testid="placement-canvas">
      <span>{props.ariaLabel}</span>
      <button type="button" onClick={() => props.onTileClick({ q: 1, r: 1 })}>
        q 1 r 1
      </button>
    </div>
  )
}))

const mapAId = '01900000-0000-7000-8000-000000000081'
const mapBId = '01900000-0000-7000-8000-000000000082'
const map = (id: string, position: number): HexMapSummary => ({
  id,
  displayName: id === mapAId ? 'Küste' : 'Inseln',
  metadataRevision: 0,
  contentRevision: 1,
  position
})

function port(): HexLocationPlacementProjectionPort {
  const maps = [map(mapAId, 0), map(mapBId, 1)]
  const readChunks = vi
    .fn()
    .mockImplementation((mapId: string, keys: readonly HexChunkKey[]) =>
      Promise.resolve({
        map: maps.find((entry) => entry.id === mapId)!,
        chunks: keys.map((key: { q: number; r: number }) => ({
          key,
          revision: 1,
          authoredTiles:
            key.q === 0 && key.r === 0
              ? [
                  { q: 0, r: 0, biomeId: 'grassland' },
                  { q: 1, r: 1, biomeId: 'grassland' }
                ]
              : [],
          locations: []
        })),
        biomes: [
          {
            id: 'grassland',
            label: 'Grasland',
            color: '#668844',
            passable: true,
            travelCost: 1
          }
        ]
      })
    )
  return {
    currentCatalog: () => null,
    currentBiomeCatalog: () => null,
    readCatalog: vi.fn().mockResolvedValue({ revision: 1, maps }),
    readBiomeCatalog: vi.fn().mockResolvedValue({
      revision: 1,
      biomes: [
        {
          id: 'grassland',
          label: 'Grasland',
          color: '#668844',
          passable: true,
          travelCost: 1
        }
      ]
    }),
    locateLocation: vi.fn().mockResolvedValue(null),
    cache: new HexChunkCache(readChunks),
    cacheMode: 'transient',
    subscribe: vi.fn().mockReturnValue(() => undefined)
  }
}

function Harness(props: { mapCreation?: HexMapApplicationPort } = {}) {
  const [placementPort] = useState(port)
  const [state, setState] = useState<WorldLocationPlacementState | null>(null)
  const [mapCreation, setMapCreation] = useState<
    ((displayName: string) => Promise<HexMapSummary>) | null
  >(null)
  return (
    <ModalLayerProvider>
      <HexLocationDraftField
        port={placementPort}
        mapCreation={
          props.mapCreation ??
          ({ createMap: vi.fn() } as unknown as HexMapApplicationPort)
        }
        requestMapCreation={(create) => setMapCreation(() => create)}
        locationId={null}
        locationName="Kap"
        disabled={false}
        initialHint={{ mapId: mapAId, coordinate: { q: 0, r: 0 } }}
        state={state}
        onReady={setState}
        onViewMap={(viewedMapId) =>
          setState((known) => (known ? { ...known, viewedMapId } : known))
        }
        onChange={(current) =>
          setState((known) =>
            known
              ? {
                  ...known,
                  placementDraft: { ...known.placementDraft, current }
                }
              : {
                  viewedMapId: current?.mapId ?? null,
                  placementDraft: { baseline: null, current }
                }
          )
        }
      />
      <output data-testid="placement-state">
        {JSON.stringify(state?.placementDraft.current)}
      </output>
      {mapCreation && (
        <HexMapDialog
          invocation={{ kind: 'location-link' }}
          close={() => setMapCreation(null)}
          create={mapCreation}
          created={() => setMapCreation(null)}
          onError={vi.fn()}
        />
      )}
    </ModalLayerProvider>
  )
}

afterEach(cleanup)

describe('HexLocationDraftField', () => {
  it('keeps the draft selection when browsing another map', async () => {
    render(<Harness />)
    await waitFor(() =>
      expect(screen.getByTestId('placement-state')).toHaveTextContent(mapAId)
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Hexkarte' }), {
      target: { value: mapBId }
    })
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Hexkarte' })).toHaveValue(
        mapBId
      )
    )
    expect(screen.getByTestId('placement-state')).toHaveTextContent(mapAId)
    fireEvent.click(
      screen.getByRole('button', { name: 'Platzierung entfernen' })
    )
    expect(screen.getByTestId('placement-state')).toHaveTextContent('null')
  })

  it('mounts one heavy canvas and gives expanded cancel/apply real semantics', async () => {
    render(<Harness />)
    await waitFor(() =>
      expect(screen.getByTestId('placement-canvas')).toBeVisible()
    )
    expect(screen.getAllByTestId('placement-canvas')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /Große Karte/ }))
    expect(screen.getAllByTestId('placement-canvas')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'q 1 r 1' }))
    expect(screen.getByTestId('placement-state')).toHaveTextContent('"q":1')
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.getByTestId('placement-state')).toHaveTextContent('"q":0')

    fireEvent.click(screen.getByRole('button', { name: /Große Karte/ }))
    fireEvent.click(screen.getByRole('button', { name: 'q 1 r 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Auswahl übernehmen' }))
    expect(screen.getByTestId('placement-state')).toHaveTextContent('"q":1')
    expect(screen.getAllByTestId('placement-canvas')).toHaveLength(1)
  })

  it('uses the shared map dialog and keeps placement while selecting the new map', async () => {
    const maps = [map(mapAId, 0), map(mapBId, 1)]
    const createMap = vi.fn().mockResolvedValue({
      snapshot: { revision: 2, maps },
      saved: maps[1],
      commandResult: null
    })
    render(
      <Harness
        mapCreation={{ createMap } as unknown as HexMapApplicationPort}
      />
    )
    await waitFor(() =>
      expect(screen.getByTestId('placement-state')).toHaveTextContent(mapAId)
    )

    fireEvent.click(screen.getByRole('button', { name: 'Neue Karte' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Kartenname' }), {
      target: { value: 'Neue Inseln' }
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Erstellen und verknüpfen' })
    )

    await waitFor(() => expect(createMap).toHaveBeenCalledWith('Neue Inseln'))
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Hexkarte' })).toHaveValue(
        mapBId
      )
    )
    expect(screen.getByTestId('placement-state')).toHaveTextContent(mapAId)
  })
})
