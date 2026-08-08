import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { message } from '../../i18n/worldplanner-runtime.de.js'
import type { WorldLocationPlacementFailure } from './world-location-editor-types.js'

export function worldLocationPlacementFailureText(
  failure: WorldLocationPlacementFailure
): string {
  switch (failure.kind) {
    case 'map-missing':
      return message('hex.editor.mapMissing')
    case 'occupied':
      return message('hex.editor.locationOccupied')
    case 'tile-missing':
      return message('hex.editor.tileMissing')
    case 'location-not-placed':
      return message('hex.editor.locationNotPlaced')
    case 'stale':
    case 'conflict':
      return message('hex.editor.staleMutation')
    case 'unavailable':
      return failure.detail
        ? capabilityErrorText({ code: failure.detail })
        : message('error.unknown')
  }
}
