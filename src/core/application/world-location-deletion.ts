import { randomUUID } from 'node:crypto'
import type { WorldLocationSnapshot } from '../../shared/contracts/world-location.js'
import type { CampaignUnitOfWork } from './campaign-unit-of-work.js'
import type { HexMapStore } from '../hex/hex-map-store.js'
import type { HexEditJournalStore } from '../hex/hex-edit-journal-store.js'

export type WorldLocationDeletionContext = Readonly<{
  unitOfWork: Pick<CampaignUnitOfWork, 'run'>
  maps: Pick<HexMapStore, 'unlinkDeletedLocation'>
  journal: Pick<HexEditJournalStore, 'removeLocationReferences'>
  locations: Readonly<{
    delete(id: string, expectedRevision: number): WorldLocationSnapshot
  }>
}>

export class WorldLocationDeletionCommandHandler {
  constructor(
    private readonly createContext: () => WorldLocationDeletionContext
  ) {}

  execute(input: { id: string; expectedRevision: number }) {
    const { unitOfWork, maps, journal, locations } = this.createContext()
    return unitOfWork.run(() => {
      const change = maps.unlinkDeletedLocation(input.id)
      journal.removeLocationReferences(input.id)
      const snapshot = locations.delete(input.id, input.expectedRevision)
      return {
        snapshot,
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
