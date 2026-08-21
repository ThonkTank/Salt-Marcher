import { describe, expect, it } from 'vitest'
import {
  hasCall,
  readTypeScriptModule,
  type TypeScriptModule
} from '../architecture/support/typescript-module.js'

describe('world NPC persistence ownership', () => {
  it('keeps query, command, receipt, and schema responsibilities separate', () => {
    const facade = source('npc-store.ts')
    const query = source('world-npc-query-repository.ts')
    const command = source('world-npc-command-repository.ts')
    const receipts = source('world-npc-receipt-repository.ts')
    const schema = source('world-npc-schema.ts')

    expect(sqlText(facade)).toBe('')
    expect(sqlText(query)).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/)
    expect(hasCall(command, 'detailProjection')).toBe(false)
    expect(hasCall(command, 'transaction')).toBe(true)
    expect(receipts.identifiers.has('WORLD_NPC_RECEIPT_RETENTION_LIMIT')).toBe(
      true
    )
    expect(sqlText(schema)).toContain(
      'CREATE TABLE IF NOT EXISTS worldplanner_npc'
    )
    expect(schema.identifiers.has('migrateWorldNpcSchema32To33')).toBe(true)
  })
})

function source(name: string): TypeScriptModule {
  return readTypeScriptModule(`src/core/worldplanner/${name}`)
}

function sqlText(module: TypeScriptModule): string {
  return module.stringLiterals
    .filter((value) =>
      /(?:\bSELECT\b[\s\S]*\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+[a-z_]|\bDELETE\s+FROM\b|\bCREATE\s+TABLE\b)/i.test(
        value
      )
    )
    .join('\n')
}
