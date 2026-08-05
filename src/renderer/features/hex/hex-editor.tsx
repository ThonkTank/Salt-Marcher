import { message } from '../../i18n/messages.de.js'
import { useCallback, useEffect, useRef } from 'react'
import type {
  AxialCoordinate,
  HexBrushStrokeResult,
  HexMapView,
  HexTerrainId
} from '../../../shared/contracts/hex.js'
import { HexMapCanvas } from './hex-map-canvas.js'
import './hex.css'
import { hexCapabilities } from './hex-capabilities.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import { CatalogCrudControlsView } from '../../shell/catalog-crud-controls-view.js'
import { HexChunkCache } from './hex-chunk-cache.js'
import { HexCommandQueue } from './hex-command-queue.js'
import { createHexLocationPlacementController } from './hex-location-placement-controller.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { executeRecoverableHexCommand } from './hex-command-executor.js'
import { HexImpactDialog } from './hex-impact-dialog.js'
import { useHexEditorController } from './use-hex-editor-controller.js'

export default function HexEditor(props: {
  onError: (message: string) => void
}) {
  const api = useCapabilityApi()
  const capabilities = hexCapabilities(api)
  const controller = useHexEditorController()
  const {
    catalog,
    setCatalog,
    terrains,
    setTerrains,
    locations,
    setLocations,
    map,
    setMap,
    selected,
    setSelected,
    tool,
    setTool,
    terrainId,
    setTerrainId,
    radius,
    setRadius,
    locationId,
    setLocationId,
    overlays,
    setOverlays,
    pendingErase,
    setPendingErase,
    pendingHistory,
    setPendingHistory,
    resetViewSignal,
    setResetViewSignal,
    newName,
    setNewName,
    name,
    setName,
    history,
    setHistory
  } = controller
  const viewportRequest = useRef(0)
  const mapSelectionRequest = useRef(0)
  const viewportHalfExtent = useRef(64)
  const commandQueue = useRef(new HexCommandQueue())
  const chunkCache = useRef(
    new HexChunkCache((mapId, keys) => api.hex.readChunks(mapId, keys))
  )
  const placementController = useRef(
    createHexLocationPlacementController(api.hex)
  )
  const mapRef = useRef(map)
  useEffect(() => {
    mapRef.current = map
  }, [map])
  useEffect(() => () => chunkCache.current.clear(), [])

  const enqueueCommand = <T,>(operation: () => Promise<T>): Promise<T> =>
    commandQueue.current.enqueue(operation)

  const loadViewport = async (
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
    if (request === viewportRequest.current) setMap(next)
  }

  const readOverlays = useCallback(
    async (mapId: string) => {
      const projection = await capabilities.hex.runtimeOverlays(mapId)
      return projection.overlays.map((overlay) => ({
        id: overlay.sceneId,
        label: overlay.label,
        token: overlay.token,
        route: overlay.route,
        focused: overlay.focused
      }))
    },
    [capabilities.hex]
  )

  const refreshCatalog = async (preferred?: string) => {
    const request = ++mapSelectionRequest.current
    const next = await capabilities.hex.catalog()
    if (request !== mapSelectionRequest.current) return
    setCatalog(next)
    const mapId = preferred ?? map?.map.id ?? next.maps[0]?.id
    const summary = next.maps.find((entry) => entry.id === mapId)
    if (!summary) {
      setMap(null)
      setSelected(null)
      setOverlays([])
      setHistory({
        canUndo: false,
        canRedo: false,
        undoLabel: null,
        redoLabel: null
      })
      return
    }
    const nextMap = await chunkCache.current.readMapView(
      summary,
      map?.map.id === summary.id ? map.center : undefined
    )
    if (request !== mapSelectionRequest.current) return
    setMap(nextMap)
    setName(nextMap.map.displayName)
    const [nextHistory, nextOverlays] = await Promise.all([
      capabilities.hex.history(nextMap.map.id),
      readOverlays(nextMap.map.id)
    ])
    if (request !== mapSelectionRequest.current) return
    setHistory(nextHistory)
    setOverlays(nextOverlays)
  }

  useEffect(() => {
    const request = ++mapSelectionRequest.current
    void capabilities.hex
      .editorBootstrap()
      .then(
        async ({
          catalog: nextCatalog,
          terrains: nextTerrains,
          locations: nextLocations
        }) => {
          if (request !== mapSelectionRequest.current) return
          setCatalog(nextCatalog)
          setTerrains(nextTerrains)
          setLocations(nextLocations)
          setLocationId(nextLocations.locations[0]?.id ?? '')
          const first = nextCatalog.maps[0]
          if (first) {
            const nextMap = await chunkCache.current.readMapView(first)
            if (request !== mapSelectionRequest.current) return
            setMap(nextMap)
            setName(nextMap.map.displayName)
            const [nextHistory, nextOverlays] = await Promise.all([
              capabilities.hex.history(nextMap.map.id),
              readOverlays(nextMap.map.id)
            ])
            if (request !== mapSelectionRequest.current) return
            setHistory(nextHistory)
            setOverlays(nextOverlays)
          }
        }
      )
      .catch(reportCapabilityError(props.onError))
  }, [
    capabilities.hex,
    props.onError,
    readOverlays,
    setCatalog,
    setHistory,
    setLocationId,
    setLocations,
    setMap,
    setName,
    setOverlays,
    setTerrains
  ])

  useEffect(() => {
    return capabilities.hex.onChanged((notice) => {
      for (const mapId of notice.mapIds)
        chunkCache.current.invalidateChunks(
          mapId,
          notice.changedChunks
            .filter((chunk) => chunk.mapId === mapId)
            .map((chunk) => chunk.key)
        )
      const currentMap = mapRef.current
      if (!currentMap || !notice.mapIds.includes(currentMap.map.id)) return
      const request = ++viewportRequest.current
      void Promise.all([
        chunkCache.current.readMapView(
          currentMap.map,
          currentMap.center,
          false,
          viewportHalfExtent.current
        ),
        capabilities.hex.history(currentMap.map.id),
        readOverlays(currentMap.map.id)
      ])
        .then(([nextMap, nextHistory, nextOverlays]) => {
          if (request !== viewportRequest.current) return
          setMap(nextMap)
          setHistory(nextHistory)
          setOverlays(nextOverlays)
        })
        .catch(reportCapabilityError(props.onError))
    })
  }, [
    capabilities.hex,
    props.onError,
    readOverlays,
    setHistory,
    setMap,
    setOverlays
  ])

  const create = async () => {
    if (!catalog) return
    const commandId = crypto.randomUUID()
    const displayName = newName
    const expectedCatalogRevision = catalog.revision
    return enqueueCommand(async () => {
      try {
        const result = await executeRecoverableHexCommand(
          commandId,
          () =>
            capabilities.hex.create({
              commandId,
              displayName,
              expectedCatalogRevision
            }),
          (receiptId) => capabilities.hex.commandReceipt(receiptId)
        )
        if (result.status !== 'applied') {
          await applyResult(result)
          return
        }
        setSelected(null)
        await applyResult(result)
        await refreshCatalog(result.maps[0]!.id)
      } catch (cause) {
        props.onError(capabilityErrorText(cause))
      }
    })
  }

  const saveMetadata = async () => {
    if (!map) return
    const commandId = crypto.randomUUID()
    const displayName = name
    return enqueueCommand(async () => {
      const currentMap = mapRef.current
      if (!currentMap) return
      try {
        const result = await executeRecoverableHexCommand(
          commandId,
          () =>
            capabilities.hex.updateMetadata({
              commandId,
              mapId: currentMap.map.id,
              displayName,
              expectedMetadataRevision: currentMap.map.metadataRevision
            }),
          (receiptId) => capabilities.hex.commandReceipt(receiptId)
        )
        await applyResult(result)
      } catch (cause) {
        props.onError(capabilityErrorText(cause))
      }
    })
  }

  const applyResult = async (result: HexBrushStrokeResult) => {
    if (result.status === 'rejected') {
      props.onError(
        result.reason === 'stroke_too_large'
          ? 'Der Pinselstrich ist zu groß. Bitte in kürzere Striche aufteilen.'
          : result.reason === 'history_empty'
            ? 'Für diese Karte ist keine passende Aktion im Verlauf vorhanden.'
            : result.reason === 'location_occupied'
              ? 'Auf diesem Hex ist bereits ein anderer Ort platziert.'
              : result.reason === 'tile_missing'
                ? 'Orte können nur auf angelegten Hexfeldern platziert werden.'
                : result.reason === 'location_not_placed'
                  ? 'Dieser Ort ist auf der Karte nicht platziert.'
                  : 'Die Kartenänderung kann wegen neuerer Änderungen nicht wiederhergestellt werden.'
      )
      return result
    }
    if (result.status !== 'applied') return result
    const summaries = new Map(
      result.maps.map((summary) => [summary.id, summary])
    )
    setCatalog((current) => {
      if (!current) return current
      const nextMaps = current.maps.map(
        (entry) => summaries.get(entry.id) ?? entry
      )
      for (const summary of result.maps)
        if (!nextMaps.some((entry) => entry.id === summary.id))
          nextMaps.push(summary)
      return { revision: result.catalogRevision, maps: nextMaps }
    })
    for (const summary of result.maps)
      chunkCache.current.invalidateChunks(
        summary.id,
        result.changedChunks
          .filter((chunk) => chunk.mapId === summary.id)
          .map((chunk) => chunk.key)
      )
    const currentMap = mapRef.current
    const summary = currentMap ? summaries.get(currentMap.map.id) : undefined
    if (currentMap && summary) {
      mapRef.current = { ...currentMap, map: summary }
      const request = ++viewportRequest.current
      const nextMap = await chunkCache.current.readMapView(
        summary,
        currentMap.center,
        false,
        viewportHalfExtent.current
      )
      if (request === viewportRequest.current) {
        mapRef.current = nextMap
        setMap(nextMap)
      }
    }
    setPendingErase(null)
    setHistory(result.history)
    if (
      result.warnings.some(
        (warning) => warning.code === 'deleted_location_skipped'
      )
    )
      props.onError(
        'Ein inzwischen gelöschter Ort wurde beim Wiederherstellen übersprungen.'
      )
    return result
  }

  const changeHistory = async (
    direction: 'undo' | 'redo',
    confirmationToken: string | null = null,
    commandId: string = crypto.randomUUID()
  ) => {
    return enqueueCommand(async () => {
      const currentMap = mapRef.current
      if (!currentMap) return
      try {
        const result = await executeRecoverableHexCommand(
          commandId,
          () =>
            capabilities.hex[direction]({
              commandId,
              mapId: currentMap.map.id,
              expectedContentRevision: currentMap.map.contentRevision,
              confirmationToken
            }),
          (receiptId) => capabilities.hex.commandReceipt(receiptId)
        )
        if (result.status === 'confirmation_required') {
          setPendingHistory({
            direction,
            commandId,
            confirmationToken: result.confirmationToken,
            impact: result.impact
          })
          return
        }
        setPendingHistory(null)
        await applyResult(result)
      } catch (cause) {
        props.onError(capabilityErrorText(cause))
      }
    })
  }

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const direction =
        event.key.toLowerCase() === 'z' && !event.shiftKey
          ? 'undo'
          : event.key.toLowerCase() === 'y' ||
              (event.key.toLowerCase() === 'z' && event.shiftKey)
            ? 'redo'
            : null
      if (!direction) return
      event.preventDefault()
      void changeHistory(direction)
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  })

  const applyCoordinates = async (
    path: readonly AxialCoordinate[],
    confirmationToken: string | null = null,
    strokeRadius = radius,
    commandId: string = crypto.randomUUID()
  ) => {
    const mode = confirmationToken ? 'erase' : tool
    if (mode !== 'paint' && mode !== 'erase') return
    const queuedTerrain = mode === 'paint' ? terrainId : null
    return enqueueCommand(async () => {
      const currentMap = mapRef.current
      if (!currentMap) return
      try {
        const result = await executeRecoverableHexCommand(
          commandId,
          () =>
            capabilities.hex.applyBrushStroke({
              commandId,
              mapId: currentMap.map.id,
              mode,
              terrainId: queuedTerrain,
              path: [...path],
              radius: strokeRadius,
              expectedContentRevision: currentMap.map.contentRevision,
              confirmationToken
            }),
          (receiptId) => capabilities.hex.commandReceipt(receiptId),
          () => chunkCache.current.invalidateMap(currentMap.map.id)
        )
        if (result.status === 'confirmation_required') {
          setPendingErase({
            path,
            radius: strokeRadius,
            commandId,
            confirmationToken: result.confirmationToken,
            impact: result.impact
          })
          return
        }
        await applyResult(result)
        const nextOverlays = await readOverlays(currentMap.map.id)
        if (mapRef.current?.map.id === currentMap.map.id)
          setOverlays(nextOverlays)
      } catch (cause) {
        props.onError(capabilityErrorText(cause))
      }
    })
  }

  const applyStroke = (path: readonly AxialCoordinate[]) =>
    applyCoordinates(path)

  const placeLocation = async () => {
    if (!map || !selected || !locationId) return
    const target = map.tiles.find(
      (tile) => tile.q === selected.q && tile.r === selected.r
    )
    if (
      !target ||
      (target.location && target.location.locationId !== locationId)
    )
      return
    const commandId = crypto.randomUUID()
    const queuedLocationId = locationId
    const coordinate = selected
    return enqueueCommand(async () => {
      const currentMap = mapRef.current
      if (!currentMap) return
      try {
        const result = await placementController.current.place({
          commandId,
          mapId: currentMap.map.id,
          locationId: queuedLocationId,
          coordinate,
          expectedContentRevision: currentMap.map.contentRevision
        })
        await applyResult(result)
      } catch (cause) {
        props.onError(capabilityErrorText(cause))
      }
    })
  }

  const removeLocation = async () => {
    if (!map || !selected) return
    const target = map.tiles.find(
      (tile) => tile.q === selected.q && tile.r === selected.r
    )
    if (!target?.location) return
    const commandId = crypto.randomUUID()
    const queuedLocationId = target.location.locationId
    return enqueueCommand(async () => {
      const currentMap = mapRef.current
      if (!currentMap) return
      try {
        const result = await placementController.current.remove({
          commandId,
          mapId: currentMap.map.id,
          locationId: queuedLocationId,
          expectedContentRevision: currentMap.map.contentRevision
        })
        await applyResult(result)
      } catch (cause) {
        props.onError(capabilityErrorText(cause))
      }
    })
  }

  if (!catalog || !terrains || !locations)
    return (
      <section className="workspace-panel">
        {message('ui.hex.editor.wird.geladen')}
      </section>
    )
  const tile =
    selected && map
      ? map.tiles.find(
          (candidate) =>
            candidate.q === selected.q && candidate.r === selected.r
        )
      : null
  const targetOccupiedByOtherLocation = Boolean(
    tile?.location && tile.location.locationId !== locationId
  )
  return (
    <section className="hex-editor-workspace">
      <aside className="hex-editor-controls">
        <CatalogCrudControlsView
          title={message('ui.hex.karten')}
          items={catalog.maps.map((entry) => ({
            id: entry.id,
            label: entry.displayName
          }))}
          selectedId={map?.map.id ?? ''}
          emptyLabel={message('ui.keine.karte')}
          selectLabel={message('ui.karte')}
          createLabel={message('ui.neue.karte')}
          createValue={newName}
          createButtonLabel={message('ui.neu')}
          editLabel={message('ui.name')}
          editValue={name}
          saveButtonLabel={message('ui.kartendaten.speichern')}
          onCreateValueChange={setNewName}
          onCreate={create}
          onEditValueChange={setName}
          onSave={saveMetadata}
          onSelect={(mapId) => {
            setSelected(null)
            void refreshCatalog(mapId).catch(
              reportCapabilityError(props.onError)
            )
          }}
        >
          {map && (
            <>
              <div className="tool-row" aria-label={message('hex.tools')}>
                <button
                  aria-pressed={tool === 'select'}
                  onClick={() => setTool('select')}
                >
                  {message('ui.auswahl')}
                </button>
                <button
                  aria-pressed={tool === 'paint'}
                  onClick={() => setTool('paint')}
                >
                  {message('ui.terrain.malen')}
                </button>
                <button
                  aria-pressed={tool === 'erase'}
                  onClick={() => setTool('erase')}
                >
                  {message('hex.eraser')}
                </button>
                <button
                  aria-pressed={tool === 'location'}
                  onClick={() => setTool('location')}
                >
                  {message('ui.ort.platzieren')}
                </button>
              </div>
              {(tool === 'paint' || tool === 'erase') && (
                <label>
                  {message('hex.brushRadius')}: {radius}
                  <input
                    aria-label={message('hex.brushRadius')}
                    type="range"
                    min="0"
                    max="10"
                    value={radius}
                    onChange={(event) => setRadius(Number(event.target.value))}
                  />
                </label>
              )}
              {tool === 'paint' && (
                <label>
                  {message('ui.terrain')}
                  <select
                    value={terrainId}
                    onChange={(event) =>
                      setTerrainId(event.target.value as HexTerrainId)
                    }
                  >
                    {terrains.terrains.map((terrain) => (
                      <option key={terrain.id} value={terrain.id}>
                        {terrain.label} ·{' '}
                        {terrain.passable
                          ? `${terrain.travelCost}×`
                          : message('hex.impassable')}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {tool === 'location' && (
                <label>
                  {message('ui.ort.platzieren')}
                  <select
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                  >
                    <option value="">
                      {message('hex.noLocationSelected')}
                    </option>
                    {locations.locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button onClick={() => setResetViewSignal((value) => value + 1)}>
                {message('hex.resetView')}
              </button>
              <div className="tool-row" aria-label={message('hex.history')}>
                <button
                  disabled={!history.canUndo}
                  onClick={() => void changeHistory('undo')}
                >
                  {message('hex.history.undo')}
                  {history.undoLabel
                    ? `: ${historyLabel(history.undoLabel)}`
                    : ''}
                </button>
                <button
                  disabled={!history.canRedo}
                  onClick={() => void changeHistory('redo')}
                >
                  {message('hex.history.redo')}
                  {history.redoLabel
                    ? `: ${historyLabel(history.redoLabel)}`
                    : ''}
                </button>
              </div>
            </>
          )}
        </CatalogCrudControlsView>
      </aside>
      <section
        className="hex-editor-map"
        aria-label={message('ui.kartenansicht')}
      >
        {map ? (
          <HexMapCanvas
            snapshot={map}
            terrains={terrains}
            selected={selected}
            overlays={overlays}
            interaction={tool}
            brushRadius={radius}
            brushTerrainId={terrainId}
            resetViewSignal={resetViewSignal}
            onTileClick={setSelected}
            onStrokeComplete={(path) => void applyStroke(path)}
            onViewportChange={(center, halfExtent) =>
              void loadViewport(map, center, halfExtent).catch(
                reportCapabilityError(props.onError)
              )
            }
            ariaLabel={`Hex-Editor ${map.map.displayName}`}
          />
        ) : (
          <div className="session-map-empty">
            {message('ui.erstelle.eine.hex.karte')}
          </div>
        )}
      </section>
      <aside className="hex-editor-state">
        <h2>{message('ui.hexfeld')}</h2>
        {selected ? (
          <>
            <strong>{`Hex q=${selected.q}, r=${selected.r}`}</strong>
            {tile ? (
              <>
                <p>
                  {
                    terrains.terrains.find(
                      (terrain) => terrain.id === tile.terrainId
                    )?.label
                  }
                </p>
                <p>
                  {tile.location?.displayName ?? message('hex.noNamedLocation')}
                </p>
              </>
            ) : (
              <p>{message('hex.emptyTile')}</p>
            )}
            {tool === 'location' && (
              <>
                {targetOccupiedByOtherLocation && (
                  <p role="alert">{message('hex.locationOccupied')}</p>
                )}
                <button
                  disabled={
                    !tile || !locationId || targetOccupiedByOtherLocation
                  }
                  onClick={() => void placeLocation()}
                >
                  {message('ui.hier.platzieren')}
                </button>
                {tile?.location && (
                  <button
                    className="danger"
                    onClick={() => void removeLocation()}
                  >
                    {message('hex.removeLocation')}
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <p>{message('ui.waehle.ein.hexfeld.aus')}</p>
        )}
      </aside>
      {pendingErase && (
        <HexImpactDialog
          impact={pendingErase.impact}
          cancel={() => setPendingErase(null)}
          confirm={() =>
            void applyCoordinates(
              pendingErase.path,
              pendingErase.confirmationToken,
              pendingErase.radius,
              pendingErase.commandId
            )
          }
        />
      )}
      {pendingHistory && (
        <HexImpactDialog
          impact={pendingHistory.impact}
          cancel={() => setPendingHistory(null)}
          confirm={() =>
            void changeHistory(
              pendingHistory.direction,
              pendingHistory.confirmationToken,
              pendingHistory.commandId
            )
          }
        />
      )}
    </section>
  )
}

function historyLabel(code: string): string {
  switch (code) {
    case 'paint':
      return message('hex.history.paint')
    case 'erase':
      return message('hex.history.erase')
    case 'location_place':
      return message('hex.history.locationPlace')
    case 'location_move':
      return message('hex.history.locationMove')
    case 'location_remove':
      return message('hex.history.locationRemove')
    default:
      return code
  }
}
