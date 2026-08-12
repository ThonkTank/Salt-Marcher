import { useState } from 'react'
import type { HexMapSummary } from '../../../shared/contracts/hex.js'
import { presentCapabilityError } from '../../capabilities/capability-errors.js'
import { message } from '../../i18n/hex-runtime.de.js'
import { ModalCloseButton, ModalDialog } from '../../shell/modal-dialog.js'
import type {
  WorldLocationPlacementCommitResult,
  WorldLocationPlacementFailure,
  WorldLocationPlacementIntent,
  WorldLocationPlacementState,
  WorldLocationPlacementDialogRenderProps
} from '../worldplanner/world-location-editor-types.js'
import { worldLocationPlacementIntent } from '../worldplanner/world-location-editor-types.js'
import { HexLocationDraftField } from './hex-location-draft-field.js'
import type { HexMapProjectionPort } from './hex-map-projection-port.js'
import type { HexMapApplicationPort } from './hex-map-creation-port.js'
import { HexMapDialog } from './hex-map-dialog.js'
import './hex-location-placement.css'

export function HexLocationPlacementDialog(
  props: WorldLocationPlacementDialogRenderProps & {
    port: HexMapProjectionPort
    mapCreation: HexMapApplicationPort
    commitPlacement: (
      locationId: string,
      intent: WorldLocationPlacementIntent
    ) => Promise<WorldLocationPlacementCommitResult>
    failureText: (failure: WorldLocationPlacementFailure) => string
  }
) {
  const [state, setState] = useState<WorldLocationPlacementState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mapCreation, setMapCreation] = useState<
    ((displayName: string) => Promise<HexMapSummary>) | null
  >(null)
  const persist = async (intent: WorldLocationPlacementIntent) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await props.commitPlacement(props.location.id, intent)
      if (result.status === 'rejected') {
        setError(props.failureText(result.failure))
        return
      }
      props.onPlaced()
      props.close()
    } catch (cause) {
      setError(presentCapabilityError(cause, props.onError))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <ModalDialog
        busy={busy}
        className="hex-placement-dialog"
        ariaLabel={message('ui.ort.auf.hex.karte.platzieren')}
        onClose={props.close}
      >
        <header>
          <div>
            <p className="section-kicker">{message('ui.ort.platzieren')}</p>
            <h2>{props.location.displayName}</h2>
          </div>
          <ModalCloseButton aria-label={message('action.close')}>
            ×
          </ModalCloseButton>
        </header>
        <HexLocationDraftField
          port={props.port}
          mapCreation={props.mapCreation}
          requestMapCreation={(create) => setMapCreation(() => create)}
          locationId={props.location.id}
          locationName={props.location.displayName}
          disabled={busy}
          initialHint={null}
          state={state}
          showExpandedButton={false}
          showRemoveSelection={false}
          onReady={setState}
          onViewMap={(viewedMapId) =>
            setState((known) => (known ? { ...known, viewedMapId } : known))
          }
          onChange={(current) =>
            setState((known) =>
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
        {error && <p role="alert">{error}</p>}
        <footer>
          <ModalCloseButton>{message('action.cancel')}</ModalCloseButton>
          {state?.placementDraft.baseline && (
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => void persist({ kind: 'remove' })}
            >
              {message('ui.von.karte.entfernen')}
            </button>
          )}
          <button
            type="button"
            disabled={busy || !state?.placementDraft.current}
            onClick={() => void persist(worldLocationPlacementIntent(state))}
          >
            {message('ui.hier.platzieren')}
          </button>
        </footer>
      </ModalDialog>
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
