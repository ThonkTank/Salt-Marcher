import { useEffect, useState } from 'react'
import type {
  EncounterTable,
  EncounterTableDraft,
  EncounterTableMutationReceipt,
  EncounterTableScope,
  EncounterTableSnapshot
} from '../../../shared/contracts/encounter-source.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import {
  emptyEncounterTableSnapshot,
  encounterTables
} from './encounter-table-snapshot.js'
import type { EncounterTableApplicationPort } from './encounter-table-application.js'

export function useEncounterTableCatalogController(
  active: boolean,
  onError: (message: string) => void,
  port: EncounterTableApplicationPort
) {
  const [snapshot, setSnapshot] = useState<EncounterTableSnapshot>(
    emptyEncounterTableSnapshot
  )
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EncounterTable | null | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    let current = true
    void port
      .read()
      .then((next) => {
        if (current) setSnapshot(next)
      })
      .catch(reportCapabilityError(onError))
    return () => {
      current = false
    }
  }, [active, onError, port])

  useEffect(() => {
    if (!active) return
    return port.onChanged(() => {
      void port.read().then(setSnapshot).catch(reportCapabilityError(onError))
    })
  }, [active, onError, port])

  const visible = encounterTables(snapshot).filter((table) =>
    `${table.displayName} ${table.description}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )

  async function save(
    table: EncounterTable | null,
    draft: EncounterTableDraft,
    requestedScope: EncounterTableScope = 'campaign'
  ): Promise<EncounterTableMutationReceipt> {
    return port.save(table, draft, requestedScope)
  }

  async function remove(id: string) {
    try {
      const table = encounterTables(snapshot).find((entry) => entry.id === id)
      if (!table || table.protected) return
      const receipt = await port.remove(table)
      setSnapshot(receipt.snapshot)
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
