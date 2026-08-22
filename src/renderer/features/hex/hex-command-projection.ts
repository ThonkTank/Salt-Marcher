import type {
  HexBrushStrokeResult,
  HexMapSummary
} from '../../../shared/contracts/hex.js'
import type { WorldLocationPlacementFailure } from '../../../shared/contracts/world-location.js'
import { message } from '../../i18n/hex-runtime.de.js'
import type { useHexEditorController } from './use-hex-editor-controller.js'
import type { useHexMapController } from './use-hex-map-controller.js'

type EditorController = ReturnType<typeof useHexEditorController>
type MapController = ReturnType<typeof useHexMapController>

export type HexCommandProjectionContext = Readonly<{
  editor: EditorController
  maps: MapController
  onError: (message: string) => void
}>

/** Projects an immutable command result onto catalog, cache and current view. */
export async function projectHexCommandResult(
  context: HexCommandProjectionContext,
  result: HexBrushStrokeResult,
  reportRejected = true
): Promise<HexBrushStrokeResult> {
  const { editor, maps, onError } = context
  if (result.status === 'rejected') {
    if (reportRejected) onError(rejectedHexResultMessage(result))
    return result
  }
  if (result.status !== 'applied') return result
  const summaries = new Map(
    result.maps.map((summary) => [summary.id, summary] as const)
  )
  editor.setCatalog((current) =>
    current
      ? {
          revision: result.catalogRevision,
          maps: mergeMapSummaries(current.maps, result.maps)
        }
      : current
  )
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
    editor.setPendingErase(null)
    editor.setHistory(result.history)
    const request = ++maps.viewportRequest.current
    const nextMap = await maps.chunkCache.current.readMapView(
      summary,
      currentMap.center,
      false,
      maps.viewportHalfExtent.current
    )
    if (
      request === maps.viewportRequest.current &&
      maps.mapRef.current?.map.id === summary.id
    ) {
      maps.mapRef.current = nextMap
      editor.setMap(nextMap)
    }
  }
  if (
    result.warnings.some(
      (warning) => warning.code === 'deleted_location_skipped'
    )
  )
    onError(message('hex.editor.deletedLocationSkipped'))
  return result
}

export function placementFailureMessage(
  failure: WorldLocationPlacementFailure
): string {
  return failure.kind === 'occupied'
    ? message('hex.editor.locationOccupied')
    : failure.kind === 'map-missing'
      ? message('hex.editor.mapMissing')
      : failure.kind === 'tile-missing'
        ? message('hex.editor.tileMissing')
        : failure.kind === 'location-not-placed'
          ? message('hex.editor.locationNotPlaced')
          : message('hex.editor.staleMutation')
}

function rejectedHexResultMessage(result: HexBrushStrokeResult): string {
  if (result.status !== 'rejected') return message('hex.editor.staleMutation')
  return result.reason === 'stroke_too_large'
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
}

function mergeMapSummaries(
  current: readonly HexMapSummary[],
  changed: readonly HexMapSummary[]
): HexMapSummary[] {
  const replacements = new Map(changed.map((entry) => [entry.id, entry]))
  const next = current.map((entry) => replacements.get(entry.id) ?? entry)
  for (const summary of changed)
    if (!next.some((entry) => entry.id === summary.id)) next.push(summary)
  return next
}
