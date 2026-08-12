import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  catalogManifestSchema,
  expectedCatalogHeaders,
  parseEncounterCatalog,
  type EncounterCatalog,
  type EncounterCatalogManifest
} from '../../core/session-generation/catalog.js'
import {
  parseFullSessionGenerationCatalog,
  type FullSessionGenerationCatalog
} from '../../core/session-generation/loot-catalog.js'

export class CatalogProviderError extends Error {
  constructor(
    readonly code:
      | 'catalog_unavailable'
      | 'catalog_schema_invalid'
      | 'catalog_hash_mismatch'
      | 'catalog_reference_missing',
    message: string
  ) {
    super(message)
    this.name = 'CatalogProviderError'
  }
}

export class BundledEncounterCatalogProvider {
  #cached: EncounterCatalog | CatalogProviderError | undefined
  #full: FullSessionGenerationCatalog | CatalogProviderError | undefined
  #manifest: EncounterCatalogManifest | undefined
  #tableTexts: ReadonlyMap<string, string> | undefined

  constructor(private readonly root: string) {}

  load(): EncounterCatalog {
    if (this.#cached instanceof CatalogProviderError) throw this.#cached
    if (this.#cached !== undefined) return this.#cached
    try {
      const manifestText = readFileSync(
        join(this.root, 'manifest.json'),
        'utf8'
      )
      const manifest = catalogManifestSchema.parse(JSON.parse(manifestText))
      const expectedFiles = Object.keys(expectedCatalogHeaders)
      const manifestFiles = manifest.tables.map((entry) => entry.file)
      if (
        manifestFiles.length !== expectedFiles.length ||
        new Set(manifestFiles).size !== manifestFiles.length ||
        expectedFiles.some((file) => !manifestFiles.includes(file))
      )
        throw new CatalogProviderError(
          'catalog_schema_invalid',
          'Catalog manifest table set is invalid'
        )
      const tableTexts = new Map<string, string>()
      for (const entry of manifest.tables) {
        const text = readFileSync(join(this.root, entry.file), 'utf8')
        verifyTable(entry, text)
        tableTexts.set(entry.file, text)
      }
      verifyCatalogHash(manifest)
      const catalog = parseEncounterCatalog({
        manifest,
        tables: {
          progression: requiredTable(tableTexts, 'DB_Progression.tsv'),
          challengeRatings: requiredTable(tableTexts, 'DB_CR.tsv'),
          roleBands: requiredTable(tableTexts, 'DB_EncounterRoleBands.tsv'),
          patterns: requiredTable(tableTexts, 'DB_EncounterPatterns.tsv')
        }
      })
      this.#manifest = manifest
      this.#tableTexts = tableTexts
      this.#cached = catalog
      return catalog
    } catch (error) {
      const failure = toCatalogError(error)
      this.#cached = failure
      throw failure
    }
  }

  loadFull(): FullSessionGenerationCatalog {
    if (this.#full instanceof CatalogProviderError) throw this.#full
    if (this.#full !== undefined) return this.#full
    try {
      const encounter = this.load()
      if (!this.#manifest || !this.#tableTexts)
        throw new CatalogProviderError(
          'catalog_unavailable',
          'Verified catalog tables are unavailable'
        )
      const tables = Object.fromEntries(this.#tableTexts)
      const full = parseFullSessionGenerationCatalog(encounter, tables)
      this.#full = full
      return full
    } catch (error) {
      const failure = toCatalogError(error)
      this.#full = failure
      throw failure
    }
  }
}

function verifyTable(
  entry: EncounterCatalogManifest['tables'][number],
  text: string
): void {
  const lines = text.replace(/\r/g, '').trimEnd().split('\n')
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
    throw new CatalogProviderError(
      'catalog_hash_mismatch',
      `Catalog table shape mismatch: ${entry.file}`
    )
  const hash = createHash('sha256').update(text).digest('hex')
  if (hash !== entry.sha256)
    throw new CatalogProviderError(
      'catalog_hash_mismatch',
      `Catalog table hash mismatch: ${entry.file}`
    )
}

function verifyCatalogHash(manifest: EncounterCatalogManifest): void {
  const canonical = [...manifest.tables]
    .sort((left, right) => compareText(left.file, right.file))
    .map(
      (entry) =>
        `${entry.file}\t${entry.rows}\t${entry.columns}\t${entry.sha256}\n`
    )
    .join('')
  const hash = createHash('sha256').update(canonical).digest('hex')
  if (hash !== manifest.catalogContentHash)
    throw new CatalogProviderError(
      'catalog_hash_mismatch',
      'Catalog content hash mismatch'
    )
}

function requiredTable(
  tables: ReadonlyMap<string, string>,
  file: string
): string {
  const table = tables.get(file)
  if (table === undefined)
    throw new CatalogProviderError(
      'catalog_unavailable',
      `Missing catalog table: ${file}`
    )
  return table
}

function toCatalogError(error: unknown): CatalogProviderError {
  if (error instanceof CatalogProviderError) return error
  if (error instanceof SyntaxError)
    return new CatalogProviderError(
      'catalog_schema_invalid',
      'Catalog manifest is invalid'
    )
  if (
    error instanceof Error &&
    error.message.includes('catalog_reference_missing')
  )
    return new CatalogProviderError(
      'catalog_reference_missing',
      `Catalog reference is missing (${error.message})`
    )
  if (
    error instanceof Error &&
    error.message.startsWith('catalog_schema_invalid')
  )
    return new CatalogProviderError(
      'catalog_schema_invalid',
      `Catalog schema is invalid (${error.message})`
    )
  return new CatalogProviderError(
    'catalog_unavailable',
    'Encounter catalog is unavailable'
  )
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
