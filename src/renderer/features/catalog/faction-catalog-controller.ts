import { useEffect, useState } from 'react'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  EncounterTable,
  EncounterTableDraft,
  EncounterTableSnapshot,
  WorldFaction,
  WorldFactionDraft,
  WorldFactionSnapshot
} from '../../../shared/contracts/encounter-source.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import type { EncounterTableSaveResult } from '../encounter-table/encounter-table-manager.js'

export type FactionCatalogPort = {
  readFactions: () => Promise<WorldFactionSnapshot>
  readTables: () => Promise<EncounterTableSnapshot>
  createFaction: (
    draft: WorldFactionDraft,
    revision: number
  ) => Promise<WorldFactionSnapshot>
  updateFaction: (
    id: string,
    draft: WorldFactionDraft,
    revision: number
  ) => Promise<WorldFactionSnapshot>
  deleteFaction: (id: string, revision: number) => Promise<WorldFactionSnapshot>
  createTable: (
    draft: EncounterTableDraft,
    revision: number
  ) => Promise<EncounterTableSnapshot>
  updateTable: (
    id: string,
    draft: EncounterTableDraft,
    revision: number
  ) => Promise<EncounterTableSnapshot>
}

export function createFactionCatalogPort(
  api: SaltMarcherApi
): FactionCatalogPort {
  return {
    readFactions: () => api.factions.read(),
    readTables: () => api.encounterTables.read(),
    createFaction: (draft, revision) => api.factions.create(draft, revision),
    updateFaction: (id, draft, revision) =>
      api.factions.update(id, draft, revision),
    deleteFaction: (id, revision) => api.factions.delete(id, revision),
    createTable: (draft, revision) =>
      api.encounterTables.create(draft, revision),
    updateTable: (id, draft, revision) =>
      api.encounterTables.update(id, draft, revision)
  }
}

export function useFactionCatalogController(
  active: boolean,
  onError: (message: string) => void,
  port: FactionCatalogPort
) {
  const [snapshot, setSnapshot] = useState<WorldFactionSnapshot>({
    revision: 0,
    factions: []
  })
  const [tableSnapshot, setTableSnapshot] = useState<EncounterTableSnapshot>({
    revision: 0,
    tables: []
  })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<WorldFaction | null | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    let current = true
    void Promise.all([port.readFactions(), port.readTables()])
      .then(([factions, tables]) => {
        if (!current) return
        setSnapshot((known) =>
          factions.revision >= known.revision ? factions : known
        )
        setTableSnapshot((known) =>
          tables.revision >= known.revision ? tables : known
        )
      })
      .catch(reportCapabilityError(onError))
    return () => {
      current = false
    }
  }, [active, onError, port])

  const visible = snapshot.factions.filter((faction) =>
    `${faction.displayName} ${faction.notes}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )

  async function saveFaction(draft: WorldFactionDraft) {
    try {
      setSnapshot(
        editing
          ? await port.updateFaction(editing.id, draft, snapshot.revision)
          : await port.createFaction(draft, snapshot.revision)
      )
      setEditing(undefined)
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  async function removeFaction(id: string) {
    try {
      setSnapshot(await port.deleteFaction(id, snapshot.revision))
      setDeleteId(null)
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  async function saveTable(
    table: EncounterTable | null,
    draft: EncounterTableDraft
  ): Promise<EncounterTableSaveResult> {
    const previousIds = new Set(tableSnapshot.tables.map((entry) => entry.id))
    const next = table
      ? await port.updateTable(table.id, draft, tableSnapshot.revision)
      : await port.createTable(draft, tableSnapshot.revision)
    const savedTableId =
      table?.id ??
      next.tables.find((entry) => !previousIds.has(entry.id))?.id ??
      ''
    if (!savedTableId) throw new Error('encounter_table_save_result_missing')
    return { snapshot: next, savedTableId }
  }

  return {
    snapshot,
    tableSnapshot,
    visible,
    search,
    editing,
    deleteId,
    setSearch,
    setEditing,
    setDeleteId,
    setTableSnapshot,
    saveFaction,
    removeFaction,
    saveTable
  }
}

export type FactionCatalogController = ReturnType<
  typeof useFactionCatalogController
>
