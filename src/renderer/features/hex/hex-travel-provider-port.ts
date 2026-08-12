import type {
  AxialCoordinate,
  HexBiomeCatalog,
  HexMapCatalogSnapshot,
  HexMapView,
  HexRouteEvaluation,
  HexTravelSnapshot
} from '../../../shared/contracts/hex.js'
import type {
  TravelProviderInvalidation,
  TravelProviderPort,
  TravelProviderReadResult
} from '../travel/travel-provider-port.js'
import type { TravelController } from '../travel/use-travel-controller.js'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import { hexCapabilities, type HexCapabilities } from './hex-capabilities.js'
import { createHexMapProjectionPort } from './hex-map-projection-port.js'

export type HexTravelProviderState = Readonly<{
  catalog: HexMapCatalogSnapshot
  biomes: HexBiomeCatalog
  travel: HexTravelSnapshot
}>

export type HexTravelMapProjection = HexMapView &
  Readonly<{
    overlays: readonly Readonly<{
      id: string
      label: string
      token: AxialCoordinate | null
      route: readonly AxialCoordinate[]
      focused: boolean
    }>[]
  }>

export type HexTravelProviderPort = TravelProviderPort<
  AxialCoordinate,
  HexTravelProviderState,
  HexTravelMapProjection,
  HexRouteEvaluation
>

export type HexTravelController = TravelController<
  AxialCoordinate,
  HexTravelProviderState,
  HexTravelMapProjection,
  HexRouteEvaluation
>

export function createHexTravelProviderPort(
  api: SaltMarcherApi | HexCapabilities
): HexTravelProviderPort {
  const capabilities = 'campaigns' in api ? hexCapabilities(api) : api
  const maps = createHexMapProjectionPort(api)
  const listeners = new Set<
    (invalidation: TravelProviderInvalidation) => void
  >()
  let catalog: HexMapCatalogSnapshot | null = null
  let biomes: HexBiomeCatalog | null = null
  let unsubscribe: (() => void) | null = null

  function emit(invalidation: TravelProviderInvalidation) {
    for (const listener of listeners) listener(invalidation)
  }

  function connect() {
    if (unsubscribe) return
    const disconnectSession = capabilities.session.onChanged((notice) =>
      emit({ kind: 'context', sceneId: notice.sceneId })
    )
    const disconnectMaps = maps.subscribe((change) => {
      if (change.kind === 'biomes') {
        emit({ kind: 'supporting-data' })
        return
      }
      for (const mapId of change.notice.mapIds) emit({ kind: 'map', mapId })
      const knownIds = new Set(catalog?.maps.map((map) => map.id) ?? [])
      if (change.notice.mapIds.some((mapId) => !knownIds.has(mapId)))
        emit({ kind: 'catalog' })
    })
    unsubscribe = () => {
      disconnectSession()
      disconnectMaps()
      unsubscribe = null
    }
  }

  async function read(input: {
    sceneId: string
  }): Promise<TravelProviderReadResult<HexTravelProviderState>> {
    const [nextCatalog, nextBiomes, context] = await Promise.all([
      maps.readCatalog(),
      maps.readBiomeCatalog(),
      capabilities.hexTravel.read(input)
    ])
    catalog = nextCatalog
    biomes = nextBiomes
    return {
      providerState: {
        catalog: nextCatalog,
        biomes: nextBiomes,
        travel: context.travel
      },
      session: context.session
    }
  }

  async function requireSupportingData(): Promise<{
    catalog: HexMapCatalogSnapshot
    biomes: HexBiomeCatalog
  }> {
    if (!catalog || !biomes) {
      const [nextCatalog, nextBiomes] = await Promise.all([
        maps.readCatalog(),
        maps.readBiomeCatalog()
      ])
      catalog = nextCatalog
      biomes = nextBiomes
    }
    return { catalog, biomes }
  }

  return {
    kind: 'hex',
    read,
    async readMap(input) {
      const [view, overlayProjection] = await Promise.all([
        maps.readMap(input),
        capabilities.hex.runtimeOverlays(input.mapId)
      ])
      catalog = maps.currentCatalog()
      return {
        ...view,
        overlays: overlayProjection.overlays.map((overlay) => ({
          id: overlay.sceneId,
          label: overlay.label,
          token: overlay.token,
          route: overlay.route,
          focused: overlay.focused
        }))
      }
    },
    evaluate: (input) =>
      capabilities.hexTravel.evaluate({
        ...input,
        waypoints: [...input.waypoints]
      }),
    async execute(command) {
      const supporting = await requireSupportingData()
      const context = await (async () => {
        switch (command.kind) {
          case 'position':
            return capabilities.hexTravel.position({
              sceneId: command.sceneId,
              mapId: command.mapId,
              coordinate: command.position,
              expectedSceneRevision: command.expectedSceneRevision
            })
          case 'start':
            return capabilities.hexTravel.start({
              sceneId: command.sceneId,
              mapId: command.mapId,
              waypoints: [...command.waypoints],
              multiplier: command.multiplier,
              expectedRevision: command.expectedRevision
            })
          case 'pause':
          case 'resume':
          case 'abort':
            return capabilities.hexTravel[command.kind]({
              sceneId: command.sceneId,
              expectedRevision: command.expectedRevision
            })
          case 'set-multiplier':
            return capabilities.hexTravel.setMultiplier({
              sceneId: command.sceneId,
              multiplier: command.multiplier,
              expectedRevision: command.expectedRevision
            })
        }
      })()
      return {
        providerState: {
          ...supporting,
          travel: context.travel
        },
        session: context.session
      }
    },
    describe(state) {
      return {
        revision: state.travel.revision,
        status: state.travel.status,
        mapOptions: state.catalog.maps.map((map) => ({
          id: map.id,
          label: map.displayName
        })),
        currentMapId: state.travel.mapId,
        currentPosition: state.travel.current,
        multiplier: state.travel.multiplier
      }
    },
    isAuthoredPosition: (map, position) =>
      map.tiles.some((tile) => tile.q === position.q && tile.r === position.r),
    canStart: (evaluation) => evaluation.status === 'ready',
    subscribe(listener) {
      listeners.add(listener)
      connect()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) unsubscribe?.()
      }
    },
    dispose() {
      listeners.clear()
      unsubscribe?.()
      maps.dispose()
      catalog = null
      biomes = null
    }
  }
}
