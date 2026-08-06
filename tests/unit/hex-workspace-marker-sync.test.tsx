// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type {
  HexChangeNotice,
  HexMapSummary
} from '../../src/shared/contracts/hex.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { WorldLocation } from '../../src/shared/contracts/world-location.js'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'

vi.mock('../../src/renderer/features/hex/hex-map-canvas.js', () => ({
  HexMapCanvas: (props: {
    ariaLabel: string
    snapshot: {
      tiles: ReadonlyArray<{
        location: { marker: { symbol: { pathData?: string } } } | null
      }>
    }
  }) => (
    <div data-testid={`${props.ariaLabel}-marker`}>
      {props.snapshot.tiles[0]?.location?.marker.symbol.pathData ?? 'builtin'}
    </div>
  )
}))

import {
  HexLocationPlacementDialog,
  SessionHexMap
} from '../../src/renderer/features/hex/hex-workspaces.js'

const campaignId = '01900000-0000-7000-8000-000000000080'
const mapId = '01900000-0000-7000-8000-000000000081'
const locationId = '01900000-0000-7000-8000-000000000082'
const symbolId = '01900000-0000-7000-8000-000000000083'
const sceneId = '01900000-0000-7000-8000-000000000084'
const summary: HexMapSummary = {
  id: mapId,
  displayName: 'Küste',
  metadataRevision: 0,
  contentRevision: 1,
  position: 0
}

afterEach(cleanup)

function capabilityFixture() {
  let pathData = 'M0 10 L5 0 L10 10 Z'
  let listener: ((notice: HexChangeNotice) => void) | null = null
  const onChanged = vi
    .fn()
    .mockImplementation((next: (notice: HexChangeNotice) => void) => {
      listener = next
      return () => {
        listener = null
      }
    })
  const api = {
    runtime: { pickLocationSymbolFile: vi.fn() },
    locations: {},
    locationSymbols: {},
    hex: {
      catalog: vi.fn().mockImplementation(() =>
        Promise.resolve({
          revision: 1,
          maps: [summary]
        })
      ),
      terrainCatalog: vi.fn().mockResolvedValue({
        version: 'saltmarcher-v1',
        terrains: []
      }),
      locateLocation: vi.fn().mockResolvedValue({
        mapId,
        coordinate: { q: 0, r: 0 },
        contentRevision: 1
      }),
      readChunks: vi
        .fn()
        .mockImplementation(
          (_mapId: string, keys: readonly { q: number; r: number }[]) =>
            Promise.resolve({
              map: summary,
              chunks: keys.some((key) => key.q === 0 && key.r === 0)
                ? [
                    {
                      key: { q: 0, r: 0 },
                      revision: 1,
                      authoredTiles: [
                        { q: 0, r: 0, terrainId: 'grassland' as const }
                      ],
                      locations: [
                        {
                          q: 0,
                          r: 0,
                          locationId,
                          displayName: 'Kap',
                          marker: {
                            revision: 1,
                            title: 'Kap',
                            symbol: {
                              kind: 'custom' as const,
                              id: symbolId,
                              viewBox: {
                                minX: 0,
                                minY: 0,
                                width: 10,
                                height: 10
                              },
                              pathData,
                              fillRule: 'nonzero' as const
                            },
                            symbolSize: 44,
                            labelCurve: 0,
                            labelPosition: 'below' as const
                          }
                        }
                      ]
                    }
                  ]
                : []
            })
        ),
      onChanged
    },
    hexTravel: {
      read: vi.fn().mockResolvedValue({
        mapId,
        current: null,
        path: [],
        hint: '',
        status: 'ready'
      })
    },
    session: {
      read: vi.fn(),
      onChanged: vi.fn().mockReturnValue(() => undefined)
    }
  } as unknown as SaltMarcherApi
  return {
    api,
    onChanged,
    replacePath(next: string) {
      pathData = next
      act(() =>
        listener?.({
          campaignId,
          commandId: crypto.randomUUID(),
          mapIds: [mapId],
          changedChunks: [{ mapId, key: { q: 0, r: 0 }, revision: 1 }]
        })
      )
    }
  }
}

function Providers(props: { api: SaltMarcherApi; children: ReactNode }) {
  return (
    <CapabilityProvider api={props.api}>
      <ModalLayerProvider>{props.children}</ModalLayerProvider>
    </CapabilityProvider>
  )
}

const session = {
  scene: { focusedSceneId: sceneId, revision: 1 },
  travel: { kind: 'none', label: '', hint: '' }
} as unknown as LiveSessionSnapshot
const location = {
  id: locationId,
  displayName: 'Kap',
  mapPresentation: { symbolId }
} as unknown as WorldLocation

describe('shared Hex marker synchronization', () => {
  it('refreshes an open Session map after an exact marker invalidation', async () => {
    const fixture = capabilityFixture()
    render(
      <Providers api={fixture.api}>
        <SessionHexMap
          snapshot={session}
          setSnapshot={vi.fn()}
          onError={vi.fn()}
        />
      </Providers>
    )
    const marker = await screen.findByTestId('Hex-Karte Küste-marker')
    expect(marker).toHaveTextContent('M0 10 L5 0 L10 10 Z')
    await waitFor(() => expect(fixture.onChanged).toHaveBeenCalled())

    fixture.replacePath('M0 0 L10 10 Z')
    await waitFor(() => expect(marker).toHaveTextContent('M0 0 L10 10 Z'))
  })

  it('refreshes an open placement dialog from the same projection event', async () => {
    const fixture = capabilityFixture()
    render(
      <Providers api={fixture.api}>
        <HexLocationPlacementDialog
          location={location}
          close={vi.fn()}
          onPlaced={vi.fn()}
          onError={vi.fn()}
        />
      </Providers>
    )
    const marker = await screen.findByTestId('Platzierung von Kap-marker')
    expect(marker).toHaveTextContent('M0 10 L5 0 L10 10 Z')
    await waitFor(() => expect(fixture.onChanged).toHaveBeenCalled())

    fixture.replacePath('M2 2 L8 8 Z')
    await waitFor(() => expect(marker).toHaveTextContent('M2 2 L8 8 Z'))
  })
})
