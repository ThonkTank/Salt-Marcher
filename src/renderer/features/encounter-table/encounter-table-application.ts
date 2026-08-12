import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  EncounterTable,
  EncounterTableChangeNotice,
  EncounterTableDeleteReceipt,
  EncounterTableDraft,
  EncounterTableMutationReceipt,
  EncounterTableScope,
  EncounterTableSnapshot
} from '../../../shared/contracts/encounter-source.js'
import {
  EncounterTableSnapshotAccumulator,
  encounterTableRevision
} from './encounter-table-snapshot.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'

export type EncounterTableApplicationPort = Readonly<{
  read: () => Promise<EncounterTableSnapshot>
  save: (
    table: EncounterTable | null,
    draft: EncounterTableDraft,
    scope: EncounterTableScope
  ) => Promise<EncounterTableMutationReceipt>
  remove: (table: EncounterTable) => Promise<EncounterTableDeleteReceipt>
  onChanged: (
    listener: (notice: EncounterTableChangeNotice) => void
  ) => () => void
}>

export function createEncounterTableApplicationPort(
  api: Pick<SaltMarcherApi, 'encounterTables'>
): EncounterTableApplicationPort {
  const snapshots = new EncounterTableSnapshotAccumulator()
  let loaded = false
  const read = async () => {
    const snapshot = snapshots.accept(await api.encounterTables.read())
    loaded = true
    return snapshot
  }
  const current = async () => (loaded ? snapshots.current() : read())
  return {
    read,
    save: async (table, draft, requestedScope) => {
      const known = await current()
      const scope = table?.scope ?? requestedScope
      const commandId = crypto.randomUUID()
      let receipt: EncounterTableMutationReceipt
      try {
        receipt = table
          ? await api.encounterTables.update({
              commandId,
              id: table.id,
              table: draft,
              expectedRevision: encounterTableRevision(known, scope),
              scope
            })
          : await api.encounterTables.create({
              commandId,
              table: draft,
              expectedRevision: encounterTableRevision(known, scope),
              scope
            })
      } catch (cause) {
        if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
        const recovered = await api.encounterTables.commandReceipt({
          commandId
        })
        if (!recovered || !('saved' in recovered)) throw cause
        receipt = recovered
      }
      return { ...receipt, snapshot: snapshots.accept(receipt.snapshot) }
    },
    remove: async (table) => {
      const known = await current()
      const commandId = crypto.randomUUID()
      let receipt: EncounterTableDeleteReceipt
      try {
        receipt = await api.encounterTables.delete({
          commandId,
          id: table.id,
          expectedRevision: encounterTableRevision(known, table.scope),
          scope: table.scope
        })
      } catch (cause) {
        if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
        const recovered = await api.encounterTables.commandReceipt({
          commandId
        })
        if (!recovered || !('deletedId' in recovered)) throw cause
        receipt = recovered
      }
      return { ...receipt, snapshot: snapshots.accept(receipt.snapshot) }
    },
    onChanged: (listener) => api.encounterTables.onChanged(listener)
  }
}
