import { useRef, useState } from 'react'
import type { HexMapSummary } from '../../../shared/contracts/hex.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { message } from '../../i18n/hex-runtime.de.js'
import type { WorldLocationMapFieldProps } from '../worldplanner/world-location-editor-types.js'
import { CompactHexPlacementView } from './compact-hex-placement-view.js'
import { ExpandedHexPlacementDialog } from './expanded-hex-placement-dialog.js'
import type { HexLocationPlacementProjectionPort } from './hex-location-placement-port.js'
import type { HexMapApplicationPort } from './hex-map-creation-port.js'
import { useHexLocationPlacementDraft } from './use-hex-location-placement-draft.js'
import './hex-location-placement.css'

export function HexLocationDraftField(
  props: WorldLocationMapFieldProps & {
    port: HexLocationPlacementProjectionPort
    mapCreation: HexMapApplicationPort
    requestMapCreation: (
      create: (displayName: string) => Promise<HexMapSummary>
    ) => void
    showExpandedButton?: boolean
    showRemoveSelection?: boolean
  }
) {
  const [expanded, setExpanded] = useState(false)
  const expandedBaseline = useRef(props.state?.placementDraft.current ?? null)
  const projection = useHexLocationPlacementDraft({
    port: props.port,
    locationId: props.locationId,
    initialHint: props.initialHint,
    onReady: props.onReady,
    onViewMap: props.onViewMap,
    onChange: props.onChange
  })
  const currentSelection = props.state?.placementDraft.current ?? null
  const data =
    projection.state.status === 'ready' ||
    projection.state.status === 'degraded'
      ? projection.state.data
      : null
  const selected =
    currentSelection && currentSelection.mapId === data?.map?.map.id
      ? currentSelection.coordinate
      : null
  const errorText = projection.error
    ? projection.error.kind === 'map-missing'
      ? message('hex.editor.mapMissing')
      : capabilityErrorText(projection.error.cause)
    : null

  if (expanded && data?.map)
    return (
      <ExpandedHexPlacementDialog
        locationName={props.locationName}
        map={data.map}
        biomes={data.biomes}
        selected={selected}
        choose={projection.choose}
        loadViewport={projection.loadViewport}
        cancel={() => {
          props.onChange(expandedBaseline.current)
          setExpanded(false)
        }}
        apply={() => setExpanded(false)}
      />
    )

  return (
    <>
      <CompactHexPlacementView
        state={projection.state}
        locationName={props.locationName}
        disabled={props.disabled}
        selection={currentSelection}
        errorText={errorText}
        changeMap={projection.changeMap}
        choose={projection.choose}
        loadViewport={projection.loadViewport}
        createMap={() =>
          props.requestMapCreation(async (displayName) => {
            const result = await props.mapCreation.createMap(displayName)
            await projection.applyCreatedMap(result)
            return result.saved
          })
        }
        {...(currentSelection && props.showRemoveSelection !== false
          ? { removeSelection: () => props.onChange(null) }
          : {})}
        showExpandedButton={props.showExpandedButton !== false}
        expand={() => {
          expandedBaseline.current = props.state?.placementDraft.current ?? null
          setExpanded(true)
        }}
      />
    </>
  )
}
