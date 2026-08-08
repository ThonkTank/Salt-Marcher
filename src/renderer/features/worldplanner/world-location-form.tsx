import type { ReactNode } from 'react'
import { message } from '../../i18n/worldplanner-runtime.de.js'
import type {
  WorldLocationEditorReferences,
  WorldLocationEditorResource
} from './world-location-editor-types.js'
import { LocationReferencePicker } from './location-reference-picker.js'
import { LocationTagPicker } from './location-tag-picker.js'
import type { WorldLocationFormDraft } from './world-location-draft.js'

export function WorldLocationForm(props: {
  draft: WorldLocationFormDraft
  change: <Key extends keyof WorldLocationFormDraft>(
    key: Key,
    value: WorldLocationFormDraft[Key]
  ) => void
  tagInput: string
  setTagInput: (value: string) => void
  factionQuery: string
  setFactionQuery: (value: string) => void
  tableQuery: string
  setTableQuery: (value: string) => void
  references: WorldLocationEditorReferences
  suggestTags: (query: string, limit?: number) => Promise<readonly string[]>
  disabled: boolean
  aside?: ReactNode
  createFaction?: () => void
  createTable?: () => void
  createdFactions?: readonly { id: string; displayName: string }[]
  createdTables?: readonly { id: string; displayName: string }[]
}) {
  const { draft, change } = props
  return (
    <div className="location-dialog-body">
      <div className="location-sheet-pane">
        <label className="location-name-field">
          <span>{message('ui.name')}</span>
          <input
            aria-label={message('ui.ortsname')}
            required
            maxLength={100}
            placeholder={message('ui.ortsname')}
            disabled={props.disabled}
            value={draft.displayName}
            onChange={(event) => change('displayName', event.target.value)}
          />
        </label>
        <LocationTagPicker
          suggestTags={props.suggestTags}
          tags={draft.tags}
          query={props.tagInput}
          setQuery={props.setTagInput}
          changed={(tags) => change('tags', tags)}
          disabled={props.disabled}
        />
        <label className="location-section location-read-aloud">
          <span>{message('ui.vorlesetext')}</span>
          <textarea
            aria-label={message('ui.vorlesetext')}
            maxLength={20_000}
            rows={4}
            disabled={props.disabled}
            placeholder={message('ui.vorlesetext.platzhalter')}
            value={draft.readAloud}
            onChange={(event) => change('readAloud', event.target.value)}
          />
        </label>
        <label className="location-section location-notes">
          <span>{message('ui.gm.notizen')}</span>
          <textarea
            aria-label={message('ui.gm.notizen')}
            maxLength={20_000}
            rows={6}
            disabled={props.disabled}
            value={draft.notes}
            onChange={(event) => change('notes', event.target.value)}
          />
        </label>
      </div>
      <div className="location-dialog-divider" aria-hidden="true" />
      <div className="location-link-pane">
        {props.aside}
        <LocationReferencePicker
          label={message('catalog.linkedFactions')}
          placeholder={message('ui.fraktion.suchen')}
          options={readyOptions(
            props.references.factions,
            props.createdFactions ?? []
          )}
          selected={draft.factionIds}
          query={props.factionQuery}
          setQuery={props.setFactionQuery}
          disabled={props.disabled}
          inputDisabled={props.references.factions.status !== 'ready'}
          changed={(ids) => change('factionIds', ids)}
          {...(props.createFaction
            ? {
                createAction: {
                  label: message('ui.neue.fraktion'),
                  run: props.createFaction
                }
              }
            : {})}
        />
        <ReferenceResourceStatus resource={props.references.factions} />
        <LocationReferencePicker
          label={message('catalog.directEncounterTables')}
          placeholder={message('ui.encounter.tabelle.suchen')}
          options={readyOptions(
            props.references.tables,
            props.createdTables ?? []
          )}
          selected={draft.encounterTableIds}
          query={props.tableQuery}
          setQuery={props.setTableQuery}
          disabled={props.disabled}
          inputDisabled={props.references.tables.status !== 'ready'}
          changed={(ids) => change('encounterTableIds', ids)}
          hint={message('catalog.locationTableHint')}
          {...(props.createTable
            ? {
                createAction: {
                  label: message('ui.neue.tabelle'),
                  run: props.createTable
                }
              }
            : {})}
        />
        <ReferenceResourceStatus resource={props.references.tables} />
      </div>
    </div>
  )
}

function readyOptions(
  resource: WorldLocationEditorResource<
    readonly { id: string; displayName: string }[]
  >,
  additions: readonly { id: string; displayName: string }[] = []
) {
  const entries = resource.status === 'ready' ? resource.value : []
  return [...entries, ...additions]
    .filter(
      (entry, index, all) =>
        all.findIndex((candidate) => candidate.id === entry.id) === index
    )
    .map((entry) => ({ id: entry.id, label: entry.displayName }))
}

function ReferenceResourceStatus(props: {
  resource: WorldLocationEditorResource<unknown>
}) {
  if (props.resource.status === 'ready') return null
  if (props.resource.status === 'loading')
    return <p role="status">{message('ui.referenzen.werden.geladen')}</p>
  return (
    <div className="world-location-reference-error" role="alert">
      <p>{props.resource.message}</p>
      <button type="button" onClick={props.resource.retry}>
        {message('action.retry')}
      </button>
    </div>
  )
}
