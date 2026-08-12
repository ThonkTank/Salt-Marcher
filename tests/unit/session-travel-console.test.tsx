// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEffect, useMemo, type ReactNode } from 'react'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { HexMapCanvasProps } from '../../src/renderer/features/hex/hex-map-canvas-pixi.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { HexTravelSnapshot } from '../../src/shared/contracts/hex.js'
import type { SessionChangeNotice } from '../../src/shared/contracts/session-change.js'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'

vi.mock('../../src/renderer/features/hex/hex-map-canvas.js', () => ({
  HexMapCanvas: (props: HexMapCanvasProps) => (
    <div aria-label={props.ariaLabel}>
      <output aria-label="Sichtbare Route">
        {JSON.stringify(props.route)}
      </output>
      <button onClick={() => props.onTileClick?.({ q: 1, r: 0 })}>
        Wegpunkt wählen
      </button>
      <button onClick={() => props.onTileActivate?.({ q: 1, r: 0 })}>
        Tastatur aktivieren
      </button>
      <button
        onClick={() => {
          props.onTokenDrag?.({ q: 1, r: 0 })
          props.onTokenDrop?.({ q: 1, r: 0 })
        }}
      >
        Token ziehen
      </button>
    </div>
  )
}))

import {
  SessionHexMap,
  TravelScenario
} from '../../src/renderer/features/hex/hex-workspaces.js'
import { createHexTravelProviderPort } from '../../src/renderer/features/hex/hex-travel-provider-port.js'
import { useTravelController } from '../../src/renderer/features/travel/use-travel-controller.js'

const sceneId = '01900000-0000-7000-8000-000000000101'
const mapId = '01900000-0000-7000-8000-000000000102'
const locationId = '01900000-0000-7000-8000-000000000103'
const campaignId = '01900000-0000-7000-8000-000000000104'
const mapSummary = {
  id: mapId,
  displayName: 'Nordküste',
  metadataRevision: 0,
  contentRevision: 1,
  position: 0
}
const session = {
  scene: { focusedSceneId: sceneId, revision: 4 }
} as unknown as LiveSessionSnapshot

function travel(overrides: Partial<HexTravelSnapshot> = {}): HexTravelSnapshot {
  return {
    revision: 0,
    sceneId,
    status: 'ready',
    mapId,
    mapName: 'Nordküste',
    current: { q: 0, r: 0 },
    currentLabel: 'Hex q=0, r=0',
    locationId,
    locationName: 'Salzscheune',
    path: [],
    currentIndex: 0,
    segmentStartedAt: null,
    segmentEndsAt: null,
    progress: 1,
    remainingGameSeconds: 0,
    gameTimeSeconds: 28_800,
    effectiveSpeedFeet: 30,
    assumedSpeedMemberNames: [],
    multiplier: 1,
    hintCode: 'ready',
    ...overrides
  }
}

