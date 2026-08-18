import type Database from 'better-sqlite3'
import { initializeCampaignRulesSchema } from '../../application/campaign-rules-service.js'
import { initializeCampaignImportSchema } from '../../campaign-import/campaign-import-store.js'
import { initializeCombatSchema } from '../../encounter/live-combat.js'
import { initializeEncounterPlanSchema } from '../../encounter/encounter-plan-store.js'
import { initializeEncounterTableSchema } from '../../encounter/encounter-table-store.js'
import { initializeHexSchema } from '../../hex/hex-map-store.js'
import { initializeCharacterLootSchema } from '../../loot/character-loot-store.js'
import { initializeLegacyItemDefinitionSchema } from '../../loot/item-definition-resolver.js'
import { initializeLootSchema } from '../../loot/loot-schema.js'
import { initializePartySchema, PartyStore } from '../../party/party-store.js'
import { initializeSceneSchema } from '../../scene/scene-store.js'
import { initializeSessionGenerationSchema } from '../../session-generation/generated-run-store.js'
import { initializeSessionPlannerSchema } from '../../session-planner/session-planner-store.js'
import { initializeWorldFactionSchema } from '../../worldplanner/faction-store.js'
import { initializeWorldLocationSchema } from '../../worldplanner/location-store.js'
import { initializeWorldLocationSaveJournalSchema } from '../../worldplanner/world-location-save-journal.js'
import { initializeWorldNpcSchema } from '../../worldplanner/npc-store.js'
import { initializeCampaignSchemaMetadata } from './campaign-schema-migrations.js'
import { initializeSchemaVersion } from './database.js'

export interface CampaignSchemaRegistration {
  readonly name: string
  readonly after?: readonly string[]
  readonly initialize: (database: Database.Database) => void
}

export class CampaignSchemaBootstrapper {
  private readonly ordered: readonly CampaignSchemaRegistration[]

  constructor(registrations: readonly CampaignSchemaRegistration[]) {
    this.ordered = orderRegistrations(registrations)
  }

  initialize(database: Database.Database): void {
    for (const registration of this.ordered) registration.initialize(database)
  }

  names(): readonly string[] {
    return this.ordered.map(({ name }) => name)
  }
}

export function createDefaultCampaignSchemaBootstrapper(): CampaignSchemaBootstrapper {
  return new CampaignSchemaBootstrapper([
    registration('campaign-runtime', (database) =>
      database.exec(
        'CREATE TABLE IF NOT EXISTS campaign_runtime (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
      )
    ),
    registration('party', initializePartySchema, ['campaign-runtime']),
    registration(
      'scene',
      (database) =>
        initializeSceneSchema(
          database,
          new PartyStore(database)
            .read()
            .members.filter((member) => member.active)
            .map((member) => member.id)
        ),
      ['party']
    ),
    registration('combat', initializeCombatSchema, ['scene']),
    registration('world-locations', initializeWorldLocationSchema),
    registration('encounter-tables', initializeEncounterTableSchema),
    registration('world-factions', initializeWorldFactionSchema),
    registration('world-npcs', initializeWorldNpcSchema, [
      'world-locations',
      'world-factions'
    ]),
    registration('hex', initializeHexSchema, ['world-locations']),
    registration(
      'world-location-save-journal',
      initializeWorldLocationSaveJournalSchema,
      ['world-locations']
    ),
    registration('campaign-rules', initializeCampaignRulesSchema),
    registration('session-generation', initializeSessionGenerationSchema),
    registration('encounter-plans', initializeEncounterPlanSchema),
    registration('session-planner', initializeSessionPlannerSchema),
    registration('legacy-items', initializeLegacyItemDefinitionSchema),
    registration('loot', initializeLootSchema, ['legacy-items']),
    registration('character-loot', initializeCharacterLootSchema, ['loot']),
    registration('campaign-import', initializeCampaignImportSchema, [
      'party',
      'world-locations',
      'world-factions',
      'world-npcs'
    ]),
    registration('schema-metadata', initializeCampaignSchemaMetadata, [
      'campaign-import',
      'character-loot',
      'session-planner'
    ]),
    registration(
      'schema-version',
      (database) => initializeSchemaVersion(database, 'campaign'),
      ['schema-metadata']
    )
  ])
}

function registration(
  name: string,
  initialize: (database: Database.Database) => void,
  after: readonly string[] = []
): CampaignSchemaRegistration {
  return { name, initialize, after }
}

function orderRegistrations(
  registrations: readonly CampaignSchemaRegistration[]
): readonly CampaignSchemaRegistration[] {
  const byName = new Map<string, CampaignSchemaRegistration>()
  for (const registration of registrations) {
    if (!/^[a-z][a-z0-9-]+$/.test(registration.name))
      throw new Error(
        `Invalid campaign schema registration: ${registration.name}`
      )
    if (byName.has(registration.name))
      throw new Error(
        `Duplicate campaign schema registration: ${registration.name}`
      )
    byName.set(registration.name, registration)
  }
  for (const registration of registrations)
    for (const dependency of registration.after ?? [])
      if (!byName.has(dependency))
        throw new Error(
          `Missing campaign schema registration ${dependency} required by ${registration.name}`
        )

  const ordered: CampaignSchemaRegistration[] = []
  const pending = new Set(byName.keys())
  while (pending.size > 0) {
    const ready = [...pending]
      .filter((name) =>
        (byName.get(name)?.after ?? []).every((dependency) =>
          ordered.some((entry) => entry.name === dependency)
        )
      )
      .sort()
    if (ready.length === 0)
      throw new Error(
        `Cyclic campaign schema registrations: ${[...pending].sort().join(', ')}`
      )
    for (const name of ready) {
      ordered.push(byName.get(name)!)
      pending.delete(name)
    }
  }
  return Object.freeze(ordered)
}
