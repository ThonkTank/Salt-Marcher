import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState
} from 'react'
import type {
  AxialCoordinate,
  HexBiomeCatalog,
  HexMapCatalogSnapshot,
  HexMapView
} from '../../../shared/contracts/hex.js'
import type {
  WorldLocationPlacementHint,
  WorldLocationPlacementSelection,
  WorldLocationPlacementState
} from '../worldplanner/world-location-editor-types.js'
import { mergeHexBiomeCatalog } from './hex-chunk-cache.js'
import type {
  HexLocationPlacementProjectionPort,
  HexPlacementProjectionChange
} from './hex-location-placement-port.js'
import type { HexMapCreationResult } from './hex-map-creation-port.js'

export type HexPlacementProjectionFailure = Readonly<{
  source: 'catalog' | 'biomes' | 'placement' | 'map' | 'hex-refresh'
  kind: 'unavailable' | 'map-missing'
  cause?: unknown
}>

export type HexPlacementStableData = Readonly<{
  catalog: HexMapCatalogSnapshot
  biomes: HexBiomeCatalog
  map: HexMapView | null
}>

export type HexPlacementProjectionState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; data: HexPlacementStableData }>
  | Readonly<{
      status: 'degraded'
      data: HexPlacementStableData
      error: HexPlacementProjectionFailure
    }>
  | Readonly<{ status: 'failed'; error: HexPlacementProjectionFailure }>

