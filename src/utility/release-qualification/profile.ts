import type Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CampaignStore } from '../../core/persistence/sqlite/campaign-store.js'
import { preflightPersistence } from '../../core/persistence/sqlite/persistence-preflight.js'
import { fixedSqliteDatabaseAccess } from '../../core/persistence/sqlite/database-access.js'
import { PartyStore } from '../../core/party/party-store.js'
import { EncounterTableStore } from '../../core/encounter/encounter-table-store.js'
import { WorldFactionStore } from '../../core/worldplanner/faction-store.js'
import { WorldLocationStore } from '../../core/worldplanner/location-store.js'
import { WorldNpcApplicationService } from '../../core/application/world-npc-application-service.js'
import { creatureById } from '../../core/creatures/catalog.js'
import { LivePlayService } from '../../core/encounter/live-combat.js'
import { HexMapStore } from '../../core/hex/hex-map-store.js'
import { HexTravelService } from '../../core/hex/hex-travel.js'

/** Domain readback only: qualification never introduces a second migration path. */
export function readReleaseQualificationProfile(profile: string) {
  const data = join(profile, 'campaign-data')
  if (preflightPersistence(data).kind !== 'ready')
    throw new Error(
      'Release inspection requires the exact current schema before opening.'
    )
  const store = new CampaignStore(data)
  try {
    const registry = store.list()
    return {
      coverage: 'settings-campaigns-party-own-files-world-combat-travel-v3',
      settings: store.readSettings(),
      registry: {
        activeCampaignId: registry.activeCampaignId,
        campaigns: registry.campaigns,
        trashedCampaigns: registry.trashedCampaigns
      },
      campaigns: store
        .visitCampaignDatabases(({ id, name, trashed, database }) => ({
          id,
          name,
          trashed,
          ...readCampaign(database)
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      preferences: readFileSync(join(profile, 'preferences.json'), 'utf8'),
      ownFiles: ownFiles(join(profile, 'own-content'))
    }
  } finally {
    store.close()
  }
}
function readCampaign(database: Database.Database) {
  const access = fixedSqliteDatabaseAccess(database)
  const tables = new EncounterTableStore(database)
  const references = {
    containsTable: (id: string) => tables.contains(id),
    containsCreature: (tableId: string, creatureId: string) =>
      tables.containsCreature(tableId, creatureId)
  }
  const factions = new WorldFactionStore(database, references)
  const locations = new WorldLocationStore(database, {
    containsFaction: (id: string) => factions.contains(id),
    containsEncounterTable: (id: string) => tables.contains(id)
  })
  const npcs = new WorldNpcApplicationService(
    access,
    {
      resolve(id: string) {
        const creature = creatureById(id)
        return creature ? { id: creature.id, displayName: creature.name } : null
      }
    },
    (db) => new WorldFactionStore(db, references)
  )
  const play = new LivePlayService(access)
  const maps = new HexMapStore(database, new WorldLocationStore(database))
  const catalog = maps.catalog()
  return {
    party: new PartyStore(database).read(),
    game: {
      locations: new WorldLocationStore(database).read(),
      session: play.readSession()
    },
    world: {
      tables: tables.read(),
      factions: factions.read(),
      locations: locations.read(),
      npcs: npcs.readAllForReferences()
    },
    travel: {
      catalog,
      chunks: catalog.maps.map(({ id }) =>
        maps.readChunks(id, [{ q: 0, r: 0 }])
      ),
      journey: new HexTravelService(access).read(
        play.readSession().scene.focusedSceneId
      )
    }
  }
}
function ownFiles(
  directory: string,
  prefix = ''
): { path: string; kind: 'file' | 'directory'; base64?: string }[] {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = prefix + entry.name
      if (entry.isDirectory())
        return [
          { path, kind: 'directory' as const },
          ...ownFiles(join(directory, entry.name), `${path}/`)
        ]
      if (!entry.isFile())
        throw new Error('Unexpected own-content filesystem entry.')
      return [
        {
          path,
          kind: 'file' as const,
          base64: readFileSync(join(directory, entry.name)).toString('base64')
        }
      ]
    })
}
