import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery
} from '../../../shared/contracts/encounter.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type {
  WorldLocation,
  WorldLocationDraft,
  WorldLocationSnapshot
} from '../../../shared/contracts/world-location.js'
import type {
  EncounterTable,
  EncounterTableDraft,
  EncounterTableSnapshot,
  WorldFaction,
  WorldFactionDraft,
  WorldFactionSnapshot
} from '../../../shared/contracts/encounter-source.js'
import { HexLocationPlacementDialog } from '../hex/hex-workspaces.js'
import { IlluminatedHeading } from '../../shell/illuminated-heading.js'
import {
  CreatureCollectionCatalogPane,
  CreatureCollectionSelection
} from '../session/session-workspace.js'
import {
  CreatureFilters,
  FilterChips,
  ReferenceMultiSelect,
  SortHeader
} from './catalog-controls.js'
import {
  emptyCreatureOptions,
  emptyQuery,
  errorText,
  showError,
  useCreatureSearch
} from './catalog-state.js'

type CatalogWorkspaceProps = {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  close: () => void
  onError: (message: string) => void
  inspect: (creature: Creature) => void
}

export default function CatalogWorkspace(props: CatalogWorkspaceProps) {
  const [section, setSection] = useState<
    'monsters' | 'locations' | 'factions' | 'encounterTables'
  >('monsters')
  const [query, setQuery] = useState<CreatureCatalogQuery>(emptyQuery)
  const [page, setPage] = useState<CreatureCatalogPage | null>(null)
  const [options, setOptions] = useState(emptyCreatureOptions)
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState<WorldLocationSnapshot>({
    revision: 0,
    locations: []
  })
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationSearchInput, setLocationSearchInput] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [locationDirection, setLocationDirection] = useState<'asc' | 'desc'>(
    'asc'
  )
  const [selectedLocation, setSelectedLocation] =
    useState<WorldLocation | null>(null)
  const [editingLocation, setEditingLocation] = useState<
    WorldLocation | null | undefined
  >(undefined)
  const [deleteLocationConfirm, setDeleteLocationConfirm] = useState(false)
  const [placingLocation, setPlacingLocation] = useState<WorldLocation | null>(
    null
  )
  const [locationTables, setLocationTables] = useState<EncounterTable[]>([])
  const [locationFactions, setLocationFactions] = useState<WorldFaction[]>([])
  const request = useRef(0)
  const onError = props.onError
  useEffect(() => {
    if (section !== 'monsters') return
    void window.saltMarcher.creatures
      .filterOptions()
      .then(setOptions)
      .catch(showError(onError))
  }, [onError, section])
  useEffect(() => {
    if (section !== 'monsters') return
    const token = ++request.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const result = await window.saltMarcher.creatures.search(query)
        if (request.current !== token) return
        setPage(result)
      } catch (cause) {
        if (request.current === token) onError(errorText(cause))
      } finally {
        if (request.current === token) setLoading(false)
      }
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query, onError, section])
  useEffect(() => {
    if (section !== 'locations') return
    void Promise.resolve().then(async () => {
      setLocationLoading(true)
      try {
        const [next, tableSnapshot, factionSnapshot] = await Promise.all([
          window.saltMarcher.locations.read(),
          window.saltMarcher.encounterTables.read(),
          window.saltMarcher.factions.read()
        ])
        setLocations(next)
        setLocationTables([...tableSnapshot.tables])
        setLocationFactions([...factionSnapshot.factions])
        setSelectedLocation((current) =>
          current
            ? (next.locations.find((location) => location.id === current.id) ??
              null)
            : null
        )
      } catch (cause) {
        onError(errorText(cause))
      } finally {
        setLocationLoading(false)
      }
    })
  }, [onError, section])
  useEffect(() => {
    if (section !== 'locations') return
    const timer = window.setTimeout(
      () => setLocationSearch(locationSearchInput),
      200
    )
    return () => window.clearTimeout(timer)
  }, [locationSearchInput, section])
  const open = async (creature: Creature) => {
    try {
      props.inspect(await window.saltMarcher.creatures.detail(creature.id))
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  const visibleLocations = useMemo(() => {
    const needle = locationSearch.trim().toLocaleLowerCase()
    return locations.locations
      .filter(
        (location) =>
          !needle ||
          location.displayName.toLocaleLowerCase().includes(needle) ||
          location.notes.toLocaleLowerCase().includes(needle)
      )
      .toSorted((a, b) => {
        const order = a.displayName.localeCompare(b.displayName)
        return locationDirection === 'asc' ? order : -order
      })
  }, [locationDirection, locationSearch, locations.locations])

  const saveLocation = async (draft: WorldLocationDraft) => {
    try {
      const previousIds = new Set(
        locations.locations.map((location) => location.id)
      )
      const next = editingLocation
        ? await window.saltMarcher.locations.update(
            editingLocation.id,
            draft,
            locations.revision
          )
        : await window.saltMarcher.locations.create(draft, locations.revision)
      const selectedId =
        editingLocation?.id ??
        next.locations.find((location) => !previousIds.has(location.id))?.id
      setLocations(next)
      setSelectedLocation(
        next.locations.find((location) => location.id === selectedId) ?? null
      )
      setEditingLocation(undefined)
      props.setSnapshot(await window.saltMarcher.session.read())
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  const deleteLocation = async () => {
    if (!selectedLocation) return
    try {
      const next = await window.saltMarcher.locations.delete(
        selectedLocation.id,
        locations.revision
      )
      setLocations(next)
      setSelectedLocation(null)
      setDeleteLocationConfirm(false)
      props.setSnapshot(await window.saltMarcher.session.read())
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  return (
    <section className="catalog-workspace">
      <div
        className={`catalog-browser${section !== 'monsters' ? ' locations-catalog-browser' : ''}`}
      >
        <header className="catalog-section-selector">
          <button
            aria-pressed={section === 'monsters'}
            onClick={() => setSection('monsters')}
          >
            Monster
          </button>
          <button
            aria-pressed={section === 'locations'}
            onClick={() => setSection('locations')}
          >
            Orte
          </button>
          <button
            aria-pressed={section === 'factions'}
            onClick={() => setSection('factions')}
          >
            Fraktionen
          </button>
          <button
            aria-pressed={section === 'encounterTables'}
            onClick={() => setSection('encounterTables')}
          >
            Encounter-Tabellen
          </button>
        </header>
        {section === 'monsters' ? (
          <>
            <CreatureFilters
              query={query}
              options={options}
              changed={setQuery}
            />
            <div className="filter-chips">
              <FilterChips query={query} changed={setQuery} />
            </div>
            <div className="catalog-table-wrap">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <SortHeader
                      label="Name"
                      field="name"
                      query={query}
                      changed={setQuery}
                    />
                    <SortHeader
                      label="CR"
                      field="cr"
                      query={query}
                      changed={setQuery}
                    />
                    <th>Typ</th>
                    <th>Größe</th>
                    <SortHeader
                      label="XP"
                      field="xp"
                      query={query}
                      changed={setQuery}
                    />
                  </tr>
                </thead>
                <tbody>
                  {page?.rows.map((creature) => (
                    <tr key={creature.id} className="catalog-row">
                      <td>
                        <button
                          className="link-button"
                          onClick={() => void open(creature)}
                        >
                          {creature.name}
                        </button>
                      </td>
                      <td>{creature.challengeRating}</td>
                      <td>
                        {creature.type}
                        {creature.subtype ? ` (${creature.subtype})` : ''}
                      </td>
                      <td>{creature.size}</td>
                      <td>{creature.xp.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="catalog-footer">
              <span>
                {loading
                  ? 'Monster werden aktualisiert …'
                  : page?.message || `${page?.total ?? 0} Monster`}
              </span>
              <div>
                <button
                  disabled={!page || query.offset === 0}
                  onClick={() =>
                    setQuery({
                      ...query,
                      offset: Math.max(0, query.offset - query.limit)
                    })
                  }
                >
                  Zurück
                </button>
                <span>{Math.floor(query.offset / query.limit) + 1}</span>
                <button
                  disabled={!page || query.offset + query.limit >= page.total}
                  onClick={() =>
                    setQuery({ ...query, offset: query.offset + query.limit })
                  }
                >
                  Weiter
                </button>
              </div>
            </footer>
          </>
        ) : section === 'locations' ? (
          <>
            <form
              className="catalog-filters"
              onSubmit={(event) => {
                event.preventDefault()
                setLocationSearch(locationSearchInput)
              }}
            >
              <input
                aria-label="Orte suchen"
                placeholder="Orte suchen …"
                value={locationSearchInput}
                onChange={(event) => setLocationSearchInput(event.target.value)}
              />
              <button type="button" onClick={() => setEditingLocation(null)}>
                Erstellen
              </button>
            </form>
            <div className="catalog-table-wrap">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <th>
                      <button
                        className="sort-header"
                        onClick={() =>
                          setLocationDirection((current) =>
                            current === 'asc' ? 'desc' : 'asc'
                          )
                        }
                      >
                        Name {locationDirection === 'asc' ? '↑' : '↓'}
                      </button>
                    </th>
                    <th>Notizen</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLocations.map((location) => (
                    <tr key={location.id} className="catalog-row">
                      <td>
                        <button
                          className="link-button"
                          onClick={() => {
                            setSelectedLocation(location)
                            setDeleteLocationConfirm(false)
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
                {locationLoading
                  ? 'Orte werden aktualisiert …'
                  : visibleLocations.length === 0
                    ? 'Keine Orte gefunden.'
                    : `${visibleLocations.length} von ${locations.locations.length} Orten`}
              </span>
            </footer>
          </>
        ) : section === 'factions' ? (
          <FactionCatalog onError={props.onError} inspect={props.inspect} />
        ) : (
          <EncounterTableCatalog
            onError={props.onError}
            inspect={props.inspect}
          />
        )}
      </div>
      {selectedLocation && (
        <LocationInspector
          location={selectedLocation}
          close={() => {
            setSelectedLocation(null)
            setDeleteLocationConfirm(false)
          }}
          edit={() => {
            setEditingLocation(selectedLocation)
            setSelectedLocation(null)
          }}
          place={() => setPlacingLocation(selectedLocation)}
          deleteConfirm={deleteLocationConfirm}
          setDeleteConfirm={setDeleteLocationConfirm}
          remove={() => void deleteLocation()}
        />
      )}
      {editingLocation !== undefined && (
        <LocationDialog
          location={editingLocation}
          factions={locationFactions}
          tables={locationTables}
          close={() => setEditingLocation(undefined)}
          save={(draft) => void saveLocation(draft)}
        />
      )}
      {placingLocation && (
        <HexLocationPlacementDialog
          location={placingLocation}
          close={() => setPlacingLocation(null)}
          onPlaced={() =>
            void window.saltMarcher.session.read().then(props.setSnapshot)
          }
          onError={props.onError}
        />
      )}
    </section>
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
    <aside className="location-inspector" aria-label="Ort Details">
      <header>
        <div>
          <p className="section-kicker">Ort</p>
          <IlluminatedHeading title={props.location.displayName} />
        </div>
        <button aria-label="Ort Details schließen" onClick={props.close}>
          ×
        </button>
      </header>
      <p className="location-notes">
        {props.location.notes || 'Keine Beschreibung hinterlegt.'}
      </p>
      <p>
        {props.location.factionIds.length} Fraktionen ·{' '}
        {props.location.encounterTableIds.length} direkte Encounter-Tabellen
      </p>
      <footer className="row-actions">
        <button onClick={props.place}>Platzieren / verschieben</button>
        <button onClick={props.edit}>Bearbeiten</button>
        {!props.deleteConfirm ? (
          <button
            className="danger"
            onClick={() => props.setDeleteConfirm(true)}
          >
            Löschen
          </button>
        ) : (
          <>
            <span>Ort wirklich löschen?</span>
            <button onClick={() => props.setDeleteConfirm(false)}>
              Abbrechen
            </button>
            <button className="danger" onClick={props.remove}>
              Wirklich löschen
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
  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="location-editor"
        role="dialog"
        aria-modal="true"
        aria-label={props.location ? 'Ort bearbeiten' : 'Ort erstellen'}
        onSubmit={(event) => {
          event.preventDefault()
          props.save({ displayName, notes, factionIds, encounterTableIds })
        }}
      >
        <header>
          <div>
            <p className="section-kicker">World Planner</p>
            <h2>{props.location ? 'Ort bearbeiten' : 'Ort erstellen'}</h2>
          </div>
        </header>
        <label>
          Name
          <input
            aria-label="Ortsname"
            required
            maxLength={100}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <ReferenceMultiSelect
          label="Verknüpfte Fraktionen"
          options={props.factions.map((faction) => ({
            id: faction.id,
            label: faction.displayName
          }))}
          selected={factionIds}
          changed={setFactionIds}
        />
        <ReferenceMultiSelect
          label="Direkte Encounter-Tabellen"
          options={props.tables.map((table) => ({
            id: table.id,
            label: table.displayName
          }))}
          selected={encounterTableIds}
          changed={setEncounterTableIds}
        />
        <label>
          Notizen
          <textarea
            aria-label="Ortsnotizen"
            maxLength={20_000}
            rows={10}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <footer>
          <button type="button" onClick={props.close}>
            Abbrechen
          </button>
          <button disabled={!displayName.trim()}>
            {props.location ? 'Speichern' : 'Erstellen'}
          </button>
        </footer>
      </form>
    </div>
  )
}

function EncounterTableCatalog(props: {
  onError: (message: string) => void
  inspect: (creature: Creature) => void
}) {
  const [snapshot, setSnapshot] = useState<EncounterTableSnapshot>({
    revision: 0,
    tables: []
  })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EncounterTable | null | undefined>(
    undefined
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    void window.saltMarcher.encounterTables
      .read()
      .then(setSnapshot)
      .catch(showError(props.onError))
  }, [props.onError])

  const visible = snapshot.tables.filter((table) =>
    `${table.displayName} ${table.description}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )

  async function save(
    table: EncounterTable | null,
    draft: EncounterTableDraft
  ) {
    try {
      const next = table
        ? await window.saltMarcher.encounterTables.update(
            table.id,
            draft,
            snapshot.revision
          )
        : await window.saltMarcher.encounterTables.create(
            draft,
            snapshot.revision
          )
      setSnapshot(next)
      setEditing(undefined)
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  async function remove(id: string) {
    try {
      setSnapshot(
        await window.saltMarcher.encounterTables.delete(id, snapshot.revision)
      )
      setDeleteId(null)
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  return (
    <>
      <div className="catalog-filters">
        <input
          aria-label="Encounter-Tabellen suchen"
          placeholder="Encounter-Tabellen suchen …"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button onClick={() => setEditing(null)}>Erstellen</button>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Einträge</th>
              <th>Beschreibung</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((table) => (
              <tr key={table.id}>
                <td>
                  <button
                    className="link-button"
                    onClick={() => setEditing(table)}
                  >
                    {table.displayName}
                  </button>
                </td>
                <td>{table.entries.length}</td>
                <td>{table.description || '—'}</td>
                <td className="row-actions">
                  {deleteId === table.id ? (
                    <>
                      <button onClick={() => setDeleteId(null)}>
                        Abbrechen
                      </button>
                      <button
                        className="danger"
                        onClick={() => void remove(table.id)}
                      >
                        Bestätigen
                      </button>
                    </>
                  ) : (
                    <button
                      className="danger"
                      onClick={() => setDeleteId(table.id)}
                    >
                      Löschen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="catalog-footer">
        <span>{visible.length} Encounter-Tabellen</span>
      </footer>
      {editing !== undefined && (
        <EncounterTableDialog
          key={editing?.id ?? 'new'}
          table={editing}
          tables={snapshot.tables}
          close={() => setEditing(undefined)}
          select={setEditing}
          save={(table, draft) => void save(table, draft)}
          onError={props.onError}
          inspect={props.inspect}
        />
      )}
    </>
  )
}

function EncounterTableDialog(props: {
  table: EncounterTable | null
  tables: readonly EncounterTable[]
  close: () => void
  select: (table: EncounterTable | null) => void
  save: (table: EncounterTable | null, draft: EncounterTableDraft) => void
  onError: (message: string) => void
  inspect: (creature: Creature) => void
}) {
  const [displayName, setDisplayName] = useState(props.table?.displayName ?? '')
  const [description, setDescription] = useState(props.table?.description ?? '')
  const [query, setQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    limit: 30
  })
  const [page, setPage] = useState<CreatureCatalogPage | null>(null)
  const [options, setOptions] = useState(emptyCreatureOptions)
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(
      props.table?.entries.map((entry) => [entry.creatureId, entry.weight]) ??
        []
    )
  )
  const [names, setNames] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<
    { kind: 'close' } | { kind: 'select'; id: string } | null
  >(null)
  useCreatureSearch(query, setPage, props.onError)

  useEffect(() => {
    void window.saltMarcher.creatures
      .filterOptions()
      .then(setOptions)
      .catch(showError(props.onError))
  }, [props.onError])

  useEffect(() => {
    void Promise.all(
      Object.keys(weights).map((id) =>
        window.saltMarcher.creatures.detail(id).catch(() => null)
      )
    ).then((rows) =>
      setNames(
        Object.fromEntries(
          rows
            .filter((row): row is Creature => row !== null)
            .map((row) => [row.id, row.name])
        )
      )
    )
  }, [weights])

  const entries = Object.entries(weights).toSorted((left, right) =>
    (names[left[0]] ?? left[0]).localeCompare(names[right[0]] ?? right[0])
  )
  const signature = JSON.stringify({
    displayName,
    description,
    entries: Object.entries(weights).toSorted(([left], [right]) =>
      left.localeCompare(right)
    )
  })
  const initialSignature = JSON.stringify({
    displayName: props.table?.displayName ?? '',
    description: props.table?.description ?? '',
    entries: (props.table?.entries ?? [])
      .map((entry) => [entry.creatureId, entry.weight])
      .toSorted((left, right) =>
        String(left[0]).localeCompare(String(right[0]))
      )
  })
  const dirty = signature !== initialSignature

  function requestClose() {
    if (dirty) setPending({ kind: 'close' })
    else props.close()
  }

  function requestSelection(id: string | null) {
    if (!id) return
    if (dirty) setPending({ kind: 'select', id })
    else select(id)
  }

  function select(id: string) {
    props.select(
      id === 'new'
        ? null
        : (props.tables.find((table) => table.id === id) ?? null)
    )
  }

  function discardPending() {
    if (!pending) return
    const action = pending
    setPending(null)
    if (action.kind === 'close') props.close()
    else select(action.id)
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="group-dialog group-builder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="encounter-table-manager-title"
      >
        <header>
          <div>
            <p className="section-kicker">Katalog</p>
            <h2 id="encounter-table-manager-title">
              Encounter-Tabellen managen
            </h2>
          </div>
          <button
            type="button"
            aria-label="Dialog schließen"
            onClick={requestClose}
          >
            ×
          </button>
        </header>
        <div className="group-builder-layout">
          <CreatureCollectionCatalogPane
            query={query}
            options={options}
            page={page}
            changed={setQuery}
            inspect={props.inspect}
            add={(creature) => {
              setWeights((current) => ({
                ...current,
                [creature.id]: current[creature.id] ?? 1
              }))
              setNames((current) => ({
                ...current,
                [creature.id]: creature.name
              }))
            }}
          />
          <section
            className="group-draft-pane"
            aria-label="Aktuelle Encounter-Tabelle"
          >
            <CreatureCollectionSelection
              label="Encounter-Tabelle"
              value={props.table?.id ?? 'new'}
              emptyLabel="Tabelle auswählen …"
              newLabel="Neue Tabelle"
              choices={props.tables.map((table) => ({
                id: table.id,
                label: table.displayName
              }))}
              changed={requestSelection}
            />
            <label>
              Name
              <input
                required
                aria-label="Tabellenname"
                maxLength={100}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label>
              Beschreibung
              <textarea
                aria-label="Tabellenbeschreibung"
                rows={4}
                maxLength={20_000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <h3>Gewichtete Einträge</h3>
            <ul className="group-draft-roster">
              {entries.map(([id, weight]) => (
                <li key={id}>
                  <div className="roster-quantity">
                    <button
                      type="button"
                      aria-label={`Gewicht ${names[id] ?? id} verringern`}
                      disabled={weight <= 1}
                      onClick={() =>
                        setWeights({ ...weights, [id]: weight - 1 })
                      }
                    >
                      −
                    </button>
                    <strong>{weight}</strong>
                    <button
                      type="button"
                      aria-label={`Gewicht ${names[id] ?? id} erhöhen`}
                      disabled={weight >= 10}
                      onClick={() =>
                        setWeights({ ...weights, [id]: weight + 1 })
                      }
                    >
                      +
                    </button>
                  </div>
                  <span>
                    <strong>{names[id] ?? `Nicht verfügbar (${id})`}</strong>
                    <small>Gewicht {weight} von 10</small>
                  </span>
                  <button
                    type="button"
                    aria-label={`${names[id] ?? id} entfernen`}
                    onClick={() => {
                      const next = { ...weights }
                      delete next[id]
                      setWeights(next)
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {entries.length === 0 && (
              <p className="empty-state">
                Monster links mit <strong>+</strong> hinzufügen.
              </p>
            )}
            {pending && (
              <div className="confirm-row group-draft-confirm" role="alert">
                <span>Ungespeicherte Änderungen verwerfen?</span>
                <button type="button" onClick={() => setPending(null)}>
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={discardPending}
                >
                  Änderungen verwerfen
                </button>
              </div>
            )}
          </section>
        </div>
        <footer className="group-builder-footer">
          <span className="muted">
            Gewichte bestimmen die relative Auswahlwahrscheinlichkeit.
          </span>
          <div>
            <button type="button" onClick={requestClose}>
              Abbrechen
            </button>
            <button
              type="button"
              disabled={!displayName.trim()}
              onClick={() =>
                props.save(props.table, {
                  displayName,
                  description,
                  entries: Object.entries(weights).map(
                    ([creatureId, weight]) => ({ creatureId, weight })
                  )
                })
              }
            >
              {props.table ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function FactionCatalog(props: {
  onError: (message: string) => void
  inspect: (creature: Creature) => void
}) {
  const [snapshot, setSnapshot] = useState<WorldFactionSnapshot>({
    revision: 0,
    factions: []
  })
  const [tableSnapshot, setTableSnapshot] = useState<EncounterTableSnapshot>({
    revision: 0,
    tables: []
  })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<WorldFaction | null | undefined>(
    undefined
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  useEffect(() => {
    void Promise.all([
      window.saltMarcher.factions.read(),
      window.saltMarcher.encounterTables.read()
    ])
      .then(([factions, tableSnapshot]) => {
        setSnapshot(factions)
        setTableSnapshot(tableSnapshot)
      })
      .catch(showError(props.onError))
  }, [props.onError])

  const visible = snapshot.factions.filter((faction) =>
    `${faction.displayName} ${faction.notes}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )
  async function save(draft: WorldFactionDraft) {
    try {
      setSnapshot(
        editing
          ? await window.saltMarcher.factions.update(
              editing.id,
              draft,
              snapshot.revision
            )
          : await window.saltMarcher.factions.create(draft, snapshot.revision)
      )
      setEditing(undefined)
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  async function remove(id: string) {
    try {
      setSnapshot(
        await window.saltMarcher.factions.delete(id, snapshot.revision)
      )
      setDeleteId(null)
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  return (
    <>
      <div className="catalog-filters">
        <input
          aria-label="Fraktionen suchen"
          placeholder="Fraktionen suchen …"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button onClick={() => setEditing(null)}>Erstellen</button>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Gesinnung</th>
              <th>Primärtabelle</th>
              <th>Bestand</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((faction) => (
              <tr key={faction.id}>
                <td>
                  <button
                    className="link-button"
                    onClick={() => setEditing(faction)}
                  >
                    {faction.displayName}
                  </button>
                </td>
                <td>{faction.disposition}</td>
                <td>
                  {tableSnapshot.tables.find(
                    (table) => table.id === faction.primaryEncounterTableId
                  )?.displayName ?? 'Keine'}
                </td>
                <td>{faction.inventory.length} Grenzen</td>
                <td className="row-actions">
                  {deleteId === faction.id ? (
                    <>
                      <button onClick={() => setDeleteId(null)}>
                        Abbrechen
                      </button>
                      <button
                        className="danger"
                        onClick={() => void remove(faction.id)}
                      >
                        Bestätigen
                      </button>
                    </>
                  ) : (
                    <button
                      className="danger"
                      onClick={() => setDeleteId(faction.id)}
                    >
                      Löschen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="catalog-footer">
        <span>{visible.length} Fraktionen</span>
      </footer>
      {editing !== undefined && (
        <FactionDialog
          faction={editing}
          tableSnapshot={tableSnapshot}
          tablesChanged={setTableSnapshot}
          factionsChanged={setSnapshot}
          close={() => setEditing(undefined)}
          save={(draft) => void save(draft)}
          onError={props.onError}
          inspect={props.inspect}
        />
      )}
    </>
  )
}

function FactionDialog(props: {
  faction: WorldFaction | null
  tableSnapshot: EncounterTableSnapshot
  tablesChanged: (snapshot: EncounterTableSnapshot) => void
  factionsChanged: (snapshot: WorldFactionSnapshot) => void
  close: () => void
  save: (draft: WorldFactionDraft) => void
  onError: (message: string) => void
  inspect: (creature: Creature) => void
}) {
  const [displayName, setDisplayName] = useState(
    props.faction?.displayName ?? ''
  )
  const [notes, setNotes] = useState(props.faction?.notes ?? '')
  const [disposition, setDisposition] = useState(
    props.faction?.disposition ?? 0
  )
  const [primaryEncounterTableId, setPrimaryEncounterTableId] = useState<
    string | null
  >(props.faction?.primaryEncounterTableId ?? null)
  const [inventory, setInventory] = useState<Record<string, number>>(
    Object.fromEntries(
      props.faction?.inventory.map((entry) => [
        entry.creatureId,
        entry.maximum
      ]) ?? []
    )
  )
  const [names, setNames] = useState<Record<string, string>>({})
  const [tableManager, setTableManager] = useState<
    EncounterTable | null | undefined
  >(undefined)
  const selectedTable = props.tableSnapshot.tables.find(
    (table) => table.id === primaryEncounterTableId
  )
  const selectedCreatureIds = useMemo(
    () => selectedTable?.entries.map((entry) => entry.creatureId) ?? [],
    [selectedTable]
  )
  useEffect(() => {
    void Promise.all(
      selectedCreatureIds.map((id) =>
        window.saltMarcher.creatures.detail(id).catch(() => null)
      )
    ).then((rows) =>
      setNames(
        Object.fromEntries(
          rows
            .filter((row): row is Creature => row !== null)
            .map((row) => [row.id, row.name])
        )
      )
    )
  }, [selectedCreatureIds])

  function selectPrimaryTable(id: string | null) {
    const allowed = new Set(
      props.tableSnapshot.tables
        .find((table) => table.id === id)
        ?.entries.map((entry) => entry.creatureId) ?? []
    )
    setPrimaryEncounterTableId(id)
    setInventory((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([creatureId]) =>
          allowed.has(creatureId)
        )
      )
    )
  }

  async function saveTable(
    table: EncounterTable | null,
    draft: EncounterTableDraft
  ) {
    try {
      const previousIds = new Set(
        props.tableSnapshot.tables.map((candidate) => candidate.id)
      )
      const next = table
        ? await window.saltMarcher.encounterTables.update(
            table.id,
            draft,
            props.tableSnapshot.revision
          )
        : await window.saltMarcher.encounterTables.create(
            draft,
            props.tableSnapshot.revision
          )
      const selectedId =
        table?.id ??
        next.tables.find((candidate) => !previousIds.has(candidate.id))?.id ??
        null
      props.tablesChanged(next)
      props.factionsChanged(await window.saltMarcher.factions.read())
      selectPrimaryTableFromSnapshot(selectedId, next)
      setTableManager(undefined)
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  function selectPrimaryTableFromSnapshot(
    id: string | null,
    snapshot: EncounterTableSnapshot
  ) {
    const allowed = new Set(
      snapshot.tables
        .find((table) => table.id === id)
        ?.entries.map((entry) => entry.creatureId) ?? []
    )
    setPrimaryEncounterTableId(id)
    setInventory((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([creatureId]) =>
          allowed.has(creatureId)
        )
      )
    )
  }
  return (
    <>
      <div className="modal-backdrop" role="presentation">
        <form
          className="location-editor faction-editor"
          role="dialog"
          aria-modal="true"
          aria-label={
            props.faction ? 'Fraktion bearbeiten' : 'Fraktion erstellen'
          }
          onSubmit={(event) => {
            event.preventDefault()
            props.save({
              displayName,
              notes,
              disposition,
              primaryEncounterTableId,
              inventory: Object.entries(inventory).map(
                ([creatureId, maximum]) => ({ creatureId, maximum })
              )
            })
          }}
        >
          <header>
            <div>
              <p className="section-kicker">World Planner</p>
              <h2>
                {props.faction ? 'Fraktion bearbeiten' : 'Fraktion erstellen'}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Dialog schließen"
              onClick={props.close}
            >
              ×
            </button>
          </header>
          <label>
            Name
            <input
              required
              aria-label="Fraktionsname"
              maxLength={100}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label>
            Notizen
            <textarea
              aria-label="Fraktionsnotizen"
              rows={4}
              maxLength={20_000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <label>
            Gesinnung ({disposition})
            <input
              aria-label="Fraktionsgesinnung"
              type="range"
              min={-50}
              max={50}
              value={disposition}
              onChange={(event) => setDisposition(Number(event.target.value))}
            />
          </label>
          <label>
            Primäre Encounter-Tabelle
            <span className="faction-table-selection">
              <select
                aria-label="Primäre Encounter-Tabelle"
                value={primaryEncounterTableId ?? ''}
                onChange={(event) =>
                  selectPrimaryTable(event.target.value || null)
                }
              >
                <option value="">Keine primäre Tabelle</option>
                {props.tableSnapshot.tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.displayName}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setTableManager(null)}>
                Neue Encounter-Tabelle
              </button>
            </span>
          </label>
          <h3>Endlicher Bestand</h3>
          <p className="muted">
            Der Bestand basiert auf der Primärtabelle. Ein leeres Maximum
            bedeutet unbegrenzt.
          </p>
          <ul className="source-entry-list">
            {selectedTable?.entries.map((entry) => (
              <li key={entry.creatureId}>
                <span>
                  {names[entry.creatureId] ??
                    `Nicht verfügbar (${entry.creatureId})`}
                </span>
                <label>
                  Maximum
                  <input
                    aria-label={`Maximum ${names[entry.creatureId] ?? entry.creatureId}`}
                    type="number"
                    min={0}
                    placeholder="Unbegrenzt"
                    value={inventory[entry.creatureId] ?? ''}
                    onChange={(event) => {
                      const next = { ...inventory }
                      if (!event.target.value) delete next[entry.creatureId]
                      else
                        next[entry.creatureId] = Math.max(
                          0,
                          Number(event.target.value)
                        )
                      setInventory(next)
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...inventory }
                    delete next[entry.creatureId]
                    setInventory(next)
                  }}
                >
                  Unbegrenzt
                </button>
              </li>
            ))}
          </ul>
          {!selectedTable && (
            <p className="empty-state">
              Wähle eine Encounter-Tabelle, um den Bestand festzulegen.
            </p>
          )}
          <footer>
            <button type="button" onClick={props.close}>
              Abbrechen
            </button>
            <button disabled={!displayName.trim()}>
              {props.faction ? 'Speichern' : 'Erstellen'}
            </button>
          </footer>
        </form>
      </div>
      {tableManager !== undefined && (
        <EncounterTableDialog
          key={tableManager?.id ?? 'new-faction-table'}
          table={tableManager}
          tables={props.tableSnapshot.tables}
          close={() => setTableManager(undefined)}
          select={setTableManager}
          save={(table, draft) => void saveTable(table, draft)}
          onError={props.onError}
          inspect={props.inspect}
        />
      )}
    </>
  )
}
