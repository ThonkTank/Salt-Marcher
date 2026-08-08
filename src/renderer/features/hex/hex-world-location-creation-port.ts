import type { WorldLocationSaveReceipt } from '../../../shared/contracts/world-location.js'
import type { WorldLocationPlacementHint } from '../worldplanner/world-location-editor-types.js'
import type { HexLocationPlacementProjectionPort } from './hex-location-placement-port.js'

/** Hex-owned data passed to the workspace integration; no editor implementation. */
export type HexWorldLocationCreationIntegrationProps = Readonly<{
  applyCreated: (created: WorldLocationSaveReceipt) => void
  select: (locationId: string) => void
  initialPlacementHint: WorldLocationPlacementHint | null
  projectionPort: HexLocationPlacementProjectionPort
  close: () => void
}>