function fixture(initialTravel: HexTravelSnapshot = travel()) {
  let sessionChanged: ((notice: SessionChangeNotice) => void) | null = null
  const ready = initialTravel
  const travelling = travel({
    revision: 1,
    status: 'travelling',
    path: [
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    ],
    progress: 0,
    remainingGameSeconds: 3_600,
    multiplier: 2
  })
  const commands = {
    evaluate: vi.fn().mockResolvedValue({
      status: 'ready',
      path: [
        { q: 0, r: 0 },
        { q: 1, r: 0 }
      ],
      totalGameSeconds: 3_600,
      totalTravelCost: 4,
      effectiveSpeedFeet: 30,
      assumedSpeedMemberNames: []
    }),
    position: vi.fn().mockResolvedValue({ travel: ready, session }),
    start: vi.fn().mockResolvedValue({ travel: travelling, session }),
    pause: vi.fn().mockResolvedValue({
      travel: travel({ ...travelling, revision: 2, status: 'paused' }),
      session
    }),
    resume: vi.fn().mockResolvedValue({
      travel: travel({ ...travelling, revision: 3, status: 'travelling' }),
      session
    }),
    abort: vi.fn().mockResolvedValue({
      travel: travel({
        ...travelling,
        revision: 4,
        status: 'aborted',
        path: []
      }),
      session
    }),
    setMultiplier: vi
      .fn()
      .mockImplementation((input: { multiplier: 1 | 2 | 5 | 10 }) =>
        Promise.resolve({
          travel: travel({
            ...travelling,
            revision: 5,
            multiplier: input.multiplier
          }),
          session
        })
      )
  }
  const readTravel = vi.fn().mockResolvedValue({ travel: ready, session })
  const api = {
    runtime: {},
    hex: {
      catalog: vi.fn().mockResolvedValue({ revision: 1, maps: [mapSummary] }),
      biomeCatalog: vi.fn().mockResolvedValue({
        revision: 1,
        biomes: [
          {
            id: 'grassland',
            label: 'Grasland',
            color: '#7f9b63',
            passable: true,
            travelCost: 1
          },
          {
            id: 'forest',
            label: 'Wald',
            color: '#3f704d',
            passable: true,
            travelCost: 4
          }
        ]
      }),
      readChunks: vi.fn().mockResolvedValue({
        map: mapSummary,
        biomes: [
          {
            id: 'grassland',
            label: 'Grasland',
            color: '#7f9b63',
            passable: true,
            travelCost: 1
          },
          {
            id: 'forest',
            label: 'Wald',
            color: '#3f704d',
            passable: true,
            travelCost: 4
          }
        ],
        chunks: [
          {
            key: { q: 0, r: 0 },
            revision: 1,
            authoredTiles: [
              { q: 0, r: 0, biomeId: 'grassland' },
              { q: 1, r: 0, biomeId: 'forest' }
            ],
            locations: [
              {
                q: 0,
                r: 0,
                locationId,
                displayName: 'Salzscheune',
                marker: {
                  revision: 0,
                  title: 'Salzscheune',
                  symbol: { kind: 'builtin', id: 'location' },
                  symbolSize: 40,
                  labelCurve: 0,
                  labelPosition: 'below'
                }
              }
            ]
          }
        ]
      }),
      runtimeOverlays: vi.fn().mockResolvedValue({ overlays: [] }),
      onChanged: vi.fn().mockReturnValue(() => undefined)
    },
    biomes: { onChanged: vi.fn().mockReturnValue(() => undefined) },
    hexTravel: {
      read: readTravel,
      ...commands
    },
    session: {
      read: vi.fn().mockResolvedValue(session),
      onChanged: vi
        .fn()
        .mockImplementation(
          (listener: (notice: SessionChangeNotice) => void) => {
            sessionChanged = listener
            return () => {
              sessionChanged = null
            }
          }
        )
    }
  } as unknown as SaltMarcherApi
  return {
    api,
    commands,
    readTravel,
    emitSessionChange: () =>
      sessionChanged?.({
        campaignId,
        sceneId,
        revision: 5,
        reason: 'projection-invalidated'
      })
  }
}

function Providers(props: { api: SaltMarcherApi; children: ReactNode }) {
  return (
    <CapabilityProvider api={props.api}>{props.children}</CapabilityProvider>
  )
}

function TravelSurfaces(props: {
  api: SaltMarcherApi
  openMap: () => void
  mapActive: boolean
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
}) {
  const port = useMemo(
    () => createHexTravelProviderPort(props.api),
    [props.api]
  )
  useEffect(() => () => port.dispose(), [port])
  const controller = useTravelController({
    port,
    snapshot: session,
    setSnapshot: props.setSnapshot,
    onError: vi.fn(),
    active: true
  })
  return (
    <>
      <SessionHexMap controller={controller} />
      <TravelScenario
        controller={controller}
        openMap={props.openMap}
        mapActive={props.mapActive}
      />
    </>
  )
}

afterEach(cleanup)

