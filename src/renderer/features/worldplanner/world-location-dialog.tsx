import { useState, type ReactNode } from 'react'
import type {
  WorldLocation,
  WorldLocationDraft
} from '../../../shared/contracts/world-location.js'
import type {
  EncounterTable,
  WorldFaction
} from '../../../shared/contracts/encounter-source.js'
import { message } from '../../i18n/worldplanner-runtime.de.js'
import { EditorDialogFrame } from '../../shell/editor-dialog-frame.js'
import {
  DiscardChangesDialog,
  ModalCloseButton
} from '../../shell/modal-dialog.js'
import type {
  WorldLocationEditorReferences,
  WorldLocationRelatedCreation
} from './world-location-editor-types.js'
import { useWorldLocationDraft } from './use-world-location-draft.js'
import { WorldLocationForm } from './world-location-form.js'
import './world-location-dialog.css'

export type WorldLocationDialogSubmitResult =
  | Readonly<{ status: 'saved' }>
  | Readonly<{
      status: 'partially-saved'
      message: string
      retry: () => Promise<WorldLocationDialogRetryResult>
    }>
  | Readonly<{ status: 'failed'; message: string }>

export type WorldLocationDialogRetryResult =
  | Readonly<{ status: 'saved' }>
  | Readonly<{ status: 'failed'; message: string }>

export type WorldLocationDialogAsideProps = Readonly<{
  locationId: string | null
  locationName: string
  disabled: boolean
}>

export type WorldLocationDialogProps = Readonly<{
  location: WorldLocation | null
  references: WorldLocationEditorReferences
  suggestTags: (query: string, limit?: number) => Promise<readonly string[]>
  close: () => void
  save: (draft: WorldLocationDraft) => Promise<WorldLocationDialogSubmitResult>
  aside?: (props: WorldLocationDialogAsideProps) => ReactNode
  externalDirty?: boolean
  relatedCreation?: WorldLocationRelatedCreation
}>

export function WorldLocationDialog(props: WorldLocationDialogProps) {
  return (
    <WorldLocationDialogContent
      key={props.location?.id ?? 'create'}
      {...props}
    />
  )
}

function WorldLocationDialogContent(props: WorldLocationDialogProps) {
  const form = useWorldLocationDraft(props.location, props.externalDirty)
  const [factionQuery, setFactionQuery] = useState('')
  const [tableQuery, setTableQuery] = useState('')
  const [discardOpen, setDiscardOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [partialRecovery, setPartialRecovery] = useState<Extract<
    WorldLocationDialogSubmitResult,
    { status: 'partially-saved' }
  > | null>(null)
  const [createdFactions, setCreatedFactions] = useState<WorldFaction[]>([])
  const [createdTables, setCreatedTables] = useState<EncounterTable[]>([])
  const { nameMissing, tagsMissing, draft: validDraft } = form.validation
  const requestClose = () => {
    if (submitting) return
    if (form.dirty) setDiscardOpen(true)
    else props.close()
  }
  const status = nameMissing
    ? tagsMissing
      ? message('catalog.locationMissingBoth')
      : message('catalog.locationMissingName')
    : tagsMissing
      ? message('catalog.locationMissingTag')
      : props.location
        ? message('catalog.locationReadySave')
        : message('catalog.locationReady')

  return (
    <>
      <EditorDialogFrame
        busy={submitting}
        className="location-dialog"
        ariaLabel={
          props.location
            ? message('catalog.editLocation')
            : message('catalog.createLocation')
        }
        breadcrumb={`${message('ui.world.planner')} › ${message('ui.orte')}`}
        title={
          props.location
            ? message('catalog.editLocation')
            : message('catalog.createLocation')
        }
        closeLabel={message('ui.dialog.schliessen')}
        onClose={requestClose}
        onSubmit={() => {
          if (submitting || partialRecovery || !validDraft) return
          setSubmitting(true)
          setSubmitError(null)
          void props
            .save(validDraft)
            .then((result) => {
              if (result.status === 'failed') setSubmitError(result.message)
              if (result.status === 'partially-saved') {
                setSubmitError(result.message)
                setPartialRecovery(result)
              }
            })
            .finally(() => setSubmitting(false))
        }}
        footer={
          <>
            <div>
              <span>{status}</span>
              {submitError && <strong role="alert">{submitError}</strong>}
            </div>
            <div className="row-actions">
              <ModalCloseButton>{message('action.cancel')}</ModalCloseButton>
              <button
                className="location-primary-action"
                disabled={submitting || partialRecovery !== null || !validDraft}
              >
                {props.location
                  ? message('action.save')
                  : message('action.create')}
              </button>
              {partialRecovery && (
                <button
                  type="button"
                  className="location-primary-action"
                  disabled={submitting}
                  onClick={() => {
                    setSubmitting(true)
                    setSubmitError(null)
                    void partialRecovery
                      .retry()
                      .then((result) => {
                        if (result.status === 'saved') props.close()
                        else setSubmitError(result.message)
                      })
                      .finally(() => setSubmitting(false))
                  }}
                >
                  {message('action.retry')}
                </button>
              )}
            </div>
          </>
        }
        footerClassName="location-dialog-footer"
      >
        <WorldLocationForm
          draft={form.draft}
          change={form.change}
          tagInput={form.tagInput}
          setTagInput={form.setTagInput}
          factionQuery={factionQuery}
          setFactionQuery={setFactionQuery}
          tableQuery={tableQuery}
          setTableQuery={setTableQuery}
          references={props.references}
          createdFactions={createdFactions}
          createdTables={createdTables}
          suggestTags={props.suggestTags}
          disabled={submitting}
          aside={props.aside?.({
            locationId: props.location?.id ?? null,
            locationName: form.draft.displayName.trim() || message('ui.ort'),
            disabled: submitting
          })}
          {...(props.relatedCreation
            ? {
                createFaction: () =>
                  props.relatedCreation!.requestFactionCreation((faction) => {
                    setCreatedFactions((current) =>
                      current.some((entry) => entry.id === faction.id)
                        ? current
                        : [...current, faction]
                    )
                    form.change(
                      'factionIds',
                      form.draft.factionIds.includes(faction.id)
                        ? form.draft.factionIds
                        : [...form.draft.factionIds, faction.id]
                    )
                  }),
                createTable: () =>
                  props.relatedCreation!.requestTableCreation((table) => {
                    setCreatedTables((current) =>
                      current.some((entry) => entry.id === table.id)
                        ? current
                        : [...current, table]
                    )
                    form.change(
                      'encounterTableIds',
                      form.draft.encounterTableIds.includes(table.id)
                        ? form.draft.encounterTableIds
                        : [...form.draft.encounterTableIds, table.id]
                    )
                  })
              }
            : {})}
        />
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
