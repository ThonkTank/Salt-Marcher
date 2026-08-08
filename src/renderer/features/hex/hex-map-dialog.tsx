import { useReducer, useRef, useState } from 'react'
import type { HexMapSummary } from '../../../shared/contracts/hex.js'
import { presentCapabilityError } from '../../capabilities/capability-errors.js'
import { message } from '../../i18n/hex-runtime.de.js'
import { EditorDialogFrame } from '../../shell/editor-dialog-frame.js'
import {
  DiscardChangesDialog,
  ModalCloseButton
} from '../../shell/modal-dialog.js'
import './hex-map-dialog.css'
import {
  executePersistedSubmission,
  PersistedSubmissionLifecycle,
  retryPersistedSubmissionReconciliation
} from '../shared/submission-lifecycle.js'
import {
  createHexMapNameDraftState,
  hexMapNameDraftDirty,
  hexMapNameDraftReducer,
  hexMapNameDraftValue
} from './hex-map-draft.js'

export type HexMapEditorInvocation =
  Readonly<{ kind: 'catalog' }> | Readonly<{ kind: 'location-link' }>

export function HexMapDialog(props: {
  close: () => void
  create: (displayName: string) => Promise<HexMapSummary>
  created: (map: HexMapSummary) => void
  onError: (message: string) => void
  invocation: HexMapEditorInvocation
}) {
  const [draft, dispatch] = useReducer(
    hexMapNameDraftReducer,
    '',
    createHexMapNameDraftState
  )
  const [busy, setBusy] = useState(false)
  const [persisted, setPersisted] = useState(false)
  const [reconciliationFailed, setReconciliationFailed] = useState(false)
  const [error, setError] = useState('')
  const [discardOpen, setDiscardOpen] = useState(false)
  const submission = useRef(new PersistedSubmissionLifecycle<HexMapSummary>())
  const displayName = draft.displayName
  const dirty = hexMapNameDraftDirty(draft)
  const requestClose = () => {
    if (busy) return
    if (dirty) setDiscardOpen(true)
    else props.close()
  }

  return (
    <>
      <EditorDialogFrame
        className="hex-map-dialog"
        ariaLabel={message('hex.map.createTitle')}
        busy={busy}
        onClose={requestClose}
        breadcrumb={
          props.invocation.kind === 'location-link'
            ? message('hex.map.locationBreadcrumb')
            : message('hex.map.catalogBreadcrumb')
        }
        title={message('hex.map.createTitle')}
        closeLabel={message('ui.dialog.schliessen')}
        onSubmit={() => {
          const name = hexMapNameDraftValue(draft)
          if (!name || busy || persisted) return
          setBusy(true)
          setError('')
          void executePersistedSubmission(
            submission.current,
            () => props.create(name),
            props.created
          ).then((outcome) => {
            if (
              outcome.status === 'reconciled' ||
              outcome.status === 'reconciliation-failed'
            )
              setPersisted(true)
            setReconciliationFailed(outcome.status === 'reconciliation-failed')
            if (
              outcome.status === 'mutation-failed' ||
              outcome.status === 'reconciliation-failed'
            )
              setError(presentCapabilityError(outcome.cause, props.onError))
            setBusy(false)
          })
        }}
        footer={
          <>
            <span>
              {displayName.trim()
                ? message('hex.map.ready')
                : message('hex.map.nameRequired')}
            </span>
            <div>
              <ModalCloseButton>{message('action.cancel')}</ModalCloseButton>
              <button
                className="hex-map-primary"
                disabled={busy || persisted || !displayName.trim()}
              >
                {props.invocation.kind === 'location-link'
                  ? message('action.createAndLink')
                  : message('action.create')}
              </button>
              {reconciliationFailed && (
                <button
                  type="button"
                  className="hex-map-primary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true)
                    setError('')
                    void retryPersistedSubmissionReconciliation(
                      submission.current,
                      props.created
                    ).then((outcome) => {
                      setReconciliationFailed(
                        outcome.status === 'reconciliation-failed'
                      )
                      if (outcome.status === 'reconciliation-failed')
                        setError(
                          presentCapabilityError(outcome.cause, props.onError)
                        )
                      setBusy(false)
                    })
                  }}
                >
                  {message('action.retry')}
                </button>
              )}
            </div>
          </>
        }
      >
        <div className="hex-map-dialog-body">
          <label>
            {message('ui.name')}
            <input
              autoFocus
              required
              maxLength={100}
              aria-label={message('hex.editor.mapName')}
              disabled={busy}
              value={displayName}
              onChange={(event) =>
                dispatch({ kind: 'name', value: event.target.value })
              }
            />
          </label>
          <p>{message('hex.map.nameEnough')}</p>
          {error && <p role="alert">{error}</p>}
        </div>
      </EditorDialogFrame>
      {discardOpen && (
        <DiscardChangesDialog
          message={message('ui.ungespeicherte.aenderungen.verwerfen')}
          cancelLabel={message('action.cancel')}
          discardLabel={message('ui.aenderungen.verwerfen')}
          onCancel={() => setDiscardOpen(false)}
          onDiscard={props.close}
        />
      )}
    </>
  )
}
