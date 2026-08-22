import { readFileSync } from 'node:fs'
import { normalize, resolve, sep } from 'node:path'
import { expect } from 'vitest'
import { campaignPersistenceBoundaryViolations } from '../../scripts/architecture/campaign-persistence-boundary.js'
import {
  hexChunkReadResultSchema,
  readHexChunksInputSchema
} from '../../src/shared/contracts/hex.js'
import {
  HEX_CHUNK_SIZE,
  MAX_HEX_BRUSH_RADIUS,
  hexChunkKeyFor
} from '../../src/shared/hex/axial-geometry.js'
import { architectureGate } from './support/architecture-gate.js'
import {
  codeFiles,
  hasCall,
  hasImport,
  readTypeScriptModule,
  scope,
  type TypeScriptModule
} from './support/typescript-module.js'

architectureGate(
  'typed-contract',
  'versions every current installation-preference read and write',
  () => {
    const contract = readTypeScriptModule('src/shared/contracts/settings.ts')
    expect(
      contract.declarations.has('persistedInstallationPreferencesSchema')
    ).toBe(true)

    const store = readTypeScriptModule(
      'src/core/persistence/sqlite/installation-settings-store.ts'
    )
    expect(hasCall(store, 'persistedInstallationPreferencesSchema.parse')).toBe(
      true
    )
    expect(hasCall(store, 'persistedInstallationPreferences')).toBe(true)

    const owner = readTypeScriptModule(
      'src/core/persistence/sqlite/installation-database-owner.ts'
    )
    expect(hasCall(owner, 'persistedInstallationPreferences')).toBe(true)

    const migrations = readTypeScriptModule(
      'src/core/persistence/sqlite/installation-schema-migrations.ts'
    )
    const wrapper = scope(migrations, 'wrapStoredInstallationPreferences')
    expect(wrapper?.calls).toContain('persistedInstallationPreferences')
    expect(wrapper?.calls).toContain('installationPreferencesSchema.parse')
    expect(migrations.stringLiterals).toContain(
      'installation-36-to-37-preferences-envelope-v1'
    )
  }
)

