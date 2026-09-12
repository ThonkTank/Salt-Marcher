import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  itemDefinitionSchema,
  type ItemDefinition
} from '../../src/shared/contracts/loot.js'

const object = z.record(z.string(), z.unknown())
const generatedItem = z
  .object({
    id: z.string(),
    catalogItemId: z.string().nullable(),
    name: z.string(),
    modifier: z.null(),
    quantity: z.number().positive(),
    capacity: z.number().nonnegative(),
    unitValueCp: z.number().int().nonnegative(),
    stackable: z.boolean(),
    magic: z.literal(false),
    rarity: z.null(),
    curseName: z.null(),
    curseEffect: z.null()
  })
  .passthrough()
const treasure = z
  .object({ id: z.string(), items: z.array(object) })
  .passthrough()
const originalProfile = z
  .object({
    coverage: z.literal('historical-loot-generated-partial-v2'),
    generated: z.object({
      run: z
        .object({
          id: z.string(),
          treasures: z.array(
            z.object({ items: z.array(generatedItem) }).passthrough()
          )
        })
        .passthrough(),
      treasure
    }),
    treasure,
    ledger: z
      .object({
        characterId: z.uuid(),
        revision: z.number().int().nonnegative(),
        entries: z.array(object)
      })
      .passthrough()
  })
  .passthrough()
const emptyComponents = {
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
function omit(original: Record<string, unknown>, fields: string[]) {
  const retained = { ...original }
  for (const field of fields) delete retained[field]
  return retained
}

/** Exact oracle for the frozen nonmagical schema-30 cohort, preserving other fields. */
export function expectedHistoricalGeneratedLoot(raw: unknown) {
  const profile = originalProfile.parse(raw)
  const definitions = new Map<string, ItemDefinition>()
  const run = profile.generated.run
  const treasures = run.treasures.map((entry) => ({
    ...entry,
    items: entry.items.map((item) => {
      const reference = {
        kind: 'generated' as const,
        runId: run.id,
        definitionId: item.id.replace(':item:', ':definition:')
      }
      const definition = itemDefinitionSchema.parse({
        reference,
        name: item.name,
        unitValueCp: item.unitValueCp,
        unitCapacity: item.capacity / item.quantity,
        stackable: item.stackable,
        magic: false,
        rarity: null,
        curse: null,
        components: { ...emptyComponents, baseItemId: item.catalogItemId }
      })
      assert(!definitions.has(item.id), 'Duplicate generated item identity')
      definitions.set(item.id, definition)
      return {
        ...omit(item, [
          'catalogItemId',
          'name',
          'modifier',
          'unitValueCp',
          'totalValueCp',
          'stackable',
          'magic',
          'rarity',
          'curseName',
          'curseEffect',
          'capacity'
        ]),
        itemReference: reference
      }
    })
  }))
  const mutableDefinitions = new Map<string, ItemDefinition>()
  function migratedTreasure(
    original: z.infer<typeof treasure>,
    generated: boolean
  ) {
    return {
      ...original,
      items: original.items.map((item) => {
        const id = z.string().parse(item['id'])
        let definition: ItemDefinition
        if (generated) {
          const provenance = z
            .object({
              kind: z.literal('generator'),
              sourceLineId: z.string(),
              catalogEntry: z
                .object({ kind: z.literal('item'), id: z.string() })
                .nullable()
            })
            .parse(item['provenance'])
          const stored = definitions.get(provenance.sourceLineId)
          assert(
            stored,
            'Accepted item must resolve to the original generated definition'
          )
          if (provenance.catalogEntry)
            assert.equal(
              provenance.catalogEntry.id,
              stored.components.baseItemId
            )
          else assert.equal(stored.components.baseItemId, null)
          definition = stored
        } else {
          z.object({
            magic: z.literal(false),
            rarity: z.null(),
            curseName: z.null()
          }).parse(item)
          definition = itemDefinitionSchema.parse({
            reference: { kind: 'legacy', definitionId: `treasure:${id}` },
            name: item['name'],
            unitValueCp: item['unitValueCp'],
            unitCapacity: 1,
            stackable: item['stackable'],
            magic: false,
            rarity: null,
            curse: null,
            components: emptyComponents
          })
        }
        mutableDefinitions.set(id, definition)
        return {
          ...omit(item, [
            'name',
            'unitValueCp',
            'stackable',
            'magic',
            'rarity',
            'curseName'
          ]),
          ...(generated
            ? {
                provenance: {
                  ...object.parse(item['provenance']),
                  catalogEntry: null
                }
              }
            : {}),
          itemReference: definition.reference,
          definition
        }
      })
    }
  }
  const manual = migratedTreasure(profile.treasure, false)
  const accepted = migratedTreasure(profile.generated.treasure, true)
  return {
    ...profile,
    treasure: manual,
    generated: {
      run: {
        ...run,
        treasures,
        itemDefinitions: [...definitions.values()].sort((a, b) => {
          assert(
            a.reference.kind === 'generated' && b.reference.kind === 'generated'
          )
          return a.reference.definitionId.localeCompare(
            b.reference.definitionId
          )
        })
      },
      treasure: accepted
    },
    ledger: {
      ...profile.ledger,
      entries: profile.ledger.entries.map((entry) => {
        const definition = mutableDefinitions.get(
          z.string().parse(entry['treasureItemId'])
        )
        assert(definition, 'Ledger must reference an existing treasure item')
        assert.equal(entry['itemName'], definition.name)
        assert.equal(entry['unitValueCp'], definition.unitValueCp)
        return {
          ...omit(entry, ['itemName', 'unitValueCp']),
          itemReference: definition.reference,
          definition
        }
      })
    }
  }
}
