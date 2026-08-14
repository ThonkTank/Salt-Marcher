import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BundledEncounterCatalogProvider,
  BundledSessionGenerationCatalogRegistry
} from '../../src/utility/session-generation/catalog-provider.js'
import { parseFullSessionGenerationCatalog } from '../../src/core/session-generation/loot-catalog.js'

const catalogRoot = join(
  process.cwd(),
  'resources/sessiongeneration/catalog-2026-07-16'
)
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('bundled encounter catalog provider', () => {
  it('loads and deeply freezes the verified snapshot', () => {
    const catalog = new BundledEncounterCatalogProvider(catalogRoot).load()
    expect(catalog.catalogVersion).toBe('catalog-2026-07-16')
    expect(catalog.progression).toHaveLength(20)
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.progression[0])).toBe(true)
    expect(Object.isFrozen(catalog.patterns[0]?.roles)).toBe(true)
  })

  it('rejects a changed manifest-listed table', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-catalog-'))
    temporaryRoots.push(root)
    cpSync(catalogRoot, root, { recursive: true })
    writeFileSync(join(root, 'DB_CR.tsv'), 'corrupted\n', 'utf8')

    expect(() => new BundledEncounterCatalogProvider(root).load()).toThrow(
      'Catalog table shape mismatch'
    )
  })

  it('verifies and parses all sixteen source-backed catalog tables', () => {
    const provider = new BundledEncounterCatalogProvider(catalogRoot)
    const full = provider.loadFull()
    const manifest = JSON.parse(
      readFileSync(join(catalogRoot, 'manifest.json'), 'utf8')
    ) as { tables: Array<{ file: string }> }

    expect(manifest.tables).toHaveLength(16)
    expect(full.progression).toHaveLength(20)
    expect(full.items).toHaveLength(681)
    expect(full.magicItems).toHaveLength(552)
    expect(Object.isFrozen(full)).toBe(true)
    expect(Object.isFrozen(full.curses[0])).toBe(true)
  })

  it('fails closed for orphaned active relations and invalid active flags', () => {
    const encounter = new BundledEncounterCatalogProvider(catalogRoot).load()
    const manifest = JSON.parse(
      readFileSync(join(catalogRoot, 'manifest.json'), 'utf8')
    ) as { tables: Array<{ file: string }> }
    const tables = Object.fromEntries(
      manifest.tables.map(({ file }) => [
        file,
        readFileSync(join(catalogRoot, file), 'utf8')
      ])
    )
    const orphaned = {
      ...tables,
      'DB_LootRelations.tsv': tables['DB_LootRelations.tsv']!.replace(
        'ITEM_CONTAINER\titem:object:abacus\tcontainer:pouch',
        'ITEM_CONTAINER\titem:object:abacus\tcontainer:missing'
      )
    }
    expect(() =>
      parseFullSessionGenerationCatalog(encounter, orphaned)
    ).toThrow('catalog_reference_missing:item_container')

    const invalidActive = {
      ...tables,
      'DB_Themes.tsv': tables['DB_Themes.tsv']!.replace('\ttrue\t', '\tmaybe\t')
    }
    expect(() =>
      parseFullSessionGenerationCatalog(encounter, invalidActive)
    ).toThrow('catalog_schema_invalid')
  })
})

describe('bundled session-generation catalog registry', () => {
  it('resolves immutable current and historical artifacts by version and hash', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-registry-'))
    temporaryRoots.push(root)
    const oldDirectory = 'catalog-old'
    const nextDirectory = 'catalog-next'
    cpSync(catalogRoot, join(root, oldDirectory), { recursive: true })
    cpSync(catalogRoot, join(root, nextDirectory), { recursive: true })
    const oldManifest = JSON.parse(
      readFileSync(join(root, oldDirectory, 'manifest.json'), 'utf8')
    ) as CatalogManifest
    const nextManifest = createDistinctManifest(
      join(root, nextDirectory),
      oldManifest,
      nextDirectory
    )
    writeFileSync(
      join(root, 'registry.json'),
      JSON.stringify({
        schemaVersion: 1,
        currentCatalogVersion: nextDirectory,
        catalogs: [
          {
            directory: oldDirectory,
            catalogVersion: oldManifest.catalogVersion,
            catalogContentHash: oldManifest.catalogContentHash
          },
          {
            directory: nextDirectory,
            catalogVersion: nextManifest.catalogVersion,
            catalogContentHash: nextManifest.catalogContentHash
          }
        ]
      })
    )

    const registry = new BundledSessionGenerationCatalogRegistry(root)
    expect(registry.currentReference()).toEqual({
      catalogVersion: nextDirectory,
      catalogContentHash: nextManifest.catalogContentHash
    })
    expect(
      registry
        .require({
          catalogVersion: oldManifest.catalogVersion,
          catalogContentHash: oldManifest.catalogContentHash
        })
        .identity()
    ).toEqual({
      catalogVersion: oldManifest.catalogVersion,
      catalogContentHash: oldManifest.catalogContentHash
    })
    expect(() =>
      registry.require({
        catalogVersion: 'catalog-missing',
        catalogContentHash: '0'.repeat(64)
      })
    ).toThrow('Catalog is not registered')
  })
})

type CatalogManifest = {
  catalogVersion: string
  catalogContentHash: string
  tables: Array<{ file: string; rows: number; columns: number; sha256: string }>
  [key: string]: unknown
}

function createDistinctManifest(
  root: string,
  source: CatalogManifest,
  catalogVersion: string
): CatalogManifest {
  const table = source.tables[0]!
  const tablePath = join(root, table.file)
  const content = `${readFileSync(tablePath, 'utf8')}\n`
  writeFileSync(tablePath, content)
  const tables = source.tables.map((entry) =>
    entry.file === table.file
      ? { ...entry, sha256: createHash('sha256').update(content).digest('hex') }
      : entry
  )
  const canonical = [...tables]
    .sort((left, right) =>
      left.file < right.file ? -1 : left.file > right.file ? 1 : 0
    )
    .map(
      (entry) =>
        `${entry.file}\t${entry.rows}\t${entry.columns}\t${entry.sha256}\n`
    )
    .join('')
  const manifest = {
    ...source,
    catalogVersion,
    catalogContentHash: createHash('sha256').update(canonical).digest('hex'),
    tables
  }
  writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2))
  return manifest
}
