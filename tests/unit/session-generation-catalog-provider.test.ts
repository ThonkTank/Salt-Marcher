import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
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
