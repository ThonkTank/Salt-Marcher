import { useEffect, useEffectEvent, useRef } from 'react'
import type {
  AxialCoordinate,
  HexBrushStrokeResult
} from '../../../shared/contracts/hex.js'
import { message } from '../../i18n/messages.de.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { brushLevelToRadius } from './hex-brush.js'
import type { HexCapabilities } from './hex-capabilities.js'
import { HexCommandQueue } from './hex-command-queue.js'
import { executeRecoverableHexCommand } from './hex-command-executor.js'
import { createHexLocationPlacementController } from './hex-location-placement-controller.js'
import type { useHexEditorController } from './use-hex-editor-controller.js'
import type { useHexMapController } from './use-hex-map-controller.js'

type EditorController = ReturnType<typeof useHexEditorController>
type MapController = ReturnType<typeof useHexMapController>

/** Serializes all mutating map commands and reconciles their projections. */
export function useHexCommandController(options: {
  capabilities: HexCapabilities
  editor: EditorController
  maps: MapController
  onError: (message: string) => void
}) {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])
  const queue = useRef(new HexCommandQueue())
  const placement = useRef(
    createHexLocationPlacementController(options.capabilities.hex)
  )
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> =>
    queue.current.enqueue(operation)

  const applyResult = async (result: HexBrushStrokeResult) => {
    const { editor, maps, onError } = optionsRef.current
    if (result.status === 'rejected') {
      onError(
        result.reason === 'stroke_too_large'
          ? message('hex.editor.strokeTooLarge')
          : result.reason === 'history_empty'
            ? message('hex.editor.historyEmpty')
            : result.reason === 'location_occupied'
              ? message('hex.editor.locationOccupied')
              : result.reason === 'tile_missing'
                ? message('hex.editor.tileMissing')
                : result.reason === 'location_not_placed'
                  ? message('hex.editor.locationNotPlaced')
                  : message('hex.editor.staleMutation')
      )
      return result
    }
    if (result.status !== 'applied') return result
    const summaries = new Map(
      result.maps.map((summary) => [summary.id, summary])
    )
    editor.setCatalog((current) => {
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
      maps.chunkCache.current.invalidateChunks(
        summary.id,
        result.changedChunks
          .filter((chunk) => chunk.mapId === summary.id)
          .map((chunk) => chunk.key)
      )
    const currentMap = maps.mapRef.current
    const summary = currentMap ? summaries.get(currentMap.map.id) : undefined
    if (currentMap && summary) {
      maps.mapRef.current = { ...currentMap, map: summary }
      const request = ++maps.viewportRequest.current
      const nextMap = await maps.chunkCache.current.readMapView(
        summary,
        currentMap.center,
        false,
        maps.viewportHalfExtent.current
      )
      if (request === maps.viewportRequest.current) {
        maps.mapRef.current = nextMap
        editor.setMap(nextMap)
      }
    }
    editor.setPendingErase(null)
    editor.setHistory(result.history)
    if (
      result.warnings.some(
        (warning) => warning.code === 'deleted_location_skipped'
      )
    )
      onError(message('hex.editor.deletedLocationSkipped'))
    return result
  }

  const create = async (displayName: string) => {
    const { editor, capabilities, maps, onError } = optionsRef.current
    if (!editor.catalog) return
    const commandId = crypto.randomUUID()
    const expectedCatalogRevision = editor.catalog.revision
    return enqueue(async () => {
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
        if (result.status !== 'applied') return void (await applyResult(result))
        editor.setSelected(null)
        await applyResult(result)
        await maps.refreshCatalog(result.maps[0]!.id)
      } catch (cause) {
        onError(capabilityErrorText(cause))
      }
    })
  }

  const saveMetadata = async () => {
    const { editor, capabilities, maps, onError } = optionsRef.current
    if (!editor.map) return
    const commandId = crypto.randomUUID()
    const displayName = editor.name
    return enqueue(async () => {
      const current = maps.mapRef.current
      if (!current) return
      try {
        await applyResult(
          await executeRecoverableHexCommand(
            commandId,
            () =>
              capabilities.hex.updateMetadata({
                commandId,
                mapId: current.map.id,
                displayName,
                expectedMetadataRevision: current.map.metadataRevision
              }),
            (receiptId) => capabilities.hex.commandReceipt(receiptId)
          )
        )
      } catch (cause) {
        onError(capabilityErrorText(cause))
      }
    })
  }

  const changeHistory = async (
    direction: 'undo' | 'redo',
    confirmationToken: string | null = null,
    commandId: string = crypto.randomUUID()
  ) =>
    enqueue(async () => {
      const { editor, capabilities, maps, onError } = optionsRef.current
      const current = maps.mapRef.current
      if (!current) return
      try {
        const result = await executeRecoverableHexCommand(
          commandId,
          () =>
            capabilities.hex[direction]({
              commandId,
              mapId: current.map.id,
              expectedContentRevision: current.map.contentRevision,
              confirmationToken
            }),
          (receiptId) => capabilities.hex.commandReceipt(receiptId)
        )
        if (result.status === 'confirmation_required') {
          editor.setPendingHistory({
            direction,
            commandId,
            confirmationToken: result.confirmationToken,
            impact: result.impact
          })
          return
        }
        editor.setPendingHistory(null)
        await applyResult(result)
      } catch (cause) {
        onError(capabilityErrorText(cause))
      }
    })

  const triggerHistoryShortcut = useEffectEvent(
    (direction: 'undo' | 'redo') => {
      void changeHistory(direction)
    }
  )

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
      triggerHistoryShortcut(direction)
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  }, [])

  const applyCoordinates = async (
    path: readonly AxialCoordinate[],
    confirmationToken: string | null = null,
    requestedRadius?: number,
    commandId: string = crypto.randomUUID()
  ) => {
    const { editor, capabilities, maps, onError } = optionsRef.current
    const mode = confirmationToken ? 'erase' : editor.terrainMode
    if (editor.tool !== 'terrain' && !confirmationToken) return
    const radius = requestedRadius ?? brushLevelToRadius(editor.brushLevel)
    const terrainId = mode === 'paint' ? editor.terrainId : null
    return enqueue(async () => {
      const current = maps.mapRef.current
      if (!current) return
      try {
        const result = await executeRecoverableHexCommand(
          commandId,
          () =>
            capabilities.hex.applyBrushStroke({
              commandId,
              mapId: current.map.id,
              mode,
              terrainId,
              path: [...path],
              radius,
              expectedContentRevision: current.map.contentRevision,
              confirmationToken
            }),
          (receiptId) => capabilities.hex.commandReceipt(receiptId),
          () => maps.chunkCache.current.invalidateMap(current.map.id)
        )
        if (result.status === 'confirmation_required') {
          editor.setPendingErase({
            path,
            radius,
            commandId,
            confirmationToken: result.confirmationToken,
            impact: result.impact
          })
          return
        }
        await applyResult(result)
        const overlays = await maps.readOverlays(current.map.id)
        if (maps.mapRef.current?.map.id === current.map.id)
          editor.setOverlays(overlays)
      } catch (cause) {
        onError(capabilityErrorText(cause))
      }
    })
  }

  const placeLocation = async (
    locationId = optionsRef.current.editor.locationId,
    coordinate = optionsRef.current.editor.selected
  ) => {
    const { editor, maps, onError } = optionsRef.current
    if (!editor.map || !coordinate || !locationId) return
    const target = editor.map.tiles.find(
      (tile) => tile.q === coordinate.q && tile.r === coordinate.r
    )
    if (
      !target ||
      (target.location && target.location.locationId !== locationId)
    )
      return
    const commandId = crypto.randomUUID()
    return enqueue(async () => {
      const current = maps.mapRef.current
      if (!current) return
      try {
        await applyResult(
          await placement.current.place({
            commandId,
            mapId: current.map.id,
            locationId,
            coordinate,
            expectedContentRevision: current.map.contentRevision
          })
        )
      } catch (cause) {
        onError(capabilityErrorText(cause))
      }
    })
  }

  const removeLocation = async () => {
    const { editor, maps, onError } = optionsRef.current
    if (!editor.map || !editor.selected) return
    const target = editor.map.tiles.find(
      (tile) => tile.q === editor.selected!.q && tile.r === editor.selected!.r
    )
    if (!target?.location) return
    const commandId = crypto.randomUUID()
    return enqueue(async () => {
      const current = maps.mapRef.current
      if (!current) return
      try {
        await applyResult(
          await placement.current.remove({
            commandId,
            mapId: current.map.id,
            locationId: target.location!.locationId,
            expectedContentRevision: current.map.contentRevision
          })
        )
      } catch (cause) {
        onError(capabilityErrorText(cause))
      }
    })
  }

  return {
    create,
    saveMetadata,
    changeHistory,
    applyCoordinates,
    applyStroke: (path: readonly AxialCoordinate[]) => applyCoordinates(path),
    placeLocation,
    removeLocation
  }
}
