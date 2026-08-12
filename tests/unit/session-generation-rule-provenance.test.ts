import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const provenance = readFileSync(
  join(
    root,
    'docs/sessiongeneration/contract/contract-generation-rule-provenance.md'
  ),
  'utf8'
)
const manifest = JSON.parse(
  readFileSync(
    join(root, 'resources/sessiongeneration/catalog-2026-07-16/manifest.json'),
    'utf8'
  )
) as {
  catalogVersion: string
  catalogContentHash: string
  tables: Array<{ file: string }>
}

describe('Session Generation rule provenance', () => {
  it('pins the checked catalog version and content hash', () => {
    expect(provenance).toContain(
      `catalog version: \`${manifest.catalogVersion}\``
    )
    expect(provenance).toContain(`\`${manifest.catalogContentHash}\``)
    expect(provenance).toContain('is never read by Runtime or tests')
  })

  it('maps every checked source table to a versioned rule family', () => {
    for (const { file } of manifest.tables)
      expect(provenance, `${file} has no rule provenance`).toContain(
        `\`${file}\``
      )
  })

  it('names table input, owning stage, and evidence for every rule row', () => {
    const rows = provenance
      .split('\n')
      .filter(
        (line) =>
          line.startsWith('| ') &&
          !line.startsWith('| ---') &&
          !line.startsWith('| Rule family')
      )
    expect(rows.length).toBeGreaterThanOrEqual(16)
    for (const row of rows) {
      const columns = row
        .slice(1, -1)
        .split('|')
        .map((column) => column.trim())
      expect(columns, `incomplete provenance row: ${row}`).toHaveLength(4)
      for (const column of columns)
        expect(column, `empty provenance column: ${row}`).not.toBe('')
    }
  })
})
