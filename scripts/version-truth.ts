import { readFileSync } from 'node:fs'
import {
  databaseSchemaVersions,
  type DatabaseRole
} from '../src/core/persistence/sqlite/database.js'
import {
  migrationRegistryVersion,
  resolveSchemaMigrationPath,
  schemaMigrations
} from '../src/core/persistence/sqlite/schema-migrations.js'
import {
  REWARD_ENGINE_VERSION,
  SESSION_ENCOUNTER_ENGINE_VERSION,
  rewardEngineVersionSchema
} from '../src/shared/contracts/session-generation.js'
import { generatorPresetSchemaVersion } from '../src/shared/contracts/generator-presets.js'

type CatalogRegistry = Readonly<{
  currentCatalogVersion: string
  catalogs: readonly Readonly<{
    catalogVersion: string
    catalogContentHash: string
  }>[]
}>

export type VersionTruth = ReturnType<typeof readVersionTruth>

export function readVersionTruth(): Readonly<{
  schemas: ReadonlyArray<{
    role: DatabaseRole
    current: number
    path: string
    owner: string
  }>
  migrationRegistryVersion: number
  encounterEngineVersion: string
  rewardEngineVersion: string
  readableRewardEngineVersions: readonly string[]
  generatorConfigVersion: number
  catalogVersion: string
  catalogContentHash: string
}> {
  const registry = JSON.parse(
    readFileSync('resources/sessiongeneration/registry.json', 'utf8')
  ) as CatalogRegistry
  const currentCatalog = registry.catalogs.find(
    (entry) => entry.catalogVersion === registry.currentCatalogVersion
  )
  if (!currentCatalog)
    throw new Error('Current session-generation catalog is not registered.')
  const roles = ['installation', 'campaign'] as const
  return {
    schemas: roles.map((role) => {
      const migrations = schemaMigrations.filter(
        (migration) => migration.role === role
      )
      const start = Math.min(
        ...migrations.map((migration) => migration.fromVersion)
      )
      const path = resolveSchemaMigrationPath(
        role,
        start,
        databaseSchemaVersions[role]
      )
      if (!path)
        throw new Error(`No complete ${role} schema path reaches current.`)
      return {
        role,
        current: databaseSchemaVersions[role],
        path: [start, ...path.map((migration) => migration.toVersion)].join(
          ' -> '
        ),
        owner: `${role}-schema-migrations.ts`
      }
    }),
    migrationRegistryVersion,
    encounterEngineVersion: SESSION_ENCOUNTER_ENGINE_VERSION,
    rewardEngineVersion: REWARD_ENGINE_VERSION,
    readableRewardEngineVersions: rewardEngineVersionSchema.options,
    generatorConfigVersion: generatorPresetSchemaVersion,
    catalogVersion: currentCatalog.catalogVersion,
    catalogContentHash: currentCatalog.catalogContentHash
  }
}

export function renderVersionTruth(truth: VersionTruth): string {
  const schemaRows = truth.schemas
    .map(
      (entry) =>
        `| ${entry.role} | ${entry.current} | \`${entry.path}\` | \`${entry.owner}\` |`
    )
    .join('\n')
  return `# Version truth

This file is checked against executable registries by \`pnpm check:version-truth\`.
Edit the owning registry or constant first; documentation drift fails the
canonical check.

## Persistence

| Role | Current schema | Complete forward path | Migration owner |
| --- | ---: | --- | --- |
${schemaRows}

Migration registry contract: **${truth.migrationRegistryVersion}**.

## Generation

| Dimension | Current | Canonical owner |
| --- | --- | --- |
| Encounter engine | \`${truth.encounterEngineVersion}\` | \`session-generation.ts\` |
| Reward engine | \`${truth.rewardEngineVersion}\` | \`session-generation.ts\` |
| Generator config | \`Config V${truth.generatorConfigVersion}\` | \`generator-presets.ts\` |
| Session-generation catalog | \`${truth.catalogVersion}\` | \`resources/sessiongeneration/registry.json\` |
| Catalog content hash | \`${truth.catalogContentHash}\` | current catalog manifest |

Persisted reward runs remain readable for: ${truth.readableRewardEngineVersions
    .map((version) => `\`${version}\``)
    .join(', ')}. Commands
and newly generated runs require the current Reward engine version. Unknown
versions fail contract validation; saved concrete runs,
not an old engine implementation, remain replay authority.
`
}

export function assertVersionTruthDocument(
  actual: string,
  truth: VersionTruth
): void {
  const expected = renderVersionTruth(truth)
  if (actual !== expected)
    throw new Error(
      'docs/project/architecture/version-truth.md differs from executable version registries.'
    )
}
