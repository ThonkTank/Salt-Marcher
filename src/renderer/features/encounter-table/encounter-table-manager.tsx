import { useEffect, useReducer, useState } from 'react'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery
} from '../../../shared/contracts/encounter.js'
import type {
  EncounterTable,
  EncounterTableDraft,
  EncounterTableSnapshot
} from '../../../shared/contracts/encounter-source.js'
import { formatMessage, message } from '../../i18n/messages.de.js'
import {
  CreatureCollectionCatalogPane,
  CreatureCollectionManagerDialog,
  CreatureCollectionSelection
} from '../creature-collection/creature-collection.js'
import {
  emptyCreatureOptions,
  emptyQuery,
  useCreatureSearch
} from '../creatures/creature-state.js'
import { creaturesCapabilities } from '../creatures/creatures-capabilities.js'
import type { CreatureCapabilityPort } from '../creatures/creatures-capabilities.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import { DiscardChangesDialog } from '../../shell/modal-dialog.js'
import {
  createEncounterTableDraftState,
  encounterTableDraftDirty,
  encounterTableDraftReducer,
  encounterTableDraftValue
} from './encounter-table-draft.js'

type PendingAction = { kind: 'close' } | { kind: 'select'; id: string }

export function EncounterTableManager(props: {
  table: EncounterTable | null
  tables: readonly EncounterTable[]
  close: () => void
  select: (table: EncounterTable | null) => void
  save: (
    table: EncounterTable | null,
    draft: EncounterTableDraft
  ) => Promise<EncounterTableSaveResult>
  saved: (snapshot: EncounterTableSnapshot, savedTableId: string) => void
  onError: (message: string) => void
  inspect: (creature: Creature) => void
  creaturePort?: CreatureCapabilityPort
}) {
  const [draft, dispatch] = useReducer(
    encounterTableDraftReducer,
    props.table,
    createEncounterTableDraftState
  )
  const [query, setQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    limit: 30
  })
  const [page, setPage] = useState<CreatureCatalogPage | null>(null)
  const [options, setOptions] = useState(emptyCreatureOptions)
  const [names, setNames] = useState<Readonly<Record<string, string>>>({})
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const creaturePort = props.creaturePort ?? creaturesCapabilities().creatures
  const dirty = encounterTableDraftDirty(draft)
  const creatureIdsKey = Object.keys(draft.weights).toSorted().join('\u0000')
  const entries = Object.entries(draft.weights).toSorted((left, right) =>
    (names[left[0]] ?? left[0]).localeCompare(names[right[0]] ?? right[0])
  )

  useCreatureSearch(query, setPage, props.onError, creaturePort)

  useEffect(() => {
    void creaturePort
      .filterOptions()
      .then(setOptions)
      .catch(reportCapabilityError(props.onError))
  }, [creaturePort, props.onError])

  useEffect(() => {
    const missing = creatureIdsKey
      .split('\u0000')
      .filter((id) => id && names[id] === undefined)
    if (missing.length === 0) return
    let current = true
    void Promise.all(
      missing.map((id) => creaturePort.detail(id).catch(() => null))
    ).then((rows) => {
      if (!current) return
      setNames((known) => ({
        ...known,
        ...Object.fromEntries(
          rows
            .filter((row): row is Creature => row !== null)
            .map((row) => [row.id, row.name])
        )
      }))
    })
    return () => {
      current = false
    }
    // Names are an append-only cache; ID changes alone trigger missing reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatureIdsKey, creaturePort])

  function perform(action: PendingAction) {
    if (action.kind === 'close') {
      props.close()
      return
    }
    props.select(
      action.id === 'new'
        ? null
        : (props.tables.find((table) => table.id === action.id) ?? null)
    )
  }

  function request(action: PendingAction) {
    if (busy) return
    if (dirty) setPending(action)
    else perform(action)
  }

  async function save() {
    if (busy || !draft.displayName.trim()) return
    setBusy(true)
    setError('')
    try {
      const result = await props.save(
        props.table,
        encounterTableDraftValue(draft)
      )
      props.saved(result.snapshot, result.savedTableId)
    } catch (cause) {
      const nextError = capabilityErrorText(cause)
      setError(nextError)
      props.onError(nextError)
    } finally {
      setBusy(false)
    }
  }

  const catalog = (
    <CreatureCollectionCatalogPane
      query={query}
      options={options}
      page={page}
      changed={setQuery}
      inspect={props.inspect}
      add={(creature) => {
        dispatch({ kind: 'add', creatureId: creature.id })
        setNames((known) => ({ ...known, [creature.id]: creature.name }))
      }}
    />
  )

  const draftPane = (
    <section
      className="creature-collection-draft-pane"
      aria-label={message('ui.aktuelle.encounter.tabelle')}
    >
      <CreatureCollectionSelection
        label={message('encounterTable.label')}
        selectLabel={message('encounterTable.select')}
        value={props.table?.id ?? 'new'}
        emptyLabel={message('encounterTable.selectPlaceholder')}
        newLabel={message('encounterTable.new')}
        choices={props.tables.map((table) => ({
          id: table.id,
          label: table.displayName
        }))}
        changed={(id) => {
          if (id) request({ kind: 'select', id })
        }}
      />
      <label>
        {message('ui.name')}
        <input
          required
          aria-label={message('ui.tabellenname')}
          maxLength={100}
          value={draft.displayName}
          onChange={(event) =>
            dispatch({ kind: 'name', value: event.target.value })
          }
        />
      </label>
      <label>
        {message('ui.beschreibung')}
        <textarea
          aria-label={message('ui.tabellenbeschreibung')}
          rows={4}
          maxLength={20_000}
          value={draft.description}
          onChange={(event) =>
            dispatch({ kind: 'description', value: event.target.value })
          }
        />
      </label>
      <h3>{message('ui.gewichtete.eintraege')}</h3>
      <ul className="creature-collection-roster">
        {entries.map(([id, weight]) => (
          <li key={id}>
            <div className="creature-collection-quantity">
              <button
                type="button"
                aria-label={formatMessage('encounterTable.decreaseWeight', {
                  name: names[id] ?? id
                })}
                disabled={weight <= 1 || busy}
                onClick={() =>
                  dispatch({
                    kind: 'weight',
                    creatureId: id,
                    value: weight - 1
                  })
                }
              >
                −
              </button>
              <strong>{weight}</strong>
              <button
                type="button"
                aria-label={formatMessage('encounterTable.increaseWeight', {
                  name: names[id] ?? id
                })}
                disabled={weight >= 10 || busy}
                onClick={() =>
                  dispatch({
                    kind: 'weight',
                    creatureId: id,
                    value: weight + 1
                  })
                }
              >
                +
              </button>
            </div>
            <span>
              <strong>
                {names[id] ??
                  formatMessage('catalog.unavailableReference', { id })}
              </strong>
              <small>
                {message('ui.gewicht')} {weight} {message('ui.von.10')}
              </small>
            </span>
            <button
              type="button"
              aria-label={formatMessage('encounterTable.removeCreature', {
                name: names[id] ?? id
              })}
              disabled={busy}
              onClick={() => dispatch({ kind: 'remove', creatureId: id })}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {entries.length === 0 && (
        <p className="creature-collection-empty">
          {message('ui.monster.links.mit')} <strong>+</strong>{' '}
          {message('ui.hinzufuegen')}
        </p>
      )}
      {error && <p role="status">{error}</p>}
    </section>
  )

  return (
    <>
      <CreatureCollectionManagerDialog
        className="encounter-table-manager"
        title={message('ui.encounter.tabellen.managen')}
        kicker={message('nav.catalog')}
        closeLabel={message('ui.dialog.schliessen')}
        close={() => request({ kind: 'close' })}
        busy={busy}
        catalog={catalog}
        divider={{ kind: 'fixed' }}
        draft={draftPane}
        footer={
          <>
            <span className="muted">
              {message(
                'ui.gewichte.bestimmen.die.relative.auswahlwahrscheinlichkeit'
              )}
            </span>
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => request({ kind: 'close' })}
              >
                {message('action.cancel')}
              </button>
              <button
                type="button"
                disabled={busy || !draft.displayName.trim()}
                onClick={() => void save()}
              >
                {props.table
                  ? message('action.save')
                  : message('action.create')}
              </button>
            </div>
          </>
        }
      />
      {pending && (
        <DiscardChangesDialog
          message={message('ui.ungespeicherte.aenderungen.verwerfen')}
          cancelLabel={message('action.cancel')}
          discardLabel={message('ui.aenderungen.verwerfen')}
          onCancel={() => setPending(null)}
          onDiscard={() => {
            const action = pending
            setPending(null)
            perform(action)
          }}
        />
      )}
    </>
  )
}

export type EncounterTableSaveResult = {
  snapshot: EncounterTableSnapshot
  savedTableId: string
}
