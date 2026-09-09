import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { EncounterTableStore } from '@historical/tables'
import { WorldFactionStore } from '@historical/factions'
import { WorldLocationStore } from '@historical/locations'
import { WorldNpcApplicationService } from '@historical/npc-service'
import { creatureById } from '@historical/creatures'
import { fixedSqliteDatabaseAccess } from '@historical/database-access'

function world(database: Database.Database) {
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
    fixedSqliteDatabaseAccess(database),
    {
      resolve(id: string) {
        const creature = creatureById(id)
        return creature ? { id: creature.id, displayName: creature.name } : null
      }
    },
    (db) => new WorldFactionStore(db, references)
  )
  return { tables, factions, locations, npcs }
}

export function seedHistoricalWorld(
  database: Database.Database,
  index: number
) {
  const { tables, factions, locations, npcs } = world(database)
  const table = tables.create(
    randomUUID(),
    {
      displayName: 'Bewohner der Salzfurt',
      description: 'Begegnungen am alten Fährweg.',
      entries: [
        { creatureId: 'wolf', weight: 2 },
        { creatureId: 'sprite', weight: 1 }
      ]
    },
    tables.read().revision
  ).saved
  const faction = factions.create(
    randomUUID(),
    {
      displayName: 'Hüter der Fähre',
      notes: 'Bewachen den Übergang.',
      disposition: 15,
      primaryEncounterTableId: table.id,
      inventory: []
    },
    factions.read().revision
  ).saved
  const location = locations.create(
    {
      displayName: `Salzfurt ${index + 1}`,
      tags: ['Küste', 'Furt'],
      readAloud: 'Im Dünengras warten zwei Wölfe.',
      notes: 'Die alte Fähre ist noch benutzbar.',
      factionIds: [faction.id],
      encounterTableIds: [table.id]
    },
    locations.read().revision
  ).saved
  npcs.create(
    randomUUID(),
    {
      displayName: 'Erika',
      creatureId: 'sprite',
      lifecycle: 'active',
      appearance: 'Kleine Fee.',
      behavior: 'Neugierig.',
      history: 'Tochter von Rosenschein.',
      notes: 'Aus der Flussuferhöhle gerettet.',
      dispositionModifier: 0,
      factionId: faction.id,
      locationId: location.id
    },
    npcs.readAllForReferences().revision,
    factions.read().revision
  )
  return location.id
}

export function readHistoricalWorld(database: Database.Database) {
  const { tables, factions, locations, npcs } = world(database)
  return {
    tables: tables.read(),
    factions: factions.read(),
    locations: locations.read(),
    npcs: npcs.readAllForReferences()
  }
}
