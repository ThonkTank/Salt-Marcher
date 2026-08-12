import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  catalogManifestSchema,
  expectedCatalogHeaders,
  parseEncounterCatalog
} from '../src/core/session-generation/catalog.js'
import { sessionGenerationCatalogRegistrySchema } from '../src/core/session-generation/catalog-registry.js'
import { BundledEncounterCatalogProvider } from '../src/utility/session-generation/catalog-provider.js'
import { generatorChallengeRatings } from '../src/shared/generator/generator-config-model.js'
import {
  defaultGeneratorConfig,
  systemGeneratorPresetSource
} from '../src/shared/generator/system-generator-preset.js'

const registryRoot = resolve('resources/sessiongeneration')
const registry = sessionGenerationCatalogRegistrySchema.parse(
  JSON.parse(readFileSync(join(registryRoot, 'registry.json'), 'utf8'))
)
const registeredDirectories = registry.catalogs
  .map((entry) => entry.directory)
  .toSorted(compareText)
const artifactDirectories = readdirSync(registryRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('catalog-'))
  .map((entry) => entry.name)
  .toSorted(compareText)
if (
  JSON.stringify(registeredDirectories) !== JSON.stringify(artifactDirectories)
)
  throw new Error('Catalog directories and registry entries differ.')
for (const entry of registry.catalogs) {
  const identity = new BundledEncounterCatalogProvider(
    join(registryRoot, entry.directory)
  )
  expectCatalogIdentity(identity.identity(), entry)
  identity.loadFull()
}
const currentEntry = registry.catalogs.find(
  (entry) => entry.catalogVersion === registry.currentCatalogVersion
)!
const root = join(registryRoot, currentEntry.directory)
const manifest = catalogManifestSchema.parse(
  JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
)
const expectedFiles = Object.keys(expectedCatalogHeaders)
const manifestFiles = manifest.tables.map((entry) => entry.file)
if (
  manifestFiles.length !== expectedFiles.length ||
  new Set(manifestFiles).size !== manifestFiles.length ||
  expectedFiles.some((file) => !manifestFiles.includes(file))
)
  throw new Error('Catalog manifest table set is invalid.')
const contents = new Map<string, string>()

for (const entry of manifest.tables) {
  const content = readFileSync(join(root, entry.file), 'utf8')
  const lines = content.replace(/\r/g, '').trimEnd().split('\n')
  const columns = lines[0]?.split('\t').length ?? 0
  const rows = Math.max(0, lines.length - 1)
  const header = lines[0]?.split('\t') ?? []
  const expectedHeader = expectedCatalogHeaders[entry.file]
  if (
    expectedHeader === undefined ||
    columns !== entry.columns ||
    rows !== entry.rows ||
    header.length !== expectedHeader.length ||
    header.some((value, index) => value !== expectedHeader[index])
  )
    throw new Error(`Catalog shape mismatch: ${entry.file}`)
  const hash = createHash('sha256').update(content).digest('hex')
  if (hash !== entry.sha256)
    throw new Error(`Catalog table hash mismatch: ${entry.file}`)
  contents.set(entry.file, content)
}

const canonical = [...manifest.tables]
  .sort((left, right) => compareText(left.file, right.file))
  .map(
    (entry) =>
      `${entry.file}\t${entry.rows}\t${entry.columns}\t${entry.sha256}\n`
  )
  .join('')
const contentHash = createHash('sha256').update(canonical).digest('hex')
if (contentHash !== manifest.catalogContentHash)
  throw new Error(
    `Catalog content hash mismatch: expected ${manifest.catalogContentHash}, received ${contentHash}`
  )

const catalog = parseEncounterCatalog({
  manifest,
  tables: {
    progression: required(contents, 'DB_Progression.tsv'),
    challengeRatings: required(contents, 'DB_CR.tsv'),
    roleBands: required(contents, 'DB_EncounterRoleBands.tsv'),
    patterns: required(contents, 'DB_EncounterPatterns.tsv')
  }
})

const roleBandEntry = manifest.tables.find(
  (entry) => entry.file === 'DB_EncounterRoleBands.tsv'
)
const patternEntry = manifest.tables.find(
  (entry) => entry.file === 'DB_EncounterPatterns.tsv'
)
if (
  systemGeneratorPresetSource.catalogVersion !== manifest.catalogVersion ||
  systemGeneratorPresetSource.roleBandsSha256 !== roleBandEntry?.sha256 ||
  systemGeneratorPresetSource.patternsSha256 !== patternEntry?.sha256
)
  throw new Error(
    'Generated system-preset source metadata does not match the pinned catalog.'
  )

const crById = new Map(
  catalog.challengeRatings.map((rating) => [rating.id, rating.label])
)
const generatedRoleMatrix = Array.from({ length: 20 }, (_, level) =>
  generatorChallengeRatings.map((rating) => {
    const band = catalog.roleBands.find(
      (entry) =>
        entry.active &&
        entry.partyLevel === level + 1 &&
        crById.get(entry.crId) === rating
    )
    return band?.role.toLowerCase()
  })
)
const generatedRoleCombinations = catalog.patterns
  .filter((pattern) => pattern.active)
  .map((pattern) => pattern.roles.map((role) => role.toLowerCase()))

if (
  JSON.stringify(defaultGeneratorConfig.composition.roleMatrix) !==
    JSON.stringify(generatedRoleMatrix) ||
  JSON.stringify(defaultGeneratorConfig.composition.roleCombinations) !==
    JSON.stringify(generatedRoleCombinations)
)
  throw new Error(
    'Generated system preset differs from DB_EncounterRoleBands.tsv or DB_EncounterPatterns.tsv.'
  )

console.log(
  `Session-generation catalog ${manifest.catalogVersion} and generated system preset verified (${manifest.tables.length} tables, ${manifest.catalogContentHash}).`
)

function required(contents: ReadonlyMap<string, string>, file: string): string {
  const value = contents.get(file)
  if (value === undefined) throw new Error(`Missing catalog table: ${file}`)
  return value
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function expectCatalogIdentity(
  actual: { catalogVersion: string; catalogContentHash: string },
  expected: { catalogVersion: string; catalogContentHash: string }
): void {
  if (
    actual.catalogVersion !== expected.catalogVersion ||
    actual.catalogContentHash !== expected.catalogContentHash
  )
    throw new Error(
      `Catalog registry identity mismatch: ${expected.catalogVersion}`
    )
}
