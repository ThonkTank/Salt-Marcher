import { useReducer, useState } from 'react'
import type {
  WorldLocation,
  WorldLocationDraft
} from '../../../shared/contracts/world-location.js'
import { message } from '../../i18n/messages.de.js'
import {
  DiscardChangesDialog,
  ModalCloseButton,
  ModalDialog,
  ModalForm
} from '../../shell/modal-dialog.js'
import { ReferenceMultiSelect } from '../../shell/reference-multi-select.js'
import type {
  WorldLocationEditorReferences,
  WorldLocationSubmitResult
} from './world-location-editor-types.js'
import './world-location-dialog.css'

type Draft = {
  displayName: string
  kind: string
  region: string
  notes: string
  factionIds: string[]
  encounterTableIds: string[]
}
type DraftAction =
  | Readonly<{ type: 'reset'; draft: Draft }>
  | Readonly<{ type: 'change'; key: keyof Draft; value: Draft[keyof Draft] }>

function draftFrom(location: WorldLocation | null): Draft {
  return {
    displayName: location?.displayName ?? '',
    kind: location?.kind ?? '',
    region: location?.region ?? '',
    notes: location?.notes ?? '',
    factionIds: [...(location?.factionIds ?? [])],
    encounterTableIds: [...(location?.encounterTableIds ?? [])]
  }
}

function reducer(draft: Draft, action: DraftAction): Draft {
  return action.type === 'reset'
    ? action.draft
    : { ...draft, [action.key]: action.value }
}

function canonical(draft: Draft): string {
  return JSON.stringify({
    ...draft,
    factionIds: [...draft.factionIds].sort(),
    encounterTableIds: [...draft.encounterTableIds].sort()
  })
}

type WorldLocationDialogProps = {
  location: WorldLocation | null
  references: WorldLocationEditorReferences
  close: () => void
  save: (draft: WorldLocationDraft) => Promise<WorldLocationSubmitResult>
}

export function WorldLocationDialog(props: WorldLocationDialogProps) {
  return (
    <WorldLocationDialogContent
      key={props.location?.id ?? 'create'}
      {...props}
    />
  )
}

function WorldLocationDialogContent(props: WorldLocationDialogProps) {
  const [draft, dispatch] = useReducer(reducer, props.location, draftFrom)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const dirty = canonical(draft) !== canonical(draftFrom(props.location))
  const referencesReady = props.references.status === 'ready'

  const change = <Key extends keyof Draft>(key: Key, value: Draft[Key]) =>
    dispatch({ type: 'change', key, value })
  const requestClose = () => {
    if (submitting) return
    if (dirty) setDiscardOpen(true)
    else props.close()
  }

  return (
    <>
      <ModalDialog
        busy={submitting}
        className="world-location-editor"
        ariaLabel={
          props.location
            ? message('catalog.editLocation')
            : message('catalog.createLocation')
        }
        onClose={requestClose}
      >
        <ModalForm
          onSubmit={(event) => {
            event.preventDefault()
            if (submitting || !draft.displayName.trim() || !referencesReady)
              return
            setSubmitting(true)
            setSubmitError(null)
            void props
              .save({
                ...draft,
                factionIds: [...draft.factionIds].sort(),
                encounterTableIds: [...draft.encounterTableIds].sort()
              })
              .then((result) => {
                if (result.status === 'failed') setSubmitError(result.message)
              })
              .finally(() => setSubmitting(false))
          }}
        >
          <header>
            <div>
              <p className="section-kicker">{message('ui.world.planner')}</p>
              <h2>
                {props.location
                  ? message('catalog.editLocation')
                  : message('catalog.createLocation')}
              </h2>
            </div>
            <ModalCloseButton aria-label={message('ui.dialog.schliessen')}>
              ×
            </ModalCloseButton>
          </header>
          <label>
            {message('ui.name')}
            <input
              aria-label={message('ui.ortsname')}
              required
              maxLength={100}
              disabled={submitting}
              value={draft.displayName}
              onChange={(event) => change('displayName', event.target.value)}
            />
          </label>
          <label>
            {message('ui.typ')}
            <input
              aria-label={message('ui.ortstyp')}
              maxLength={100}
              disabled={submitting}
              value={draft.kind}
              onChange={(event) => change('kind', event.target.value)}
            />
          </label>
          <label>
            {message('ui.region')}
            <input
              aria-label={message('ui.ortsregion')}
              maxLength={100}
              disabled={submitting}
              value={draft.region}
              onChange={(event) => change('region', event.target.value)}
            />
          </label>
          {props.references.status === 'loading' ? (
            <p role="status">{message('ui.referenzen.werden.geladen')}</p>
          ) : props.references.status === 'failed' ? (
            <div className="world-location-reference-error" role="alert">
              <p>{props.references.message}</p>
              <button type="button" onClick={props.references.retry}>
                {message('action.retry')}
              </button>
            </div>
          ) : (
            <>
              <ReferenceMultiSelect
                label={message('catalog.linkedFactions')}
                options={props.references.factions.map((faction) => ({
                  id: faction.id,
                  label: faction.displayName
                }))}
                selected={draft.factionIds}
                disabled={submitting}
                changed={(ids) => change('factionIds', ids)}
              />
              <ReferenceMultiSelect
                label={message('catalog.directEncounterTables')}
                options={props.references.tables.map((table) => ({
                  id: table.id,
                  label: table.displayName
                }))}
                selected={draft.encounterTableIds}
                disabled={submitting}
                changed={(ids) => change('encounterTableIds', ids)}
              />
            </>
          )}
          <label>
            {message('ui.notizen')}
            <textarea
              aria-label={message('ui.ortsnotizen')}
              maxLength={20_000}
              rows={10}
              disabled={submitting}
              value={draft.notes}
              onChange={(event) => change('notes', event.target.value)}
            />
          </label>
          {submitError && <p role="alert">{submitError}</p>}
          <footer>
            <ModalCloseButton>{message('action.cancel')}</ModalCloseButton>
            <button
              disabled={
                submitting || !referencesReady || !draft.displayName.trim()
              }
            >
              {props.location
                ? message('action.save')
                : message('action.create')}
            </button>
          </footer>
        </ModalForm>
      </ModalDialog>
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
