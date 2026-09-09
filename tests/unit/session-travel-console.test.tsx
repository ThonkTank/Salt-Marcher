import type { HexTravelContextResult } from '../../src/shared/contracts/live-session.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import { useHexTravelCommandOwner } from '../../src/renderer/features/hex/use-hex-travel-command-owner.js'
import {
  allMaintenanceDrafts,
  draftConcern,
  maintenanceDraftCoordinator as maintenance
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type {
  HexRoutePlanSnapshot,
  HexTravelCommandState,
  HexTravelCommand
} from '../../src/shared/contracts/hex-travel-command.js'
// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDraftTransition } from '../../src/renderer/shell/use-draft-transition.js'
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
  let routePlan: HexRoutePlanSnapshot = { sceneId, revision: 0, plan: null }
  const receipts = new Map<string, HexTravelCommandState>()
  const writePlan = vi.fn<
    (
      input: Extract<
        HexTravelCommand['command'],
        { kind: 'save-plan' }
      >['input']
    ) => void
  >((input) => {
    routePlan = { sceneId, revision: routePlan.revision + 1, plan: input.plan }
  })
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
    position: vi
      .fn<(input: unknown) => Promise<HexTravelContextResult>>()
      .mockResolvedValue({ travel: ready, session }),
    start: vi
      .fn<(input: unknown) => Promise<HexTravelContextResult>>()
      .mockResolvedValue({ travel: travelling, session }),
    pause: vi
      .fn<(input: unknown) => Promise<HexTravelContextResult>>()
      .mockResolvedValue({
        travel: travel({ ...travelling, revision: 2, status: 'paused' }),
        session
      }),
    resume: vi
      .fn<(input: unknown) => Promise<HexTravelContextResult>>()
      .mockResolvedValue({
        travel: travel({ ...travelling, revision: 3, status: 'travelling' }),
        session
      }),
    abort: vi
      .fn<(input: unknown) => Promise<HexTravelContextResult>>()
      .mockResolvedValue({
        travel: travel({
          ...travelling,
          revision: 4,
          status: 'aborted',
          path: []
        }),
        session
      }),
    setMultiplier: vi
      .fn<
        (input: {
          multiplier: 1 | 2 | 5 | 10
        }) => Promise<HexTravelContextResult>
      >()
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
  const readTravel = vi
    .fn<() => Promise<HexTravelContextResult>>()
    .mockResolvedValue({ travel: ready, session })
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
      readState: async () => ({
        context: await readTravel(),
        routePlan
      }),
      executeCommand: async ({ commandId, command }: HexTravelCommand) => {
        if (command.kind === 'save-plan') {
          writePlan(command.input)
          const state = { context: await readTravel(), routePlan }
          receipts.set(commandId, state)
          return state
        }
        const context =
          command.kind === 'set-multiplier'
            ? await commands.setMultiplier(command.input)
            : await commands[command.kind](command.input)
        readTravel.mockResolvedValue(context)
        const state = { context, routePlan }
        receipts.set(commandId, state)
        return state
      },
      commandStatus: async ({ commandId }: HexTravelCommand) => ({
        context: await readTravel(),
        routePlan,
        receipt: receipts.get(commandId) ?? null
      }),
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
    writePlan,
    savedPlan: () => routePlan,
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
    <CapabilityProvider api={props.api}>
      <ModalLayerProvider>{props.children}</ModalLayerProvider>
    </CapabilityProvider>
  )
}

function TravelSurfaces(props: {
  api: SaltMarcherApi
  openMap: () => void
  mapActive: boolean
  persistent?: boolean
  onLeave?: () => void
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
}) {
  const original = useMemo(
    () => ({
      current: () => session,
      execute: (input: HexTravelCommand) =>
        props.api.hexTravel.executeCommand({ ...input, campaignId }),
      status: (input: HexTravelCommand) =>
        props.api.hexTravel.commandStatus({ ...input, campaignId }),
      refresh: () => props.api.hexTravel.readState({ campaignId, sceneId })
    }),
    [props.api]
  )
  const owner = useHexTravelCommandOwner(
    original,
    (current) => props.setSnapshot(current.context.session),
    sceneId
  )
  const transition = useDraftTransition(
    'travel-test',
    undefined,
    allMaintenanceDrafts
  )
  const port = useMemo(
    () =>
      createHexTravelProviderPort(
        props.api,
        props.persistent
          ? owner.executor
          : {
              execute: (input) =>
                props.api.hexTravel.executeCommand({ ...input, campaignId }),
              refresh: () =>
                props.api.hexTravel.readState({ campaignId, sceneId })
            }
      ),
    [props.api, props.persistent, owner.executor]
  )
  useEffect(() => () => port.dispose(), [port])
  const controller = useTravelController({
    port,
    snapshot: session,
    setSnapshot: props.setSnapshot,
    onError: vi.fn(),
    active: true,
    ...(props.persistent
      ? {
          routeDraft: owner.routeDraft,
          commandBusy: owner.busy,
          commandsBlocked: owner.blocked
        }
      : {})
  })
  return (
    <>
      {owner.notice}
      {controller.notice}
      {transition.dialog}
      <button onClick={() => transition.request(() => props.onLeave?.())}>
        Bereich wechseln
      </button>
      <SessionHexMap controller={controller} />
      <TravelScenario
        controller={controller}
        openMap={props.openMap}
        mapActive={props.mapActive}
      />
    </>
  )
}