export function useHexLocationPlacementDraft(options: {
  port: HexLocationPlacementProjectionPort
  locationId: string | null
  initialHint: WorldLocationPlacementHint | null
  onReady: (state: WorldLocationPlacementState) => void
  onViewMap: (mapId: string | null) => void
  onChange: (selection: WorldLocationPlacementSelection | null) => void
}) {
  const { port, locationId, initialHint, onReady, onViewMap, onChange } =
    options
  const initialMapId = initialHint?.mapId
  const initialQ = initialHint?.coordinate?.q
  const initialR = initialHint?.coordinate?.r
  const cache = port.cache
  const notifyReady = useEffectEvent(onReady)
  const onViewMapRef = useRef(onViewMap)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onViewMapRef.current = onViewMap
    onChangeRef.current = onChange
  }, [onChange, onViewMap])
  const [catalog, setCatalog] = useState<HexMapCatalogSnapshot | null>(null)
  const [biomes, setBiomes] = useState<HexBiomeCatalog | null>(null)
  const [map, setMap] = useState<HexMapView | null>(null)
  const [failure, setFailure] = useState<HexPlacementProjectionFailure | null>(
    null
  )
  const mapRef = useRef<HexMapView | null>(null)
  const initializationRequest = useRef(0)
  const mapRequest = useRef(0)
  const viewportRequest = useRef(0)
  const hexRefreshRequest = useRef(0)
  const biomeRefreshRequest = useRef(0)

  const applyMap = useCallback((next: HexMapView | null) => {
    mapRef.current = next
    setMap(next)
    if (next)
      setBiomes((known) =>
        known ? mergeHexBiomeCatalog(known, next.biomes) : known
      )
  }, [])

  useEffect(() => {
    const request = ++initializationRequest.current
    void Promise.allSettled([
      port.currentCatalog()
        ? Promise.resolve(port.currentCatalog()!)
        : port.readCatalog(),
      port.currentBiomeCatalog()
        ? Promise.resolve(port.currentBiomeCatalog()!)
        : port.readBiomeCatalog(),
      locationId ? port.locateLocation(locationId) : Promise.resolve(null)
    ]).then(async ([catalogResult, biomeResult, placementResult]) => {
      if (request !== initializationRequest.current) return
      if (catalogResult.status === 'fulfilled') setCatalog(catalogResult.value)
      if (biomeResult.status === 'fulfilled') setBiomes(biomeResult.value)
      if (catalogResult.status === 'rejected') {
        setFailure({
          source: 'catalog',
          kind: 'unavailable',
          cause: catalogResult.reason
        })
        return
      }
      if (biomeResult.status === 'rejected') {
        setFailure({
          source: 'biomes',
          kind: 'unavailable',
          cause: biomeResult.reason
        })
        return
      }
      setFailure(null)

      const existing =
        placementResult.status === 'fulfilled' ? placementResult.value : null
      const mapId =
        existing?.mapId ?? initialMapId ?? catalogResult.value.maps[0]?.id
      const summary = catalogResult.value.maps.find(
        (entry) => entry.id === mapId
      )
      const coordinate =
        existing?.coordinate ??
        (initialQ === undefined || initialR === undefined
          ? undefined
          : { q: initialQ, r: initialR })
      const original = existing
        ? { mapId: existing.mapId, coordinate: existing.coordinate }
        : null
      // A deleted map reference is a conflict, not an implicit remove intent.
      const current =
        summary && coordinate
          ? { mapId: summary.id, coordinate }
          : existing
            ? original
            : null
      notifyReady({
        viewedMapId: summary?.id ?? null,
        placementDraft: { baseline: original, current }
      })

      if (summary) {
        try {
          const nextMap = await cache.readMapView(
            summary,
            coordinate ?? { q: 0, r: 0 }
          )
          if (request !== initializationRequest.current) return
          applyMap(nextMap)
        } catch (cause) {
          if (request !== initializationRequest.current) return
          setFailure({ source: 'map', kind: 'unavailable', cause })
          return
        }
      }
      if (existing && !summary) {
        setFailure({ source: 'placement', kind: 'map-missing' })
        return
      }
      if (placementResult.status === 'rejected')
        setFailure({
          source: 'placement',
          kind: 'unavailable',
          cause: placementResult.reason
        })
    })
    return () => {
      initializationRequest.current += 1
    }
  }, [applyMap, cache, initialMapId, initialQ, initialR, locationId, port])

  const refreshHex = (
    change: Extract<HexPlacementProjectionChange, { kind: 'hex' }>
  ) => {
    const current = mapRef.current
    if (!current || !change.notice.mapIds.includes(current.map.id)) return
    if (port.cacheMode === 'transient')
      cache.invalidateChunks(
        current.map.id,
        change.notice.changedChunks
          .filter((chunk) => chunk.mapId === current.map.id)
          .map((chunk) => chunk.key)
      )
    const request = ++hexRefreshRequest.current
    void port
      .readCatalog()
      .then(async (nextCatalog) => {
        const summary = nextCatalog.maps.find(
          (candidate) => candidate.id === current.map.id
        )
        if (!summary) throw new MissingProjectionMapError()
        const nextMap = await cache.readMapView(summary, current.center)
        if (
          request !== hexRefreshRequest.current ||
          mapRef.current?.map.id !== current.map.id
        )
          return
        setCatalog(nextCatalog)
        setFailure(null)
        applyMap(nextMap)
      })
      .catch((cause: unknown) => {
        if (
          request === hexRefreshRequest.current &&
          mapRef.current?.map.id === current.map.id
        )
          setFailure({
            source: 'hex-refresh',
            kind:
              cause instanceof MissingProjectionMapError
                ? 'map-missing'
                : 'unavailable',
            ...(cause instanceof MissingProjectionMapError ? {} : { cause })
          })
      })
  }

  const refreshBiomes = () => {
    const current = mapRef.current
    const request = ++biomeRefreshRequest.current
    if (current && port.cacheMode === 'transient')
      cache.invalidateMap(current.map.id)
    void Promise.all([
      port.readBiomeCatalog(),
      current
        ? cache.readMapView(current.map, current.center, true)
        : Promise.resolve(null)
    ])
      .then(([nextBiomes, nextMap]) => {
        if (
          request !== biomeRefreshRequest.current ||
          (current && mapRef.current?.map.id !== current.map.id)
        )
          return
        setFailure(null)
        setBiomes(nextBiomes)
        if (nextMap) applyMap(nextMap)
      })
      .catch((cause: unknown) => {
        if (
          request === biomeRefreshRequest.current &&
          (!current || mapRef.current?.map.id === current.map.id)
        )
          setFailure({ source: 'biomes', kind: 'unavailable', cause })
      })
  }

  const onProjectionChange = useEffectEvent(
    (change: HexPlacementProjectionChange) => {
      if (change.kind === 'hex') refreshHex(change)
      else refreshBiomes()
    }
  )
  useEffect(() => port.subscribe(onProjectionChange), [port])

  const changeMap = async (mapId: string) => {
    const summary = catalog?.maps.find((entry) => entry.id === mapId)
    if (!summary) return
    const request = ++mapRequest.current
    viewportRequest.current += 1
    try {
      const next = await cache.readMapView(summary)
      if (request !== mapRequest.current) return
      setFailure(null)
      applyMap(next)
      onViewMapRef.current(next.map.id)
    } catch (cause) {
      if (request === mapRequest.current)
        setFailure({ source: 'map', kind: 'unavailable', cause })
    }
  }

  const applyCreatedMap = async (result: HexMapCreationResult) => {
    const request = ++mapRequest.current
    viewportRequest.current += 1
    setCatalog(result.snapshot)
    try {
      const next = await cache.readMapView(result.saved)
      if (request !== mapRequest.current) return
      setFailure(null)
      applyMap(next)
      onViewMapRef.current(next.map.id)
    } catch (cause) {
      if (request === mapRequest.current)
        setFailure({ source: 'map', kind: 'unavailable', cause })
    }
  }

  const choose = (coordinate: AxialCoordinate) => {
    const current = mapRef.current
    if (!current) return
    onChangeRef.current({ mapId: current.map.id, coordinate })
  }

  const loadViewport = (center: AxialCoordinate, halfExtent: number) => {
    const current = mapRef.current
    if (!current) return
    const request = ++viewportRequest.current
    const mapId = current.map.id
    void cache
      .readMapView(current.map, center, false, halfExtent)
      .then((next) => {
        if (
          request !== viewportRequest.current ||
          mapRef.current?.map.id !== mapId
        )
          return
        setFailure(null)
        applyMap(next)
      })
      .catch((cause: unknown) => {
        if (
          request === viewportRequest.current &&
          mapRef.current?.map.id === mapId
        )
          setFailure({ source: 'map', kind: 'unavailable', cause })
      })
  }

  const stable = useMemo<HexPlacementStableData | null>(
    () => (catalog && biomes ? { catalog, biomes, map } : null),
    [biomes, catalog, map]
  )
  const state: HexPlacementProjectionState = stable
    ? failure
      ? { status: 'degraded', data: stable, error: failure }
      : { status: 'ready', data: stable }
    : failure
      ? { status: 'failed', error: failure }
      : { status: 'loading' }

  return {
    state,
    catalog,
    biomes,
    map,
    error: failure,
    changeMap,
    applyCreatedMap,
    choose,
    loadViewport
  }
}

class MissingProjectionMapError extends Error {}
