import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  emptyItemDefinitionComponents,
  type ItemReference
} from '../../src/shared/contracts/loot.js'
import { ItemDefinitionResolver } from '../../src/core/loot/item-definition-resolver.js'

export function legacyLootItem(
  db: Database.Database,
  name: string,
  unitValueCp: number,
  stackable = false
): ItemReference {
  const reference = {
    kind: 'legacy' as const,
    definitionId: `test:${randomUUID()}`
  }
  new ItemDefinitionResolver(db, () => {
    throw new Error('Catalog resolver is not used by this test item')
  }).saveLegacy({
    reference,
    name,
    unitValueCp,
    unitCapacity: 1,
    stackable,
    magic: false,
    rarity: null,
    curse: null,
    components: emptyItemDefinitionComponents
  })
  return reference
}
