import { useEffect, useState } from 'react'
import type { CatalogCapabilities } from './catalog-capabilities.js'
import type { WorldFaction } from '../../../shared/contracts/encounter-source.js'
import type { WorldLocation } from '../../../shared/contracts/world-location.js'
import type {
  WorldNpc,
  WorldNpcDraft,
  WorldNpcSnapshot
} from '../../../shared/contracts/world-npc.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import { reportCapabilityError } from '../../capabilities/capability-errors.js'

export function useNpcCatalogController(
  active: boolean,
  onError: (message: string) => void,
  api: CatalogCapabilities
) {
  const [snapshot, setSnapshot] = useState<WorldNpcSnapshot>({
    revision: 0,
    npcs: []
  })
  const [factions, setFactions] = useState<readonly WorldFaction[]>([])
  const [locations, setLocations] = useState<readonly WorldLocation[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<WorldNpc | null | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    let current = true
    const load = () =>
      Promise.all([api.npcs.read(), api.factions.read(), api.locations.read()])
        .then(([npcs, factionSnapshot, locationSnapshot]) => {
          if (!current) return
          setSnapshot(npcs)
          setFactions(factionSnapshot.factions)
          setLocations(locationSnapshot.locations)
        })
        .catch(reportCapabilityError(onError))
    void load()
    const unsubscribe = api.npcs.onChanged(() => {
      void load()
    })
    return () => {
      current = false
      unsubscribe()
    }
  }, [active, api, onError])

  const needle = search.trim().toLocaleLowerCase()
  const visible = snapshot.npcs.filter((npc) =>
    [
      npc.displayName,
      npc.creatureId,
      npc.appearance,
      npc.behavior,
      npc.history,
      npc.notes
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(needle)
  )

  async function save(draft: WorldNpcDraft) {
    const commandId = crypto.randomUUID()
    try {
      const receipt = editing
        ? await api.npcs.update({
            commandId,
            id: editing.id,
            npc: draft,
            expectedRevision: snapshot.revision
          })
        : await api.npcs.create({
            commandId,
            npc: draft,
            expectedRevision: snapshot.revision
          })
      setSnapshot(receipt.snapshot)
      setEditing(undefined)
    } catch (cause) {
      if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
      const recovered = await api.npcs.commandReceipt({ commandId })
      if (!recovered || !('saved' in recovered)) throw cause
      setSnapshot(recovered.snapshot)
      setEditing(undefined)
    }
  }

  async function remove(id: string) {
    const commandId = crypto.randomUUID()
    try {
      let receipt
      try {
        receipt = await api.npcs.delete({
          commandId,
          id,
          expectedRevision: snapshot.revision
        })
      } catch (cause) {
        if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
        const recovered = await api.npcs.commandReceipt({ commandId })
        if (!recovered || !('deletedId' in recovered)) throw cause
        receipt = recovered
      }
      setSnapshot(receipt.snapshot)
      setDeleteId(null)
    } catch (cause) {
      reportCapabilityError(onError)(cause)
    }
  }

  return {
    snapshot,
    visible,
    factions,
    locations,
    search,
    editing,
    deleteId,
    setSearch,
    setEditing,
    setDeleteId,
    save,
    remove
  }
}

export type NpcCatalogController = ReturnType<typeof useNpcCatalogController>
