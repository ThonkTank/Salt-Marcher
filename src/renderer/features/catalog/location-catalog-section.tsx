import type {
  WorldLocation,
  WorldLocationDraft
} from '../../../shared/contracts/world-location.js'
import { formatMessage, message } from '../../i18n/catalog-runtime.de.js'
import { IlluminatedHeading } from '../../shell/illuminated-heading.js'
import { TextActionButton } from '../../shell/text-action-button.js'
import type {
  WorldLocationEditingIntegration,
  WorldLocationEditorReferences,
  WorldLocationPlacementIntent,
  WorldLocationSubmitResult
} from '../worldplanner/world-location-editor-types.js'
import type { LocationPlacementRecovery } from './location-catalog-controller.js'

export function LocationCatalogSection(props: {
  visible: readonly WorldLocation[]
  total: number
  loading: boolean
  searchInput: string
  direction: 'asc' | 'desc'
  selected: WorldLocation | null
  editing: WorldLocation | null | undefined
  placing: WorldLocation | null
  references: WorldLocationEditorReferences
  deleteConfirm: boolean
  setSearchInput: (value: string) => void
  commitSearch: () => void
  toggleDirection: () => void
  select: (location: WorldLocation | null) => void
  edit: (location: WorldLocation | null | undefined) => void
  place: (location: WorldLocation | null) => void
  setDeleteConfirm: (value: boolean) => void
  save: (
    draft: WorldLocationDraft,
    placement: WorldLocationPlacementIntent
  ) => Promise<WorldLocationSubmitResult>
  remove: () => void
  placed: () => void
  onError: (message: string) => void
  worldLocationEditing: WorldLocationEditingIntegration
  placementRecovery: LocationPlacementRecovery | null
  retryPlacement: () => void
}) {
  return (
    <>
      <form
        className="catalog-filters"
        onSubmit={(event) => {
          event.preventDefault()
          props.commitSearch()
        }}
      >
        <input
          aria-label={message('ui.orte.suchen')}
          placeholder={message('ui.orte.suchen.2')}
          value={props.searchInput}
          onChange={(event) => props.setSearchInput(event.target.value)}
        />
        <button type="button" onClick={() => props.edit(null)}>
          {message('ui.erstellen')}
        </button>
      </form>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <th>
                <button
                  className="catalog-sort-header"
                  onClick={props.toggleDirection}
                >
                  {message('ui.name')} {props.direction === 'asc' ? '↑' : '↓'}
                </button>
              </th>
              <th>{message('ui.notizen')}</th>
            </tr>
          </thead>
          <tbody>
            {props.visible.map((location) => (
              <tr key={location.id} className="catalog-row">
                <td>
                  <TextActionButton
                    onClick={() => {
                      props.select(location)
                      props.setDeleteConfirm(false)
                    }}
                  >
                    {location.displayName}
                  </TextActionButton>
                </td>
                <td>{location.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="catalog-footer">
        <span>
          {props.loading
            ? message('catalog.locationsUpdating')
            : props.visible.length === 0
              ? message('catalog.noLocations')
              : formatMessage('catalog.locationCount', {
                  visible: props.visible.length,
                  total: props.total
                })}
        </span>
      </footer>
      {props.placementRecovery && (
        <div className="catalog-placement-recovery" role="alert">
          <span>
            {props.worldLocationEditing.placementFailureText(
              props.placementRecovery.failure
            )}
          </span>
          <button type="button" onClick={props.retryPlacement}>
            {message('action.retry')}
          </button>
        </div>
      )}
      {props.selected && (
        <LocationInspector
          location={props.selected}
          close={() => {
            props.select(null)
            props.setDeleteConfirm(false)
          }}
          edit={() => {
            props.edit(props.selected)
            props.select(null)
          }}
          place={() => props.place(props.selected)}
          deleteConfirm={props.deleteConfirm}
          setDeleteConfirm={props.setDeleteConfirm}
          remove={props.remove}
        />
      )}
      {props.editing !== undefined &&
        props.worldLocationEditing.renderEditor({
          location: props.editing,
          references: props.references,
          close: () => props.edit(undefined),
          onError: props.onError,
          save: props.save
        })}
      {props.placing &&
        props.worldLocationEditing.renderPlacementDialog({
          location: props.placing,
          close: () => props.place(null),
          onPlaced: props.placed,
          onError: props.onError
        })}
    </>
  )
}

function LocationInspector(props: {
  location: WorldLocation
  close: () => void
  edit: () => void
  place: () => void
  deleteConfirm: boolean
  setDeleteConfirm: (value: boolean) => void
  remove: () => void
}) {
  return (
    <aside
      className="catalog-location-inspector"
      aria-label={message('ui.ort.details')}
    >
      <header>
        <div>
          <p className="section-kicker">{message('ui.ort')}</p>
          <IlluminatedHeading title={props.location.displayName} />
        </div>
        <button
          aria-label={message('ui.ort.details.schliessen')}
          onClick={props.close}
        >
          ×
        </button>
      </header>
      <p className="catalog-location-notes">
        {props.location.notes || message('catalog.noLocationDescription')}
      </p>
      <p>
        {props.location.factionIds.length} {message('ui.fraktionen.2')}{' '}
        {props.location.encounterTableIds.length}{' '}
        {message('ui.direkte.encounter.tabellen')}
      </p>
      <footer className="row-actions">
        <button onClick={props.place}>
          {message('ui.platzieren.verschieben')}
        </button>
        <button onClick={props.edit}>{message('ui.bearbeiten')}</button>
        {!props.deleteConfirm ? (
          <button
            className="danger"
            onClick={() => props.setDeleteConfirm(true)}
          >
            {message('ui.loeschen')}
          </button>
        ) : (
          <>
            <span>{message('ui.ort.wirklich.loeschen')}</span>
            <button onClick={() => props.setDeleteConfirm(false)}>
              {message('action.cancel')}
            </button>
            <button className="danger" onClick={props.remove}>
              {message('ui.wirklich.loeschen')}
            </button>
          </>
        )}
      </footer>
    </aside>
  )
}