describe('Session travel console', () => {
  it('hides a completed route while retaining its final position and status', async () => {
    const completed = travel({
      revision: 2,
      status: 'completed',
      current: { q: 1, r: 0 },
      currentLabel: 'Hex q=1, r=0',
      locationId: null,
      locationName: '',
      path: [],
      currentIndex: 1,
      hintCode: 'completed'
    })
    const { api } = fixture(completed)
    render(
      <Providers api={api}>
        <TravelSurfaces
          api={api}
          setSnapshot={vi.fn()}
          openMap={vi.fn()}
          mapActive
        />
      </Providers>
    )

    expect(await screen.findByText('Ziel erreicht.')).toBeVisible()
    expect(screen.getByText('Hex q=1, r=0')).toBeVisible()
    expect(screen.getByLabelText('Sichtbare Route')).toHaveTextContent('[]')
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeDisabled()
  })

  it('shares map selection, placement, route planning and transport commands', async () => {
    const { api, commands } = fixture()
    const openMap = vi.fn()
    const setSnapshot = vi.fn()
    render(
      <Providers api={api}>
        <TravelSurfaces
          api={api}
          setSnapshot={setSnapshot}
          openMap={openMap}
          mapActive={false}
        />
      </Providers>
    )

    expect(await screen.findByLabelText('Hex-Karte')).toHaveValue(mapId)
    expect(screen.getByText('Salzscheune')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Reise starten' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Party platzieren' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tastatur aktivieren' }))
    await waitFor(() =>
      expect(commands.position).toHaveBeenCalledWith({
        sceneId,
        mapId,
        coordinate: { q: 1, r: 0 },
        expectedSceneRevision: 4
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Schneller' }))
    expect(screen.getByText('2×')).toBeVisible()
    expect(commands.setMultiplier).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Route planen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wegpunkt wählen' }))
    await waitFor(() => expect(commands.evaluate).toHaveBeenCalled())
    expect(await screen.findByText('1 Std.')).toBeVisible()
    expect(screen.getByText('4 P')).toBeVisible()

    const start = screen.getByRole('button', { name: 'Reise starten' })
    await waitFor(() => expect(start).toBeEnabled())
    fireEvent.click(start)
    await waitFor(() =>
      expect(commands.start).toHaveBeenCalledWith({
        sceneId,
        mapId,
        waypoints: [{ q: 1, r: 0 }],
        multiplier: 2,
        expectedRevision: 0
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    await waitFor(() => expect(commands.pause).toHaveBeenCalled())
    fireEvent.click(await screen.findByRole('button', { name: 'Fortsetzen' }))
    await waitFor(() => expect(commands.resume).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Stopp' }))
    await waitFor(() => expect(commands.abort).toHaveBeenCalled())
    expect(openMap).toHaveBeenCalled()
    expect(setSnapshot).toHaveBeenCalled()
  })

  it('commits a direct token drop and resets invalid route facts', async () => {
    const { api, commands } = fixture()
    render(
      <Providers api={api}>
        <TravelSurfaces
          api={api}
          setSnapshot={vi.fn()}
          openMap={vi.fn()}
          mapActive
        />
      </Providers>
    )

    await screen.findByLabelText('Hex-Karte')
    fireEvent.click(screen.getByRole('button', { name: 'Token ziehen' }))
    await waitFor(() =>
      expect(commands.position).toHaveBeenCalledWith({
        sceneId,
        mapId,
        coordinate: { q: 1, r: 0 },
        expectedSceneRevision: 4
      })
    )
    expect(screen.queryByRole('button', { name: 'Karte öffnen' })).toBeNull()
  })

  it('keeps the last projection visible and disables mutations after a refresh error', async () => {
    const test = fixture()
    render(
      <Providers api={test.api}>
        <TravelSurfaces
          api={test.api}
          setSnapshot={vi.fn()}
          openMap={vi.fn()}
          mapActive
        />
      </Providers>
    )

    expect(await screen.findByText('Salzscheune')).toBeVisible()
    test.readTravel.mockRejectedValueOnce(new Error('offline'))
    test.emitSessionChange()
    expect(await screen.findByText('Unbekannter Fehler')).toBeVisible()
    expect(screen.getByText('Salzscheune')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Reise starten' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Party platzieren' })
    ).toBeDisabled()
  })
})
