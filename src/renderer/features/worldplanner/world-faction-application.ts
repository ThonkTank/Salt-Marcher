import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  EncounterTableChangeNotice,
  EncounterTableSnapshot,
  WorldFaction,
  WorldFactionDeleteReceipt,
  WorldFactionDraft,
  WorldFactionMutationReceipt,
  WorldFactionSnapshot
} from '../../../shared/contracts/encounter-source.js'
import {
  createEncounterTableApplicationPort,
  type EncounterTableApplicationPort
} from '../encounter-table/encounter-table-application.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'

export type WorldFactionApplicationPort = Readonly<{
  readFactions: () => Promise<WorldFactionSnapshot>
  readTables: () => Promise<EncounterTableSnapshot>
  saveFaction: (
    faction: WorldFaction | null,
    draft: WorldFactionDraft
  ) => Promise<WorldFactionMutationReceipt>
  deleteFaction: (faction: WorldFaction) => Promise<WorldFactionDeleteReceipt>
  saveTable: EncounterTableApplicationPort['save']
  onTablesChanged: (
    listener: (notice: EncounterTableChangeNotice) => void
  ) => () => void
}>

export function createWorldFactionApplicationPort(
  api: Pick<SaltMarcherApi, 'factions' | 'encounterTables'>
): WorldFactionApplicationPort {
  const tables = createEncounterTableApplicationPort(api)
  let factions: WorldFactionSnapshot | null = null
  const readFactions = async () => {
    const candidate = await api.factions.read()
    if (!factions || candidate.revision >= factions.revision)
      factions = candidate
    return factions
  }
  const currentFactions = async () => factions ?? readFactions()
  return {
    readFactions,
    readTables: tables.read,
    saveFaction: async (faction, draft) => {
      const known = await currentFactions()
      const commandId = crypto.randomUUID()
      let receipt: WorldFactionMutationReceipt
      try {
        receipt = faction
          ? await api.factions.update({
              commandId,
              id: faction.id,
              faction: draft,
              expectedRevision: known.revision
            })
          : await api.factions.create({
              commandId,
              faction: draft,
              expectedRevision: known.revision
            })
      } catch (cause) {
        if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
        const recovered = await api.factions.commandReceipt({ commandId })
        if (!recovered || !('saved' in recovered)) throw cause
        receipt = recovered
      }
      factions = receipt.snapshot
      return receipt
    },
    deleteFaction: async (faction) => {
      const known = await currentFactions()
      const commandId = crypto.randomUUID()
      let receipt: WorldFactionDeleteReceipt
      try {
        receipt = await api.factions.delete({
          commandId,
          id: faction.id,
          expectedRevision: known.revision
        })
      } catch (cause) {
        if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
        const recovered = await api.factions.commandReceipt({ commandId })
        if (!recovered || !('deletedId' in recovered)) throw cause
        receipt = recovered
      }
      factions = receipt.snapshot
      return receipt
    },
    saveTable: tables.save,
    onTablesChanged: tables.onChanged
  }
}
