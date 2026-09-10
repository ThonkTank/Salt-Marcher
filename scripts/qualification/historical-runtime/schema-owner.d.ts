declare module '@historical/schema-owner' {
  export const databaseSchemaVersions: Readonly<{
    installation: number
    campaign: number
  }>
}

declare module '@historical/campaign-store' {
  export const CampaignStore: typeof import('../../../src/core/persistence/sqlite/campaign-store.js').CampaignStore
}
declare module '@historical/party-store' {
  export const PartyStore: typeof import('../../../src/core/party/party-store.js').PartyStore
}
declare module '@historical/preflight' {
  export const preflightPersistence: typeof import('../../../src/core/persistence/sqlite/persistence-preflight.js').preflightPersistence
}
declare module '@historical/migrations' {
  export const applySchemaMigrations: typeof import('../../../src/core/persistence/sqlite/schema-migrations.js').applySchemaMigrations
}
declare module '@historical/live-play' {
  export const LivePlayService: typeof import('../../../src/core/encounter/live-combat.js').LivePlayService
}
declare module '@historical/database-access' {
  export const fixedSqliteDatabaseAccess: typeof import('../../../src/core/persistence/sqlite/database-access.js').fixedSqliteDatabaseAccess
}
declare module '@historical/locations' {
  export const WorldLocationStore: typeof import('../../../src/core/worldplanner/location-store.js').WorldLocationStore
}

declare module '@historical/tables' {
  export const EncounterTableStore: typeof import('../../../src/core/encounter/encounter-table-store.js').EncounterTableStore
}

declare module '@historical/factions' {
  export const WorldFactionStore: typeof import('../../../src/core/worldplanner/faction-store.js').WorldFactionStore
}

declare module '@historical/npc-service' {
  export const WorldNpcApplicationService: typeof import('../../../src/core/application/world-npc-application-service.js').WorldNpcApplicationService
}

declare module '@historical/creatures' {
  export const creatureById: typeof import('../../../src/core/creatures/catalog.js').creatureById
}

declare module '@historical/hex-maps' {
  export const HexMapStore: typeof import('../../../src/core/hex/hex-map-store.js').HexMapStore
}

declare module '@historical/hex-travel' {
  export const HexTravelService: typeof import('../../../src/core/hex/hex-travel.js').HexTravelService
}

declare module '@qualification/profile' {
  export const seedHistoricalProfile: typeof import('./profile.js').seedHistoricalProfile
  export const readHistoricalProfile: typeof import('./profile.js').readHistoricalProfile
  export const migrateHistoricalProfile: typeof import('./profile.js').migrateHistoricalProfile
  export const advanceHistoricalProfile: typeof import('./profile.js').advanceHistoricalProfile
  export const finishCombatAndTravelHistoricalProfile: typeof import('./profile.js').finishCombatAndTravelHistoricalProfile
}

declare module '@historical/loot-service' {
  /** Narrow protocol shared by the original schema-30 and schema-31 services. */
  export class LootService {
    constructor(database: () => import('better-sqlite3').Database)
    create(input: unknown): unknown
    read(id: string): unknown
    acceptGenerated(input: unknown): unknown
    distribute(input: unknown): unknown
    ledger(characterId: string): unknown
  }
}

declare module '@historical/legacy-campaign-store' {
  type CurrentStore =
    import('../../../src/core/persistence/sqlite/campaign-store.js').CampaignStore
  type LegacyStore = Pick<
    CurrentStore,
    | 'create'
    | 'readSettings'
    | 'updateSettings'
    | 'list'
    | 'close'
    | 'visitCampaignDatabases'
  >
  export const CampaignStore: new (directory: string) => LegacyStore
}

declare module '@historical/legacy-generation' {
  export class SessionGenerationService {
    constructor(
      catalog: unknown,
      entropy: unknown,
      preset: undefined,
      database: () => import('better-sqlite3').Database,
      clock: () => Date
    )
    generate(input: unknown): unknown
  }
}
declare module '@historical/legacy-catalog' {
  export const BundledEncounterCatalogProvider: typeof import('../../../src/utility/session-generation/catalog-provider.js').BundledEncounterCatalogProvider
}
declare module '@historical/legacy-entropy' {
  export const sha256EncounterEntropy: typeof import('../../../src/utility/session-generation/sha256-entropy.js').sha256EncounterEntropy
}
declare module '@historical/legacy-generated-runs' {
  export class GeneratedRunStore {
    constructor(database: import('better-sqlite3').Database)
    read(id: string): unknown
  }
}
