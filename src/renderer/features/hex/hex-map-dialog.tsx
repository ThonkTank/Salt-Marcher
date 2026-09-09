import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
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
  maintenanceId?: string
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
  const draftRef = useRef(draft)
  const settled = useRef(false)
  const pending = useRef<Promise<boolean> | null>(null)
  const blocked = useMaintenanceDraft(
    {
      label: `Hexkarte: ${draft.displayName.trim() || 'Neue Karte'}`,
      isDirty: () =>
        !settled.current &&
        (pending.current !== null || hexMapNameDraftDirty(draftRef.current)),
      save: saveDraft,
      discard: discardDraft
    },
    props.maintenanceId
  )
  function saveDraft(): Promise<boolean> {
    if (pending.current) return pending.current
    if (submission.current.phase === 'reconciled') return Promise.resolve(true)
    const name = hexMapNameDraftValue(draftRef.current)
    if (!name) return Promise.resolve(false)
    setBusy(true)
    setError('')
    const operation = Promise.resolve()
      .then(() =>
        submission.current.persistedValue !== null
          ? retryPersistedSubmissionReconciliation(
              submission.current,
              props.created
            )
          : executePersistedSubmission(
              submission.current,
              () => props.create(name),
              props.created
            )
      )
      .then((outcome) => {
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
        settled.current = outcome.status === 'reconciled'
        return settled.current
      })
      .finally(() => {
        pending.current = null
        setBusy(false)
      })
    pending.current = operation
    return operation
  }
  async function discardDraft(): Promise<boolean> {
    if (pending.current) await pending.current.catch(() => false)
    props.close()
    settled.current = true
    return true
  }
  const inputBlocked = () =>
    maintenanceDraftCoordinator.isLocked() || pending.current !== null
  const displayName = draft.displayName
  const dirty = hexMapNameDraftDirty(draft)
  const requestClose = () => {
    if (inputBlocked()) return
    if (dirty) setDiscardOpen(true)
    else props.close()
  }

  return (
    <>
      <EditorDialogFrame
        className="hex-map-dialog"
        ariaLabel={message('hex.map.createTitle')}
        busy={busy || blocked}
        onClose={requestClose}
        breadcrumb={
          props.invocation.kind === 'location-link'
            ? message('hex.map.locationBreadcrumb')
            : message('hex.map.catalogBreadcrumb')
        }
        title={message('hex.map.createTitle')}
        closeLabel={message('ui.dialog.schliessen')}
        onSubmit={() => {
          if (!inputBlocked()) void saveDraft()
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
                disabled={busy || blocked || persisted || !displayName.trim()}
              >
                {props.invocation.kind === 'location-link'
                  ? message('action.createAndLink')
                  : message('action.create')}
              </button>
              {reconciliationFailed && (
                <button
                  type="button"
                  className="hex-map-primary"
                  disabled={busy || blocked}
                  onClick={() => {
                    if (!inputBlocked()) void saveDraft()
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
              disabled={busy || blocked || persisted}
              value={displayName}
              onChange={(event) => {
                if (
                  inputBlocked() ||
                  submission.current.persistedValue !== null
                )
                  return
                const action = {
                  kind: 'name' as const,
                  value: event.target.value
                }
                draftRef.current = hexMapNameDraftReducer(
                  draftRef.current,
                  action
                )
                settled.current = false
                dispatch(action)
              }}
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
          onCancel={() => {
            if (!inputBlocked()) setDiscardOpen(false)
          }}
          onDiscard={() => {
            if (!inputBlocked()) void discardDraft()
          }}
        />
      )}
    </>
  )
}
