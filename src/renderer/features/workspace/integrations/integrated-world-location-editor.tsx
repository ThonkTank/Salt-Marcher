import {
  useCallback,
  useId,
  useRef,
  useState,
  type SetStateAction
} from 'react'
import { maintenanceDraftCoordinator } from '../../../shell/maintenance-draft-coordinator.js'
import { HexLocationDraftField } from '../../hex/hex-location-draft-field.js'
import { HexMapDialog } from '../../hex/hex-map-dialog.js'
import type { HexMapProjectionPort } from '../../hex/hex-map-projection-port.js'
import type { HexMapApplicationPort } from '../../hex/hex-map-creation-port.js'
import type {
  WorldLocationEditorRenderProps,
  WorldLocationPlacementFailure,
  WorldLocationPlacementState
} from '../../worldplanner/world-location-editor-types.js'
import { worldLocationPlacementIntent } from '../../worldplanner/world-location-editor-types.js'
import { WorldLocationDialog } from '../../worldplanner/world-location-dialog.js'
import type { HexMapSummary } from '../../../../shared/contracts/hex.js'
import { presentCapabilityError } from '../../../capabilities/capability-errors.js'

export function IntegratedWorldLocationEditor(
  props: WorldLocationEditorRenderProps & {
    port: HexMapProjectionPort
    mapCreation: HexMapApplicationPort
    suggestTags: (query: string, limit?: number) => Promise<readonly string[]>
    failureText: (failure: WorldLocationPlacementFailure) => string
  }
) {
  const [placement, rawSetPlacement] =
    useState<WorldLocationPlacementState | null>(null)
  const placementRef = useRef<WorldLocationPlacementState | null>(null)
  const setPlacement = useCallback(
    (update: SetStateAction<WorldLocationPlacementState | null>) => {
      const next =
        typeof update === 'function' ? update(placementRef.current) : update
      placementRef.current = next
      rawSetPlacement(next)
    },
    []
  )
  type MapDialog = {
    id: string
    create: (displayName: string) => Promise<HexMapSummary>
  }
  const [mapCreation, rawSetMapCreation] = useState<MapDialog | null>(null)
  const mapRef = useRef<MapDialog | null>(null)
  const mapId = useId()
  const mapSequence = useRef(0)
  const setMapCreation = (next: MapDialog | null) => {
    mapRef.current = next
    rawSetMapCreation(next)
  }
  const intent = worldLocationPlacementIntent(placement)
  return (
    <>
      <WorldLocationDialog
        location={props.location}
        references={props.references}
        {...(props.relatedCreation
          ? { relatedCreation: props.relatedCreation }
          : {})}
        suggestTags={props.suggestTags}
        close={props.close}
        externalDirty={intent.kind !== 'keep'}
        hasExternalChanges={() =>
          worldLocationPlacementIntent(placementRef.current).kind !== 'keep'
        }
        maintenanceDependencies={() =>
          mapRef.current ? [mapRef.current.id] : []
        }
        aside={(fieldProps) => (
          <HexLocationDraftField
            {...fieldProps}
            port={props.port}
            mapCreation={props.mapCreation}
            requestMapCreation={(create) => {
              if (fieldProps.disabled || maintenanceDraftCoordinator.isLocked())
                return
              setMapCreation({
                id: `${mapId}/map/${++mapSequence.current}`,
                create
              })
            }}
            initialHint={props.initialPlacementHint ?? null}
            state={placement}
            onReady={setPlacement}
            onViewMap={(viewedMapId) =>
              setPlacement((known) =>
                known ? { ...known, viewedMapId } : known
              )
            }
            onChange={(current) => {
              if (fieldProps.disabled || maintenanceDraftCoordinator.isLocked())
                return
              setPlacement((known) =>
                known
                  ? {
                      ...known,
                      placementDraft: { ...known.placementDraft, current }
                    }
                  : {
                      viewedMapId: current?.mapId ?? null,
                      placementDraft: { baseline: null, current }
                    }
              )
            }}
          />
        )}
        save={async (draft) => {
          const result = await props.save(
            draft,
            worldLocationPlacementIntent(placementRef.current)
          )
          return result.status === 'partially-saved'
            ? {
                status: 'partially-saved',
                message: props.failureText(result.placementFailure),
                retry: async () => {
                  try {
                    const retried = await result.retry()
                    if (retried.status === 'rejected')
                      return {
                        status: 'failed' as const,
                        message: props.failureText(retried.failure)
                      }
                    return { status: 'saved' as const }
                  } catch (cause) {
                    return {
                      status: 'failed' as const,
                      message: presentCapabilityError(cause, props.onError)
                    }
                  }
                }
              }
            : result
        }}
      />
      {mapCreation && (
        <HexMapDialog
          maintenanceId={mapCreation.id}
          invocation={{ kind: 'location-link' }}
          close={() => setMapCreation(null)}
          create={mapCreation.create}
          created={() => setMapCreation(null)}
          onError={props.onError}
        />
      )}
    </>
  )
}
