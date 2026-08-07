import { useCallback, useEffect, useRef } from 'react'
import type {
  AxialCoordinate,
  HexBiomeCatalog,
  HexMapView
} from '../../../shared/contracts/hex.js'
import { reportCapabilityError } from '../../capabilities/capability-errors.js'
import type { HexCapabilities } from './hex-capabilities.js'
import { HexChunkCache, mergeHexBiomeCatalog } from './hex-chunk-cache.js'
import type { useHexEditorController } from './use-hex-editor-controller.js'
import type { useWorldLocationProjectionController } from './use-world-location-projection-controller.js'

type EditorController = ReturnType<typeof useHexEditorController>
type LocationProjectionController = ReturnType<
  typeof useWorldLocationProjectionController
>

/** Owns bootstrap, catalog selection, chunk cache, viewport and map events. */
export function useHexMapController(options: {
  capabilities: HexCapabilities
  editor: EditorController
  locations: LocationProjectionController
  onError: (message: string) => void
}) {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])
  const viewportRequest = useRef(0)
  const mapSelectionRequest = useRef(0)
  const biomeRequest = useRef(0)
  const viewportHalfExtent = useRef(64)
  const mapRef = useRef(options.editor.map)
  useEffect(() => {
    mapRef.current = options.editor.map
  }, [options.editor.map])
  const chunkCache = useRef(
    new HexChunkCache((mapId, keys) =>
      options.capabilities.hex.readChunks(mapId, keys)
    )
  )

  const readOverlays = useCallback(
    async (mapId: string) => {
      const projection = await options.capabilities.hex.runtimeOverlays(mapId)
      return projection.overlays.map((overlay) => ({
        id: overlay.sceneId,
        label: overlay.label,
        token: overlay.token,
        route: overlay.route,
        focused: overlay.focused
      }))
    },
    [options.capabilities.hex]
  )

  const loadViewport = useCallback(
    async (
      currentMap: HexMapView,
      center: AxialCoordinate,
      halfExtent: number
    ) => {
      viewportHalfExtent.current = halfExtent
      const request = ++viewportRequest.current
      const next = await chunkCache.current.readMapView(
        currentMap.map,
        center,
        false,
        halfExtent
      )
      if (request === viewportRequest.current) {
        optionsRef.current.editor.setMap(next)
        optionsRef.current.editor.setBiomes((current) =>
          current ? mergeHexBiomeCatalog(current, next.biomes) : current
        )
      }
    },
    []
  )

  const refreshCatalog = useCallback(
    async (preferred?: string) => {
      const { capabilities, editor } = optionsRef.current
      const request = ++mapSelectionRequest.current
      const next = await capabilities.hex.catalog()
      if (request !== mapSelectionRequest.current) return
      editor.setCatalog(next)
      const current = mapRef.current
      const mapId = preferred ?? current?.map.id ?? next.maps[0]?.id
      const summary = next.maps.find((entry) => entry.id === mapId)
      if (!summary) {
        editor.setMap(null)
        editor.setSelected(null)
        editor.setOverlays([])
        editor.setHistory({
          canUndo: false,
          canRedo: false,
          undoLabel: null,
          redoLabel: null
        })
        return
      }
      const nextMap = await chunkCache.current.readMapView(
        summary,
        current?.map.id === summary.id ? current.center : undefined
      )
      if (request !== mapSelectionRequest.current) return
      editor.setMap(nextMap)
      editor.setBiomes((biomes) =>
        biomes ? mergeHexBiomeCatalog(biomes, nextMap.biomes) : biomes
      )
      editor.setName(nextMap.map.displayName)
      const [history, overlays] = await Promise.all([
        capabilities.hex.history(nextMap.map.id),
        readOverlays(nextMap.map.id)
      ])
      if (request !== mapSelectionRequest.current) return
      editor.setHistory(history)
      editor.setOverlays(overlays)
    },
    [readOverlays]
  )

  const refreshBiomes = useCallback(async () => {
    const request = ++biomeRequest.current
    const { capabilities, editor } = optionsRef.current
    const baseline = await capabilities.hex.biomeCatalog()
    if (request !== biomeRequest.current) return
    const current = mapRef.current
    let biomes: HexBiomeCatalog = baseline
    if (current) {
      chunkCache.current.invalidateMap(current.map.id)
      const nextMap = await chunkCache.current.readMapView(
        current.map,
        current.center,
        true,
        viewportHalfExtent.current
      )
      if (request !== biomeRequest.current) return
      editor.setMap(nextMap)
      biomes = mergeHexBiomeCatalog(baseline, nextMap.biomes)
    }
    editor.setBiomes(biomes)
    if (!biomes.biomes.some((biome) => biome.id === editor.biomeId))
      editor.setBiomeId('grassland')
  }, [])

  useEffect(() => {
    const request = ++mapSelectionRequest.current
    const { capabilities } = optionsRef.current
    void capabilities.hex
      .editorBootstrap()
      .then(async (bootstrap) => {
        if (request !== mapSelectionRequest.current) return
        const symbols = await capabilities.locationSymbols.search('', 0, 24)
        if (request !== mapSelectionRequest.current) return
        const { editor, locations } = optionsRef.current
        editor.setCatalog(bootstrap.catalog)
        editor.setBiomes(bootstrap.biomes)
        locations.replace(bootstrap.locations)
        editor.setSymbols(symbols)
        editor.setLocationId(bootstrap.locations.locations[0]?.id ?? '')
        const first = bootstrap.catalog.maps[0]
        if (!first) return
        const nextMap = await chunkCache.current.readMapView(first)
        if (request !== mapSelectionRequest.current) return
        editor.setMap(nextMap)
        editor.setBiomes(mergeHexBiomeCatalog(bootstrap.biomes, nextMap.biomes))
        editor.setName(nextMap.map.displayName)
        const [history, overlays] = await Promise.all([
          capabilities.hex.history(nextMap.map.id),
          readOverlays(nextMap.map.id)
        ])
        if (request !== mapSelectionRequest.current) return
        editor.setHistory(history)
        editor.setOverlays(overlays)
      })
      .catch(reportCapabilityError(optionsRef.current.onError))
    return () => {
      mapSelectionRequest.current += 1
      biomeRequest.current += 1
    }
  }, [options.capabilities, readOverlays])

  useEffect(
    () =>
      options.capabilities.hex.onChanged((notice) => {
        for (const mapId of notice.mapIds)
          chunkCache.current.invalidateChunks(
            mapId,
            notice.changedChunks
              .filter((chunk) => chunk.mapId === mapId)
              .map((chunk) => chunk.key)
          )
        const current = mapRef.current
        if (!current || !notice.mapIds.includes(current.map.id)) return
        const request = ++viewportRequest.current
        void Promise.all([
          chunkCache.current.readMapView(
            current.map,
            current.center,
            false,
            viewportHalfExtent.current
          ),
          options.capabilities.hex.history(current.map.id),
          readOverlays(current.map.id)
        ])
          .then(([map, history, overlays]) => {
            if (request !== viewportRequest.current) return
            const editor = optionsRef.current.editor
            editor.setMap(map)
            editor.setBiomes((biomes) =>
              biomes ? mergeHexBiomeCatalog(biomes, map.biomes) : biomes
            )
            editor.setHistory(history)
            editor.setOverlays(overlays)
          })
          .catch(reportCapabilityError(optionsRef.current.onError))
      }),
    [options.capabilities.hex, readOverlays]
  )

  useEffect(
    () =>
      options.capabilities.biomes.onChanged(() => {
        void refreshBiomes().catch(
          reportCapabilityError(optionsRef.current.onError)
        )
      }),
    [options.capabilities.biomes, refreshBiomes]
  )

  useEffect(() => () => chunkCache.current.clear(), [])

  return {
    chunkCache,
    mapRef,
    viewportRequest,
    viewportHalfExtent,
    readOverlays,
    loadViewport,
    refreshCatalog,
    refreshBiomes
  }
}