architectureGate(
  'import-dependency-boundary',
  'exposes campaign persistence through scoped ports instead of raw locators',
  () => {
    const sources = Object.fromEntries(
      codeFiles('src').map((path) => [path, readFileSync(path, 'utf8')])
    )
    expect(campaignPersistenceBoundaryViolations(sources)).toEqual([])
    expect(
      campaignPersistenceBoundaryViolations({
        'src/core/bad-service.ts': `
          class BadStore { activeCampaignDatabase() {} }
          campaigns.installationDatabase()
        `
      }).map(({ name }) => name)
    ).toEqual(['activeCampaignDatabase', 'installationDatabase'])
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps SQL table ownership inside the owning aggregate',
  () => {
    const owners: readonly [RegExp, string][] = [
      [/^hex_/, `${normalize(resolve('src/core/hex'))}${sep}`],
      [/^biome_/, `${normalize(resolve('src/core/biomes'))}${sep}`],
      [
        /^(party_|player_characters$)/,
        `${normalize(resolve('src/core/party'))}${sep}`
      ],
      [/^scene_/, `${normalize(resolve('src/core/scene'))}${sep}`],
      [/^encounter_/, `${normalize(resolve('src/core/encounter'))}${sep}`],
      [/^worldplanner_/, `${normalize(resolve('src/core/worldplanner'))}${sep}`]
    ]
    for (const path of codeFiles('src/core'))
      for (const table of referencedSqlTables(readTypeScriptModule(path))) {
        const owner = owners.find(([pattern]) => pattern.test(table))?.[1]
        if (owner)
          expect(
            normalize(resolve(path)).startsWith(owner),
            `${path} references aggregate-owned table ${table}`
          ).toBe(true)
      }
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps Party rules independent from SQL and public carrier schemas',
  () => {
    const domain = readTypeScriptModule('src/core/party/party-roster-domain.ts')
    expect(domain.imports).toEqual([])
    expect(sqlText(domain)).toBe('')
    for (const rule of [
      'applyXpAdjustment',
      'applyRest',
      'positionPartyAtHex',
      'clearPartyHexPosition',
      'adventuringDay'
    ])
      expect(domain.exportedDeclarations).toContain(rule)
    expect(
      readTypeScriptModule('src/core/party/party-store.ts').identifiers.has(
        'mapPartyCharacterRow'
      )
    ).toBe(true)
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps NPC ownership and invalidation inside explicit World Planner services',
  () => {
    const encounter = readTypeScriptModule(
      'src/core/application/encounter-source-service.ts'
    )
    expect(
      [...encounter.identifiers].filter((name) =>
        [
          'WorldNpcStore',
          'createNpc',
          'updateNpc',
          'deleteNpc',
          'readNpcs'
        ].includes(name)
      )
    ).toEqual([])
    const store = readTypeScriptModule('src/core/worldplanner/npc-store.ts')
    expect(hasImport(store, '../creatures/catalog.js')).toBe(false)
    expect(store.identifiers.has('CreatureReferenceResolver')).toBe(true)
    const schema = sqlText(
      readTypeScriptModule('src/core/worldplanner/world-npc-schema.ts')
    )
    expect(schema).toContain(
      'REFERENCES worldplanner_location(id) ON DELETE SET NULL'
    )
    expect(schema).toContain(
      'REFERENCES worldplanner_faction(id) ON DELETE CASCADE'
    )
    const operations = readTypeScriptModule(
      'src/shared/contracts/operations/npcs.ts'
    )
    expect(operations.stringLiterals).toContain('npcs.search')
    expect(operations.stringLiterals).toContain('npcs.detail')
    expect(operations.stringLiterals).not.toContain('npcs.read')
    const queries = readTypeScriptModule(
      'src/core/worldplanner/world-npc-query-repository.ts'
    )
    for (const field of [
      'creatureDisplayName',
      'factionDisplayName',
      'locationDisplayName'
    ])
      expect(queries.identifiers.has(field)).toBe(true)
    const utility = readTypeScriptModule('src/utility/application.ts')
    expect(utility.constructions).toContain('ReferenceChangeCoordinator')
    expect(utility.identifiers.has('referenceSnapshot')).toBe(false)
  }
)

architectureGate(
  'import-dependency-boundary',
  'composes owner-focused Loot handlers only at the Utility composition root',
  () => {
    const root = readTypeScriptModule('src/core/application/loot-service.ts')
    for (const component of [
      'TreasureStore',
      'LootProjectionStore',
      'LootOperationJournal',
      'LootCommandHandler',
      'DistributeLootCommandHandler',
      'CharacterLootService',
      'LootQueryService'
    ])
      expect(root.constructions).toContain(component)

    for (const path of [
      'src/core/application/loot-command-handler.ts',
      'src/core/application/distribute-loot-command-handler.ts',
      'src/core/application/group-reward-command-handler.ts',
      'src/core/application/group-reward-commit-handler.ts',
      'src/core/application/character-loot-service.ts',
      'src/core/application/loot-query-service.ts'
    ]) {
      const module = readTypeScriptModule(path)
      expect(
        module.constructions.filter((name) => name.endsWith('Store')),
        path
      ).toEqual([])
      expect(
        module.imports.filter(
          ({ specifier }) => specifier === 'better-sqlite3'
        ),
        path
      ).toEqual([])
      expect(sqlText(module), `${path} contains SQL`).toBe('')
    }
    for (const path of [
      'src/core/loot/loot-store.ts',
      'src/core/loot/character-loot-store.ts'
    ]) {
      const module = readTypeScriptModule(path)
      expect(module.identifiers.has('LootOperationJournal')).toBe(false)
      expect(module.identifiers.has('fingerprintExcluding')).toBe(false)
    }
    const combat = readTypeScriptModule('src/core/encounter/combat-service.ts')
    expect(combat.identifiers.has('GroupTreasureReader')).toBe(true)
    expect(combat.identifiers.has('TreasureStore')).toBe(false)
    expect(
      hasCall(
        readTypeScriptModule('src/utility/application.ts'),
        'createLootComposition'
      )
    ).toBe(true)
    const composition = readTypeScriptModule('src/utility/composition/loot.ts')
    expect(composition.constructions).toEqual(
      expect.arrayContaining([
        'GroupRewardCommandHandler',
        'GroupRewardCommitHandler'
      ])
    )
  }
)

architectureGate(
  'import-dependency-boundary',
  'opens schemas once and never migrates normal commands',
  () => {
    for (const path of [
      'src/core/scene/scene-store.ts',
      'src/core/encounter/live-combat.ts',
      'src/core/worldplanner/location-store.ts',
      'src/core/encounter/encounter-table-store.ts',
      'src/core/worldplanner/faction-store.ts',
      'src/core/hex/hex-map-store.ts',
      'src/core/hex/hex-travel.ts'
    ]) {
      const module = readTypeScriptModule(path)
      expect(sqlText(module)).not.toContain('ALTER TABLE')
      expect(sqlText(module)).not.toContain('PRAGMA table_info')
      expect(module.constructions).not.toContain('Database')
    }
    const save = readTypeScriptModule(
      'src/core/application/world-location-save.ts'
    )
    expect(hasImport(save, 'better-sqlite3')).toBe(false)
    expect(sqlText(save)).toBe('')
    expect(
      sqlText(
        readTypeScriptModule(
          'src/core/worldplanner/world-location-save-journal.ts'
        )
      )
    ).toContain('worldplanner_location_save_operation')
  }
)

architectureGate(
  'typed-contract',
  'keeps combat persistence as runtime references to owning aggregates',
  () => {
    const repository = readTypeScriptModule(
      'src/core/encounter/combat-repository.ts'
    )
    const sql = sqlText(repository)
    const combatants = sqlStatement(sql, 'encounter_combatants')
    expect(combatants).not.toContain('current_hp')
    expect(combatants).not.toContain('armor_class')
    expect(combatants).not.toContain('creature_id')
    expect(sql).not.toContain('threshold_fraction')
    expect(sql).not.toContain('member_ids TEXT')
  }
)

architectureGate(
  'import-dependency-boundary',
  'isolates combat SQL and memento serialization in its repository',
  () => {
    const repository = readTypeScriptModule(
      'src/core/encounter/combat-repository.ts'
    )
    expect(hasCall(repository, 'combatMementoSchema.parse')).toBe(true)
    expect(sqlText(repository)).toContain('encounter_combat_runtime')
    expect(
      readTypeScriptModule('src/core/encounter/combat-state-reducer.ts')
        .exportedDeclarations
    ).toContain('reduceCombatState')
    expect(
      hasCall(
        readTypeScriptModule('src/core/encounter/combat-service.ts'),
        'reduceCombatState'
      )
    ).toBe(true)
    for (const path of [
      'src/core/encounter/live-combat.ts',
      'src/core/encounter/combat-service.ts',
      'src/core/encounter/combat-partition-policy.ts'
    ]) {
      const module = readTypeScriptModule(path)
      expect(sqlText(module), path).toBe('')
      expect(
        module.stringLiterals.filter((value) =>
          value.startsWith('encounter_combat_')
        )
      ).toEqual([])
      expect(module.identifiers.has('combatMementoSchema')).toBe(false)
    }
  }
)

architectureGate(
  'behavior-integration',
  'never infers combat partitions or display names from row IDs',
  () => {
    const modules = [
      readTypeScriptModule('src/core/encounter/combat-partition-policy.ts'),
      readTypeScriptModule('src/core/encounter/combat-service.ts'),
      readTypeScriptModule('src/core/encounter/combat-repository.ts')
    ]
    expect(modules[0]!.stringLiterals).toEqual(
      expect.arrayContaining(['mob', 'individual'])
    )
    expect(modules[2]!.propertyAccesses).toContain('row.partitionKind')
    for (const module of modules)
      expect(
        module.calls.filter(
          (call) => call.startsWith('rowId.') || call.endsWith('.rowId')
        )
      ).toEqual([])
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps scene SQL private and routes renderer capabilities through its provider',
  () => {
    expect(
      hasCall(readTypeScriptModule('src/core/scene/scene-store.ts'), 'database')
    ).toBe(false)
    for (const path of codeFiles('src/renderer/features'))
      expect(
        readTypeScriptModule(path).propertyAccesses.filter((entry) =>
          entry.startsWith('window.saltMarcher')
        ),
        path
      ).toEqual([])
  }
)

architectureGate(
  'typed-contract',
  'models unbounded maps as mathematical 32 by 32 chunks',
  () => {
    expect(HEX_CHUNK_SIZE).toBe(32)
    expect(MAX_HEX_BRUSH_RADIUS).toBe(9)
    expect(hexChunkKeyFor({ q: -1, r: 32 })).toEqual({ q: -1, r: 1 })
    const keys = Array.from({ length: 65 }, (_, index) => ({ q: index, r: 0 }))
    expect(
      readHexChunksInputSchema.safeParse({
        mapId: '00000000-0000-4000-8000-000000000001',
        keys
      }).success
    ).toBe(false)
    expect(
      hexChunkReadResultSchema.safeParse({
        map: {},
        chunks: keys,
        biomes: []
      }).success
    ).toBe(false)
  }
)

architectureGate(
  'behavior-integration',
  'keeps Hex routes relational and Party travel state explicit',
  () => {
    const maps = sqlText(readTypeScriptModule('src/core/hex/hex-map-store.ts'))
    const travel = sqlText(readTypeScriptModule('src/core/hex/hex-travel.ts'))
    const party = sqlText(readTypeScriptModule('src/core/party/party-store.ts'))
    expect(maps).toContain('CREATE TABLE IF NOT EXISTS hex_journey_path')
    expect(maps).not.toContain('path_json')
    expect(travel).toContain('JOIN hex_journey_path')
    expect(party).toContain(
      "travel_state IN ('detached', 'attached-unpositioned', 'hex-positioned')"
    )
    expect(party).not.toContain('attached_to_party_token')
    expect(party).not.toContain('travel_tile_id')
  }
)

function sqlText(module: TypeScriptModule): string {
  return module.stringLiterals
    .filter((value) =>
      /(?:\bSELECT\b[\s\S]*\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+[a-z_][a-z0-9_]*\s+SET\b|\bDELETE\s+FROM\b|\bCREATE\s+TABLE\b|\bALTER\s+TABLE\b|\bPRAGMA\s+[a-z_]|\bJOIN\s+[a-z_][a-z0-9_]*|\bREFERENCES\s+[a-z_][a-z0-9_]*)/i.test(
        value
      )
    )
    .join('\n')
}

function referencedSqlTables(module: TypeScriptModule): readonly string[] {
  return [
    ...sqlText(module).matchAll(
      /\b(?:FROM|JOIN|INTO|UPDATE|REFERENCES|DELETE\s+FROM|TABLE(?:\s+IF\s+NOT\s+EXISTS)?)\s+([a-z][a-z0-9_]*)/gi
    )
  ].flatMap((match) => (match[1] ? [match[1].toLowerCase()] : []))
}

function sqlStatement(sql: string, table: string): string {
  return (
    sql
      .split(';')
      .find((statement) =>
        statement.includes(`CREATE TABLE IF NOT EXISTS ${table}`)
      ) ?? ''
  )
}
