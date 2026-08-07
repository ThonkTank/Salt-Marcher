import { useEffect, useState } from 'react'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  EncounterTable,
  EncounterTableChangeNotice,
  EncounterTableDraft,
  EncounterTableScope,
  EncounterTableSnapshot
} from '../../../shared/contracts/encounter-source.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import type { EncounterTableSaveResult } from './encounter-table-manager.js'

export type EncounterTableCatalogPort = {
  read: () => Promise<EncounterTableSnapshot>
  create: (
    commandId: string,
    draft: EncounterTableDraft,
    revision: number,
    scope?: EncounterTableScope
  ) => Promise<EncounterTableSnapshot>
  update: (
    commandId: string,
    id: string,
    draft: EncounterTableDraft,
    revision: number,
    scope?: EncounterTableScope
  ) => Promise<EncounterTableSnapshot>
  remove: (
    commandId: string,
    id: string,
    revision: number,
    scope?: EncounterTableScope
  ) => Promise<EncounterTableSnapshot>
  onChanged: (
    listener: (notice: EncounterTableChangeNotice) => void
  ) => () => void
}

export function createEncounterTableCatalogPort(
  api: SaltMarcherApi
): EncounterTableCatalogPort {
  return {
    read: () => api.encounterTables.read(),
    create: (commandId, draft, revision, scope) =>
      api.encounterTables.create(commandId, draft, revision, scope),
    update: (commandId, id, draft, revision, scope) =>
      api.encounterTables.update(commandId, id, draft, revision, scope),
    remove: (commandId, id, revision, scope) =>
      api.encounterTables.delete(commandId, id, revision, scope),
    onChanged: (listener) => api.encounterTables.onChanged(listener)
  }
}

export function useEncounterTableCatalogController(
  active: boolean,
  onError: (message: string) => void,
  port: EncounterTableCatalogPort
) {
  const [snapshot, setSnapshot] = useState<EncounterTableSnapshot>({
    revision: 0,
    installationRevision: 0,
    campaignRevision: 0,
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
        setSnapshot((known) => (isAtLeastAsNew(next, known) ? next : known))
      })
      .catch(reportCapabilityError(onError))
    return () => {
      current = false
    }
  }, [active, onError, port])

  useEffect(() => {
    if (!active) return
    return port.onChanged(() => {
      void port
        .read()
        .then((next) =>
          setSnapshot((known) => (isAtLeastAsNew(next, known) ? next : known))
        )
        .catch(reportCapabilityError(onError))
    })
  }, [active, onError, port])

  const visible = snapshot.tables.filter((table) =>
    `${table.displayName} ${table.description}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )

  async function save(
    table: EncounterTable | null,
    draft: EncounterTableDraft,
    requestedScope: EncounterTableScope = 'campaign'
  ): Promise<EncounterTableSaveResult> {
    const scope = table?.scope ?? requestedScope
    const revision =
      scope === 'installation'
        ? snapshot.installationRevision
        : snapshot.campaignRevision
    const previousIds = new Set(snapshot.tables.map((entry) => entry.id))
    const commandId = crypto.randomUUID()
    const next = table
      ? await port.update(commandId, table.id, draft, revision, scope)
      : await port.create(commandId, draft, revision, scope)
    const savedTableId =
      table?.id ??
      next.tables.find((entry) => !previousIds.has(entry.id))?.id ??
      ''
    if (!savedTableId) throw new Error('encounter_table_save_result_missing')
    return { snapshot: next, savedTableId }
  }

  async function remove(id: string) {
    try {
      const table = snapshot.tables.find((entry) => entry.id === id)
      if (!table || table.protected) return
      const revision =
        table.scope === 'installation'
          ? snapshot.installationRevision
          : snapshot.campaignRevision
      setSnapshot(
        await port.remove(crypto.randomUUID(), id, revision, table.scope)
      )
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

function isAtLeastAsNew(
  candidate: EncounterTableSnapshot,
  known: EncounterTableSnapshot
): boolean {
  return (
    candidate.installationRevision >= known.installationRevision &&
    candidate.campaignRevision >= known.campaignRevision
  )
}
