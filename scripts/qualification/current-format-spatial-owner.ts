import type Database from 'better-sqlite3'
import { CampaignUnitOfWork } from '../../src/core/application/campaign-unit-of-work.js'
import { HexMapEditingCommandHandler } from '../../src/core/application/hex-map-editing.js'
import { HexEditJournalStore } from '../../src/core/hex/hex-edit-journal-store.js'
import { HexMapStore } from '../../src/core/hex/hex-map-store.js'
import { HexTravelStore } from '../../src/core/hex/hex-travel.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { SceneStore } from '../../src/core/scene/scene-store.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'

export function createCurrentFormatSpatialEditingOwner(
  database: Database.Database,
  now: () => number
): HexMapEditingCommandHandler {
  return new HexMapEditingCommandHandler(() => {
    const locations = new WorldLocationStore(database)
    const maps = new HexMapStore(database, locations)
    const party = new PartyStore(database)
    const scenes = new SceneStore(database, () => locations.read().locations)
    return {
      unitOfWork: new CampaignUnitOfWork(database),
      maps,
      party,
      travel: new HexTravelStore(database, maps, party, scenes, now),
      journal: new HexEditJournalStore(database)
    }
  })
}
