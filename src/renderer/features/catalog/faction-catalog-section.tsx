import { useEffect, useMemo, useState } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type {
  EncounterTable,
  EncounterTableDraft,
  EncounterTableSnapshot,
  WorldFaction,
  WorldFactionDraft
} from '../../../shared/contracts/encounter-source.js'
import { formatMessage, message } from '../../i18n/messages.de.js'
import {
  DiscardChangesDialog,
  ModalCloseButton,
  ModalDialog
} from '../../shell/modal-dialog.js'
import { creaturesCapabilities } from '../creatures/creatures-capabilities.js'
import { EncounterTableManager } from '../encounter-table/encounter-table-manager.js'
import type { EncounterTableSaveResult } from '../encounter-table/encounter-table-manager.js'
import type { FactionCatalogController } from './faction-catalog-controller.js'

export function FactionCatalogSection(props: {
  controller: FactionCatalogController
  inspect: (creature: Creature) => void
  onError: (message: string) => void
}) {
  const controller = props.controller
  return (
    <>
      <div className="catalog-filters">
        <input
          aria-label={message('ui.fraktionen.suchen')}
          placeholder={message('ui.fraktionen.suchen.2')}
          value={controller.search}
          onChange={(event) => controller.setSearch(event.target.value)}
        />
        <button onClick={() => controller.setEditing(null)}>
          {message('ui.erstellen')}
        </button>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <th>{message('ui.name')}</th>
              <th>{message('ui.gesinnung')}</th>
              <th>{message('ui.primaertabelle')}</th>
              <th>{message('ui.bestand')}</th>
              <th>{message('ui.aktionen')}</th>
            </tr>
          </thead>
          <tbody>
            {controller.visible.map((faction) => (
              <tr key={faction.id}>
                <td>
                  <button
                    className="link-button"
                    onClick={() => controller.setEditing(faction)}
                  >
                    {faction.displayName}
                  </button>
                </td>
                <td>{faction.disposition}</td>
                <td>
                  {controller.tableSnapshot.tables.find(
                    (table) => table.id === faction.primaryEncounterTableId
                  )?.displayName ?? message('catalog.none')}
                </td>
                <td>
                  {faction.inventory.length} {message('ui.grenzen')}
                </td>
                <td className="row-actions">
                  {controller.deleteId === faction.id ? (
                    <>
                      <button onClick={() => controller.setDeleteId(null)}>
                        {message('action.cancel')}
                      </button>
                      <button
                        className="danger"
                        onClick={() =>
                          void controller.removeFaction(faction.id)
                        }
                      >
                        {message('ui.bestaetigen')}
                      </button>
                    </>
                  ) : (
                    <button
                      className="danger"
                      onClick={() => controller.setDeleteId(faction.id)}
                    >
                      {message('ui.loeschen')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="catalog-footer">
        <span>
          {controller.visible.length} {message('ui.fraktionen')}
        </span>
      </footer>
      {controller.editing !== undefined && (
        <FactionDialog
          faction={controller.editing}
          tableSnapshot={controller.tableSnapshot}
          tablesChanged={controller.setTableSnapshot}
          close={() => controller.setEditing(undefined)}
          save={(draft) => void controller.saveFaction(draft)}
          saveTable={controller.saveTable}
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
  close: () => void
  save: (draft: WorldFactionDraft) => void
  saveTable: (
    table: EncounterTable | null,
    draft: EncounterTableDraft
  ) => Promise<EncounterTableSaveResult>
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
  >()
  const [discardOpen, setDiscardOpen] = useState(false)
  const selectedTable = props.tableSnapshot.tables.find(
    (table) => table.id === primaryEncounterTableId
  )
  const selectedCreatureIds = useMemo(
    () => selectedTable?.entries.map((entry) => entry.creatureId) ?? [],
    [selectedTable]
  )
  const dirty =
    JSON.stringify({
      displayName,
      notes,
      disposition,
      primaryEncounterTableId,
      inventory: Object.entries(inventory).toSorted(([left], [right]) =>
        left.localeCompare(right)
      )
    }) !==
    JSON.stringify({
      displayName: props.faction?.displayName ?? '',
      notes: props.faction?.notes ?? '',
      disposition: props.faction?.disposition ?? 0,
      primaryEncounterTableId: props.faction?.primaryEncounterTableId ?? null,
      inventory: (props.faction?.inventory ?? [])
        .map((entry) => [entry.creatureId, entry.maximum])
        .toSorted((left, right) =>
          String(left[0]).localeCompare(String(right[0]))
        )
    })

  useEffect(() => {
    let current = true
    void Promise.all(
      selectedCreatureIds.map((id) =>
        creaturesCapabilities()
          .creatures.detail(id)
          .catch(() => null)
      )
    ).then((rows) => {
      if (!current) return
      setNames(
        Object.fromEntries(
          rows
            .filter((row): row is Creature => row !== null)
            .map((row) => [row.id, row.name])
        )
      )
    })
    return () => {
      current = false
    }
  }, [selectedCreatureIds])

  const requestClose = () => {
    if (dirty) setDiscardOpen(true)
    else props.close()
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
      <ModalDialog
        form
        className="catalog-location-editor catalog-faction-editor"
        ariaLabel={
          props.faction
            ? message('catalog.editFaction')
            : message('catalog.createFaction')
        }
        onClose={requestClose}
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
            <p className="section-kicker">{message('ui.world.planner')}</p>
            <h2>
              {props.faction
                ? message('catalog.editFaction')
                : message('catalog.createFaction')}
            </h2>
          </div>
          <ModalCloseButton aria-label={message('ui.dialog.schliessen')}>
            ×
          </ModalCloseButton>
        </header>
        <label>
          {message('ui.name')}
          <input
            required
            aria-label={message('ui.fraktionsname')}
            maxLength={100}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label>
          {message('ui.notizen')}
          <textarea
            aria-label={message('ui.fraktionsnotizen')}
            rows={4}
            maxLength={20_000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <label>
          {message('ui.gesinnung.2')} {disposition}
          <input
            aria-label={message('ui.fraktionsgesinnung')}
            type="range"
            min={-50}
            max={50}
            value={disposition}
            onChange={(event) => setDisposition(Number(event.target.value))}
          />
        </label>
        <label>
          {message('ui.primaere.encounter.tabelle')}
          <span className="catalog-faction-table-selection">
            <select
              aria-label={message('ui.primaere.encounter.tabelle')}
              value={primaryEncounterTableId ?? ''}
              onChange={(event) =>
                selectPrimaryTableFromSnapshot(
                  event.target.value || null,
                  props.tableSnapshot
                )
              }
            >
              <option value="">{message('ui.keine.primaere.tabelle')}</option>
              {props.tableSnapshot.tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.displayName}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setTableManager(null)}>
              {message('ui.neue.encounter.tabelle')}
            </button>
          </span>
        </label>
        <h3>{message('ui.endlicher.bestand')}</h3>
        <p className="muted">
          {message('ui.der.bestand.basiert.auf.der.primaertabelle.ein.leeres')}
        </p>
        <ul className="catalog-source-entry-list">
          {selectedTable?.entries.map((entry) => (
            <li key={entry.creatureId}>
              <span>
                {names[entry.creatureId] ??
                  formatMessage('catalog.unavailableReference', {
                    id: entry.creatureId
                  })}
              </span>
              <label>
                {message('ui.maximum')}
                <input
                  aria-label={formatMessage('catalog.inventoryMaximum', {
                    name: names[entry.creatureId] ?? entry.creatureId
                  })}
                  type="number"
                  min={0}
                  placeholder={message('ui.unbegrenzt')}
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
                {message('ui.unbegrenzt')}
              </button>
            </li>
          ))}
        </ul>
        {!selectedTable && (
          <p className="catalog-empty-state">
            {message(
              'ui.waehle.eine.encounter.tabelle.um.den.bestand.festzulegen'
            )}
          </p>
        )}
        <footer>
          <ModalCloseButton>{message('action.cancel')}</ModalCloseButton>
          <button disabled={!displayName.trim()}>
            {props.faction ? message('action.save') : message('action.create')}
          </button>
        </footer>
      </ModalDialog>
      {tableManager !== undefined && (
        <EncounterTableManager
          key={tableManager?.id ?? 'new-faction-table'}
          table={tableManager}
          tables={props.tableSnapshot.tables}
          close={() => setTableManager(undefined)}
          select={setTableManager}
          save={props.saveTable}
          saved={(next, savedTableId) => {
            props.tablesChanged(next)
            selectPrimaryTableFromSnapshot(savedTableId, next)
            setTableManager(undefined)
          }}
          onError={props.onError}
          inspect={props.inspect}
        />
      )}
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
