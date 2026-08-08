import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'

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
})
