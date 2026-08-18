import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('world NPC persistence ownership', () => {
  it('keeps query, command, receipt, and schema responsibilities separate', () => {
    const facade = source('npc-store.ts')
    const query = source('world-npc-query-repository.ts')
    const command = source('world-npc-command-repository.ts')
    const receipts = source('world-npc-receipt-repository.ts')
    const schema = source('world-npc-schema.ts')

    expect(facade).not.toMatch(/\b(?:SELECT|INSERT|UPDATE|DELETE)\b/)
    expect(query).not.toMatch(
      /\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|FROM|worldplanner)/
    )
    expect(command).not.toContain('detailProjection(')
    expect(command).toContain('.transaction(')
    expect(receipts).toContain('WORLD_NPC_RECEIPT_RETENTION_LIMIT')
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS worldplanner_npc')
    expect(schema).toContain('migrateWorldNpcSchema32To33')
  })
})

function source(name: string): string {
  return readFileSync(`src/core/worldplanner/${name}`, 'utf8')
}
