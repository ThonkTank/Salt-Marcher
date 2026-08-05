import { useState } from 'react'
import type {
  WorldLocation,
  WorldLocationDraft
} from '../../../shared/contracts/world-location.js'
import type {
  EncounterTable,
  WorldFaction
} from '../../../shared/contracts/encounter-source.js'
import { formatMessage, message } from '../../i18n/messages.de.js'
import { IlluminatedHeading } from '../../shell/illuminated-heading.js'
import {
  DiscardChangesDialog,
  ModalCloseButton,
  ModalDialog
} from '../../shell/modal-dialog.js'
import { ReferenceMultiSelect } from '../creatures/creature-controls.js'
import { HexLocationPlacementDialog } from '../hex/hex-workspaces.js'

export function LocationCatalogSection(props: {
  visible: readonly WorldLocation[]
  total: number
  loading: boolean
  searchInput: string
  direction: 'asc' | 'desc'
  selected: WorldLocation | null
  editing: WorldLocation | null | undefined
  placing: WorldLocation | null
  tables: readonly EncounterTable[]
  factions: readonly WorldFaction[]
  deleteConfirm: boolean
  setSearchInput: (value: string) => void
  commitSearch: () => void
  toggleDirection: () => void
  select: (location: WorldLocation | null) => void
  edit: (location: WorldLocation | null | undefined) => void
  place: (location: WorldLocation | null) => void
  setDeleteConfirm: (value: boolean) => void
  save: (draft: WorldLocationDraft) => void
  remove: () => void
  placed: () => void
  onError: (message: string) => void
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
                  <button
                    className="link-button"
                    onClick={() => {
                      props.select(location)
                      props.setDeleteConfirm(false)
                    }}
                  >
                    {location.displayName}
                  </button>
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
      {props.editing !== undefined && (
        <LocationDialog
          location={props.editing}
          factions={props.factions}
          tables={props.tables}
          close={() => props.edit(undefined)}
          save={props.save}
        />
      )}
      {props.placing && (
        <HexLocationPlacementDialog
          location={props.placing}
          close={() => props.place(null)}
          onPlaced={props.placed}
          onError={props.onError}
        />
      )}
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

function LocationDialog(props: {
  location: WorldLocation | null
  factions: readonly WorldFaction[]
  tables: readonly EncounterTable[]
  close: () => void
  save: (draft: WorldLocationDraft) => void
}) {
  const [displayName, setDisplayName] = useState(
    props.location?.displayName ?? ''
  )
  const [notes, setNotes] = useState(props.location?.notes ?? '')
  const [factionIds, setFactionIds] = useState<string[]>([
    ...(props.location?.factionIds ?? [])
  ])
  const [encounterTableIds, setEncounterTableIds] = useState<string[]>([
    ...(props.location?.encounterTableIds ?? [])
  ])
  const [discardOpen, setDiscardOpen] = useState(false)
  const dirty =
    JSON.stringify({ displayName, notes, factionIds, encounterTableIds }) !==
    JSON.stringify({
      displayName: props.location?.displayName ?? '',
      notes: props.location?.notes ?? '',
      factionIds: props.location?.factionIds ?? [],
      encounterTableIds: props.location?.encounterTableIds ?? []
    })
  const requestClose = () => {
    if (dirty) setDiscardOpen(true)
    else props.close()
  }
  return (
    <>
      <ModalDialog
        form
        className="catalog-location-editor"
        ariaLabel={
          props.location
            ? message('catalog.editLocation')
            : message('catalog.createLocation')
        }
        onClose={requestClose}
        onSubmit={(event) => {
          event.preventDefault()
          props.save({ displayName, notes, factionIds, encounterTableIds })
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
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <ReferenceMultiSelect
          label={message('catalog.linkedFactions')}
          options={props.factions.map((faction) => ({
            id: faction.id,
            label: faction.displayName
          }))}
          selected={factionIds}
          changed={setFactionIds}
        />
        <ReferenceMultiSelect
          label={message('catalog.directEncounterTables')}
          options={props.tables.map((table) => ({
            id: table.id,
            label: table.displayName
          }))}
          selected={encounterTableIds}
          changed={setEncounterTableIds}
        />
        <label>
          {message('ui.notizen')}
          <textarea
            aria-label={message('ui.ortsnotizen')}
            maxLength={20_000}
            rows={10}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <footer>
          <ModalCloseButton>{message('action.cancel')}</ModalCloseButton>
          <button disabled={!displayName.trim()}>
            {props.location ? message('action.save') : message('action.create')}
          </button>
        </footer>
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
