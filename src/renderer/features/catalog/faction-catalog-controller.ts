import { useEffect, useState } from 'react'
import type {
  EncounterTable,
  EncounterTableDraft,
  EncounterTableMutationReceipt,
  EncounterTableScope,
  EncounterTableSnapshot,
  WorldFaction,
  WorldFactionDraft,
  WorldFactionMutationReceipt,
  WorldFactionSnapshot
} from '../../../shared/contracts/encounter-source.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import {
  emptyEncounterTableSnapshot,
  encounterTables
} from '../encounter-table/encounter-table-snapshot.js'

import type { WorldFactionApplicationPort } from '../worldplanner/world-faction-application.js'

export function useFactionCatalogController(
  active: boolean,
  onError: (message: string) => void,
  port: WorldFactionApplicationPort
) {
  const [snapshot, setSnapshot] = useState<WorldFactionSnapshot>({
    revision: 0,
    factions: []
  })
  const [tableSnapshot, setTableSnapshot] = useState<EncounterTableSnapshot>(
    emptyEncounterTableSnapshot
  )
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<WorldFaction | null | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    let current = true
    void Promise.all([port.readFactions(), port.readTables()])
      .then(([nextFactions, nextTables]) => {
        if (!current) return
        setSnapshot(nextFactions)
        setTableSnapshot(nextTables)
      })
      .catch(reportCapabilityError(onError))
    return () => {
      current = false
    }
  }, [active, onError, port])

  useEffect(() => {
    if (!active) return
    return port.onTablesChanged(() => {
      void port
        .readTables()
        .then(setTableSnapshot)
        .catch(reportCapabilityError(onError))
    })
  }, [active, onError, port])

  const visible = snapshot.factions.filter((faction) =>
    `${faction.displayName} ${faction.notes}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )

  async function saveFaction(
    draft: WorldFactionDraft
  ): Promise<WorldFactionMutationReceipt> {
    const receipt = await port.saveFaction(editing ?? null, draft)
    setSnapshot(receipt.snapshot)
    return receipt
  }

  async function removeFaction(id: string) {
    try {
      const faction = snapshot.factions.find((entry) => entry.id === id)
      if (!faction) return
      const receipt = await port.deleteFaction(faction)
      setSnapshot(receipt.snapshot)
      setDeleteId(null)
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  async function saveTable(
    table: EncounterTable | null,
    draft: EncounterTableDraft,
    requestedScope: EncounterTableScope = 'campaign'
  ): Promise<EncounterTableMutationReceipt> {
    const receipt = await port.saveTable(table, draft, requestedScope)
    setTableSnapshot(receipt.snapshot)
    return receipt
  }

  return {
    snapshot,
    tableSnapshot,
    tables: encounterTables(tableSnapshot),
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
