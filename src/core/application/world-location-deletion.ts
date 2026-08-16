import { randomUUID } from 'node:crypto'
import type { WorldLocationDeleteReceipt } from '../../shared/contracts/world-location.js'
import type { CampaignUnitOfWork } from './campaign-unit-of-work.js'
import type { HexMapStore } from '../hex/hex-map-store.js'
import type { HexEditJournalStore } from '../hex/hex-edit-journal-store.js'

export type WorldLocationDeletionContext = Readonly<{
  unitOfWork: Pick<CampaignUnitOfWork, 'run'>
  maps: Pick<HexMapStore, 'unlinkDeletedLocation'>
  journal: Pick<HexEditJournalStore, 'removeLocationReferences'>
  locations: Readonly<{
    delete(id: string, expectedRevision: number): WorldLocationDeleteReceipt
  }>
  npcs: Readonly<{ unlinkLocation(id: string): readonly string[] }>
}>

export class WorldLocationDeletionCommandHandler {
  constructor(
    private readonly createContext: () => WorldLocationDeletionContext
  ) {}

  execute(input: { id: string; expectedRevision: number }) {
    const { unitOfWork, maps, journal, locations, npcs } = this.createContext()
    return unitOfWork.run(() => {
      const change = maps.unlinkDeletedLocation(input.id)
      journal.removeLocationReferences(input.id)
      const unlinkedNpcIds = npcs.unlinkLocation(input.id)
      const receipt = locations.delete(input.id, input.expectedRevision)
      return {
        receipt,
        unlinkedNpcIds,
        notice: change
          ? {
              campaignCommandId: randomUUID(),
              map: change.map,
              changedChunk: {
                mapId: change.map.id,
                key: change.chunk.key,
                revision: change.chunk.revision
              }
            }
          : null
      }
    })
  }
}