afterEach(async () => {
  cleanup()
  const resolution = maintenance.begin()
  try {
    expect(await resolution.resolve('discard')).toEqual([])
  } finally {
    resolution.release()
  }
})

describe('Session travel console', () => {
  it.each(['Speichern und fortfahren', 'Verwerfen und fortfahren'])(
    'resolves the route before Start using %s without captured discarded waypoints',
    async (choice) => {
      const f = fixture()
      showPersistent(f)
      await planRoute()
      fireEvent.click(screen.getByRole('button', { name: 'Reise starten' }))
      await screen.findByRole('alertdialog')
      expect(f.commands.start).not.toHaveBeenCalled()
      await confirmDrafts(choice)
      await waitFor(() => expect(maintenance.isLocked()).toBe(false))
      if (choice.startsWith('Speichern')) {
        await waitFor(() => expect(f.commands.start).toHaveBeenCalledOnce())
        expect(f.commands.start.mock.calls[0]![0]).toMatchObject({
          waypoints: [{ q: 1, r: 0 }],
          expectedRevision: 0,
          expectedSceneRevision: 4
        })
        expect(f.writePlan).toHaveBeenCalledOnce()
      } else {
        expect(f.commands.start).not.toHaveBeenCalled()
        expect(f.writePlan).not.toHaveBeenCalled()
        expect(
          screen.getByRole('button', { name: 'Reise starten' })
        ).toBeDisabled()
      }
    }
  )

  it('pauses without resolving or changing an unrelated XP draft', async () => {
    const f = fixture(travel({ status: 'travelling', revision: 3 }))
    showPersistent(f)
    await screen.findByRole('button', { name: 'Pause' })
    const dirty = true
    f.commands.pause.mockResolvedValue({
      travel: travel({ status: 'paused', revision: 4 }),
      session
    })
    const save = vi.fn(() => Promise.resolve(true))
    const unregister = maintenance.register('other-editor', {
      label: 'EP-Entwurf',
      concerns: [draftConcern.character('character-a')],
      isDirty: () => dirty,
      save
    })
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
      await waitFor(() => expect(f.commands.pause).toHaveBeenCalledOnce())
      expect(save).not.toHaveBeenCalled()
      expect(dirty).toBe(true)
      expect(f.commands.pause).toHaveBeenCalledOnce()
      expect(f.commands.resume).not.toHaveBeenCalled()
    } finally {
      unregister()
    }
  })

  it('keeps another successful save when route save fails and does not Start after discard', async () => {
    const f = fixture()
    let dirty = true
    let savedValue = 0
    const save = vi.fn(() => {
      dirty = false
      savedValue = 12
      return Promise.resolve(true)
    })
    const unregister = maintenance.register('first-editor', {
      label: 'Besetzung',
      concerns: [draftConcern.party(sceneId)],
      isDirty: () => dirty,
      save
    })
    try {
      showPersistent(f)
      await planRoute()
      f.writePlan.mockImplementationOnce(() => {
        throw new Error('route storage unavailable')
      })
      fireEvent.click(screen.getByRole('button', { name: 'Reise starten' }))
      await confirmDrafts('Speichern und fortfahren')
      await waitFor(() =>
        expect(screen.getByRole('alertdialog')).toHaveTextContent(
          'Routenentwurf'
        )
      )
      expect(savedValue).toBe(12)
      expect(dirty).toBe(false)
      expect(f.commands.start).not.toHaveBeenCalled()
      expect(maintenance.isCoordinating()).toBe(true)
      await confirmDrafts('Verwerfen und fortfahren')
      await waitFor(() => expect(maintenance.isCoordinating()).toBe(false))
      expect(savedValue).toBe(12)
      expect(save).toHaveBeenCalledOnce()
      expect(f.commands.start).not.toHaveBeenCalled()
      expect(f.writePlan).toHaveBeenCalledOnce()
    } finally {
      unregister()
    }
  })

  it.each([false, true])(
    'blocks input during fresh preparation and abandons an unmounted view (%s)',
    async (unmount) => {
      const f = fixture(travel({ status: 'travelling', revision: 3 }))
      const view = showPersistent(f)
      await screen.findByRole('button', { name: 'Pause' })
      const freshSession = {
        ...session,
        scene: { ...session.scene, revision: 8 }
      }
      const fresh = {
        context: {
          travel: travel({ status: 'travelling', revision: 6 }),
          session: freshSession
        },
        routePlan: f.savedPlan()
      }
      f.commands.pause.mockResolvedValue({
        travel: travel({ status: 'paused', revision: 7 }),
        session: freshSession
      })
      let finish!: (value: HexTravelCommandState) => void
      const pending = new Promise<HexTravelCommandState>((resolve) => {
        finish = resolve
      })
      const prepareRead = vi.fn(() => pending)
      vi.spyOn(f.api.hexTravel, 'readState').mockImplementationOnce(prepareRead)
      try {
        fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
        await waitFor(() => expect(prepareRead).toHaveBeenCalledOnce())
        expect(maintenance.isLocked()).toBe(false)
        const faster = screen.getByRole('button', { name: 'Schneller' })
        expect(faster).toBeDisabled()
        fireEvent.click(faster)
        fireEvent.click(screen.getByRole('button', { name: 'Token ziehen' }))
        expect(f.commands.setMultiplier).not.toHaveBeenCalled()
        expect(f.commands.position).not.toHaveBeenCalled()
        if (unmount) view.unmount()
        await act(async () => {
          finish(fresh)
          await pending
        })
        if (unmount) expect(f.commands.pause).not.toHaveBeenCalled()
        else {
          await waitFor(() =>
            expect(f.commands.pause).toHaveBeenCalledExactlyOnceWith({
              sceneId,
              expectedRevision: 6,
              expectedSceneRevision: 8
            })
          )
          expect(
            await screen.findByRole('button', { name: 'Fortsetzen' })
          ).toBeEnabled()
        }
      } finally {
        await act(async () => {
          finish(fresh)
          await pending
        })
      }
    }
  )

  it('saves and reloads a route without starting a journey', async () => {
    const f = fixture()
    const element = (
      <Providers api={f.api}>
        <TravelSurfaces
          api={f.api}
          setSnapshot={vi.fn()}
          openMap={vi.fn()}
          mapActive
          persistent
        />
      </Providers>
    )
    const view = render(element)
    await screen.findByLabelText('Hex-Karte')
    fireEvent.click(screen.getByRole('button', { name: 'Route planen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wegpunkt wählen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Schneller' }))
    const save = screen.getByRole('button', { name: 'Route speichern' })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    await waitFor(() => expect(save).toBeDisabled())
    expect(f.writePlan).toHaveBeenCalledOnce()
    expect(f.savedPlan().plan).toEqual({
      mapId,
      waypoints: [{ q: 1, r: 0 }],
      multiplier: 2
    })
    expect(f.commands.start).not.toHaveBeenCalled()
    expect(maintenance.hasDirty()).toBe(false)
    view.unmount()
    render(element)
    await screen.findByLabelText('Hex-Karte')
    fireEvent.click(screen.getByRole('button', { name: 'Route planen' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Sichtbare Route')).toHaveTextContent(
        '"q":1'
      )
    )
    expect(screen.getByText('2×')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Route speichern' })
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Route speichern' }))
    await waitFor(() =>
      expect(f.savedPlan()).toMatchObject({ revision: 2, plan: null })
    )
    expect(f.commands.start).not.toHaveBeenCalled()
  })

  it.each(['Speichern und fortfahren', 'Verwerfen und fortfahren'])(
    'resolves a route through the central %s dialog after cancellation',
    async (choice) => {
      const f = fixture()
      const leave = vi.fn()
      render(
        <Providers api={f.api}>
          <TravelSurfaces
            api={f.api}
            setSnapshot={vi.fn()}
            openMap={vi.fn()}
            onLeave={leave}
            mapActive
            persistent
          />
        </Providers>
      )
      await screen.findByLabelText('Hex-Karte')
      fireEvent.click(screen.getByRole('button', { name: 'Route planen' }))
      fireEvent.click(screen.getByRole('button', { name: 'Wegpunkt wählen' }))
      const saveRoute = screen.getByRole('button', { name: 'Route speichern' })
      fireEvent.click(screen.getByRole('button', { name: 'Bereich wechseln' }))
      await screen.findByRole('alertdialog')
      expect(saveRoute).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
      expect(leave).not.toHaveBeenCalled()
      expect(maintenance.hasDirty()).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: 'Bereich wechseln' }))
      await screen.findByRole('alertdialog')
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: choice }))
        await Promise.resolve()
      })
      await waitFor(() => expect(leave).toHaveBeenCalledOnce())
      expect(f.writePlan).toHaveBeenCalledTimes(
        choice.startsWith('Speichern') ? 1 : 0
      )
      expect(f.commands.start).not.toHaveBeenCalled()
      expect(maintenance.hasDirty()).toBe(false)
    }
  )

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
        expectedRevision: 0,
        expectedSceneRevision: session.scene.revision
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

function showPersistent(f: ReturnType<typeof fixture>) {
  return render(
    <Providers api={f.api}>
      <TravelSurfaces
        api={f.api}
        setSnapshot={vi.fn()}
        openMap={vi.fn()}
        mapActive
        persistent
      />
    </Providers>
  )
}
async function planRoute() {
  await screen.findByLabelText('Hex-Karte')
  fireEvent.click(screen.getByRole('button', { name: 'Route planen' }))
  fireEvent.click(screen.getByRole('button', { name: 'Wegpunkt wählen' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Reise starten' })).toBeEnabled()
  )
}
async function confirmDrafts(choice: string) {
  await screen.findByRole('alertdialog')
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: choice }))
    await Promise.resolve()
  })
}
