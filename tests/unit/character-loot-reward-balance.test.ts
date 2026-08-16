import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  CharacterLootStore,
  initializeCharacterLootSchema
} from '../../src/core/loot/character-loot-store.js'
import {
  initializeLegacyItemDefinitionSchema,
  ItemDefinitionResolver
} from '../../src/core/loot/item-definition-resolver.js'
import type { ItemDefinition } from '../../src/shared/contracts/loot.js'

const characterId = '018f47db-e17a-7000-8000-000000000001'

describe('character loot reward balance', () => {
  it('counts all effective grants by referenced definition despite disposal and correction', () => {
    const db = new Database(':memory:')
    initializeLegacyItemDefinitionSchema(db)
    initializeCharacterLootSchema(db)
    const definitions = new ItemDefinitionResolver(db, () => {
      throw new Error('Fixture uses only legacy definitions')
    })
    const nonMagic = definition('legacy:map', 'Handkarte', 250, false, null)
    const magic = definition('legacy:bead', 'Magische Perle', 0, true, 'Common')
    definitions.saveLegacy(nonMagic)
    definitions.saveLegacy(magic)
    const store = new CharacterLootStore(db, definitions)

    const mapAward = store.addAward({
      id: '018f47db-e17a-7000-8000-000000000010',
      commandId: '018f47db-e17a-7000-8000-000000000011',
      characterId,
      treasureId: '018f47db-e17a-7000-8000-000000000012',
      treasureItemId: '018f47db-e17a-7000-8000-000000000013',
      itemReference: nonMagic.reference,
      quantity: 2,
      provenance: {
        kind: 'treasure_distribution',
        treasureLabel: 'Fund',
        recipientName: 'Held'
      },
      rewardProvenance: null,
      receivedAt: '2026-08-16T10:00:00.000Z'
    })
    store.addAward({
      id: '018f47db-e17a-7000-8000-000000000020',
      commandId: '018f47db-e17a-7000-8000-000000000021',
      characterId,
      treasureId: '018f47db-e17a-7000-8000-000000000022',
      treasureItemId: '018f47db-e17a-7000-8000-000000000023',
      itemReference: magic.reference,
      quantity: 1,
      provenance: {
        kind: 'treasure_distribution',
        treasureLabel: 'Fund',
        recipientName: 'Held'
      },
      rewardProvenance: null,
      receivedAt: '2026-08-16T10:01:00.000Z'
    })
    store.bumpRevisions(new Set([characterId]))
    store.correct(
      {
        commandId: '018f47db-e17a-7000-8000-000000000030',
        characterId,
        entryId: mapAward.id,
        expectedRevision: 1,
        quantity: 3,
        status: 'sold',
        reason: 'Menge beim Verkauf berichtigt'
      },
      '2026-08-16T10:02:00.000Z'
    )
    db.prepare(
      `UPDATE character_loot_entry SET status = 'given_away'
        WHERE id = '018f47db-e17a-7000-8000-000000000020'`
    ).run()

    expect(store.rewardBalances([characterId])).toEqual([
      {
        characterId,
        ledgerRevision: 2,
        currentNonMagicCp: 750,
        currentMagic: {
          Common: 1,
          Uncommon: 0,
          Rare: 0,
          'Very Rare': 0,
          Legendary: 0
        }
      }
    ])
    db.close()
  })
})

function definition(
  definitionId: string,
  name: string,
  unitValueCp: number,
  magic: boolean,
  rarity: ItemDefinition['rarity']
): ItemDefinition {
  return {
    reference: { kind: 'legacy', definitionId },
    name,
    unitValueCp,
    unitCapacity: 1,
    stackable: !magic,
    magic,
    rarity,
    curse: null,
    components: {
      baseItemId: null,
      modifierId: null,
      componentId: null,
      magicItemId: null,
      magicVariantId: null,
      spellId: null,
      enspelledRuleId: null,
      curseId: null,
      coinDenominations: []
    }
  }
}
