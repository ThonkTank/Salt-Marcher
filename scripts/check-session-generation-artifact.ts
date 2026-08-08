import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  catalogManifestSchema,
  expectedCatalogHeaders,
  parseEncounterCatalog
} from '../src/core/session-generation/catalog.js'

const root = resolve('resources/sessiongeneration/catalog-2026-07-16')
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

parseEncounterCatalog({
  manifest,
  tables: {
    progression: required(contents, 'DB_Progression.tsv'),
    challengeRatings: required(contents, 'DB_CR.tsv'),
    roleBands: required(contents, 'DB_EncounterRoleBands.tsv'),
    patterns: required(contents, 'DB_EncounterPatterns.tsv')
  }
})

console.log(
  `Session-generation catalog ${manifest.catalogVersion} verified (${manifest.tables.length} tables, ${manifest.catalogContentHash}).`
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
