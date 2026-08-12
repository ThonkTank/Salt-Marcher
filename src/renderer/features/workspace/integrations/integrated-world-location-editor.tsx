import { useState } from 'react'
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
  const [placement, setPlacement] =
    useState<WorldLocationPlacementState | null>(null)
  const [mapCreation, setMapCreation] = useState<
    ((displayName: string) => Promise<HexMapSummary>) | null
  >(null)
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
        aside={(fieldProps) => (
          <HexLocationDraftField
            {...fieldProps}
            port={props.port}
            mapCreation={props.mapCreation}
            requestMapCreation={(create) => setMapCreation(() => create)}
            initialHint={props.initialPlacementHint ?? null}
            state={placement}
            onReady={setPlacement}
            onViewMap={(viewedMapId) =>
              setPlacement((known) =>
                known ? { ...known, viewedMapId } : known
              )
            }
            onChange={(current) =>
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
            }
          />
        )}
        save={async (draft) => {
          const result = await props.save(draft, intent)
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
                    props.close()
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
          invocation={{ kind: 'location-link' }}
          close={() => setMapCreation(null)}
          create={mapCreation}
          created={() => setMapCreation(null)}
          onError={props.onError}
        />
      )}
    </>
  )
}
