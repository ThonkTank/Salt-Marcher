import { useEffect, useState } from 'react'
import type {
  EncounterTable,
  EncounterTableDraft,
  EncounterTableSnapshot
} from '../../../shared/contracts/encounter-source.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import { encounterTableCapabilities } from './encounter-table-capabilities.js'
import type { EncounterTableSaveResult } from './encounter-table-manager.js'

export type EncounterTableCatalogPort = {
  read: () => Promise<EncounterTableSnapshot>
  create: (
    draft: EncounterTableDraft,
    revision: number
  ) => Promise<EncounterTableSnapshot>
  update: (
    id: string,
    draft: EncounterTableDraft,
    revision: number
  ) => Promise<EncounterTableSnapshot>
  remove: (id: string, revision: number) => Promise<EncounterTableSnapshot>
}

const defaultEncounterTableCatalogPort: EncounterTableCatalogPort = {
  read: () => encounterTableCapabilities().encounterTables.read(),
  create: (draft, revision) =>
    encounterTableCapabilities().encounterTables.create(draft, revision),
  update: (id, draft, revision) =>
    encounterTableCapabilities().encounterTables.update(id, draft, revision),
  remove: (id, revision) =>
    encounterTableCapabilities().encounterTables.delete(id, revision)
}

export function useEncounterTableCatalogController(
  active: boolean,
  onError: (message: string) => void,
  port: EncounterTableCatalogPort = defaultEncounterTableCatalogPort
) {
  const [snapshot, setSnapshot] = useState<EncounterTableSnapshot>({
    revision: 0,
    tables: []
  })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EncounterTable | null | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    let current = true
    void port
      .read()
      .then((next) => {
        if (!current) return
        setSnapshot((known) => (next.revision >= known.revision ? next : known))
      })
      .catch(reportCapabilityError(onError))
    return () => {
      current = false
    }
  }, [active, onError, port])

  const visible = snapshot.tables.filter((table) =>
    `${table.displayName} ${table.description}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )

  async function save(
    table: EncounterTable | null,
    draft: EncounterTableDraft
  ): Promise<EncounterTableSaveResult> {
    const previousIds = new Set(snapshot.tables.map((entry) => entry.id))
    const next = table
      ? await port.update(table.id, draft, snapshot.revision)
      : await port.create(draft, snapshot.revision)
    const savedTableId =
      table?.id ??
      next.tables.find((entry) => !previousIds.has(entry.id))?.id ??
      ''
    if (!savedTableId) throw new Error('encounter_table_save_result_missing')
    return { snapshot: next, savedTableId }
  }

  async function remove(id: string) {
    try {
      setSnapshot(await port.remove(id, snapshot.revision))
      setDeleteId(null)
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  return {
    snapshot,
    visible,
    search,
    editing,
    deleteId,
    setSnapshot,
    setSearch,
    setEditing,
    setDeleteId,
    save,
    remove
  }
}

export type EncounterTableCatalogController = ReturnType<
  typeof useEncounterTableCatalogController
>
