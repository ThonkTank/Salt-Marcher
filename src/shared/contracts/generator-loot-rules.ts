import { z } from 'zod'

export const lootRarityKeys = [
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary'
] as const

const shareSchema = z.number().min(0).max(1)
const weightSchema = z.number().nonnegative().max(100)
const countSchema = z.number().int().nonnegative().max(1_000_000_000)
const positiveCountSchema = z.number().int().positive().max(1_000_000_000)

const rarityRatesSchema = z
  .object({
    Common: z.number().nonnegative(),
    Uncommon: z.number().nonnegative(),
    Rare: z.number().nonnegative(),
    'Very Rare': z.number().nonnegative(),
    Legendary: z.number().nonnegative()
  })
  .strict()

const progressionRowSchema = z
  .object({
    level: z.number().int().min(1).max(20),
    xpAtLevel: z.number().int().nonnegative(),
    goldAtLevelCp: z.number().int().nonnegative(),
    magicPerXp: rarityRatesSchema
  })
  .strict()

const progressionSchema = z
  .array(progressionRowSchema)
  .length(20)
  .superRefine((rows, context) => {
    rows.forEach((row, index) => {
      if (row.level !== index + 1)
        context.addIssue({
          code: 'custom',
          path: [index, 'level'],
          message: 'Loot progression levels must remain ordered from 1 to 20.'
        })
      if (index > 0 && row.xpAtLevel <= rows[index - 1]!.xpAtLevel)
        context.addIssue({
          code: 'custom',
          path: [index, 'xpAtLevel'],
          message: 'Loot progression XP anchors must be strictly increasing.'
        })
      if (index > 0 && row.goldAtLevelCp < rows[index - 1]!.goldAtLevelCp)
        context.addIssue({
          code: 'custom',
          path: [index, 'goldAtLevelCp'],
          message: 'Loot progression gold anchors must not decrease.'
        })
    })
  })

const weightedSharesSchema = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .strict()
    .refine(
      (value) =>
        Math.abs(
          Object.values(value).reduce(
            (sum: number, part) => sum + Number(part),
            0
          ) - 1
        ) < 1e-9,
      'Shares must total 1.'
    )

const selectionPolicySchema = z
  .object({
    fitWeight: weightSchema,
    themeWeight: weightSchema,
    jitterWeight: weightSchema,
    duplicatePenalty: weightSchema,
    nearBestGap: shareSchema,
    shortlistSize: positiveCountSchema,
    minFit: shareSchema,
    maxOverfit: shareSchema,
    variantShortlistSize: countSchema,
    minBaseExtraCp: countSchema,
    preferredBaseExtraCp: countSchema
  })
  .strict()
  .refine(
    (value) => value.preferredBaseExtraCp >= value.minBaseExtraCp,
    'Preferred base extra must not be below the minimum.'
  )

const denominationSchema = z
  .object({
    valueCp: z.number().int().positive(),
    singularLabel: z.string().trim().min(1).max(100),
    pluralLabel: z.string().trim().min(1).max(100)
  })
  .strict()

const coinProfileSchema = z
  .object({
    denominations: z
      .array(z.enum(['pp', 'gp', 'ep', 'sp', 'cp']))
      .min(2)
      .max(3),
    minLowCount: countSchema,
    maxLowCount: countSchema,
    maxMiddleCount: countSchema,
    maxBudgetCp: positiveCountSchema,
    allowedContainers: z.array(z.string().trim().min(1)).min(1)
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.denominations).size !== value.denominations.length)
      context.addIssue({
        code: 'custom',
        path: ['denominations'],
        message: 'Coin profile denominations must be unique.'
      })
    if (value.minLowCount > value.maxLowCount)
      context.addIssue({
        code: 'custom',
        path: ['minLowCount'],
        message: 'Minimum low coin count must not exceed the maximum.'
      })
  })

export const generatorLootRulesSchema = z
  .object({
    progression: progressionSchema,
    treasure: z
      .object({
        slotMin: positiveCountSchema,
        slotTarget: positiveCountSchema,
        slotMax: positiveCountSchema,
        encounterTreasureRatio: shareSchema,
        treasuresPerAdventureDay: positiveCountSchema,
        treasureCountVariance: countSchema,
        overstockShare: shareSchema,
        channels: weightedSharesSchema({
          quest: shareSchema,
          encounter: shareSchema,
          environment: shareSchema
        }),
        enhancedCapMin: countSchema,
        enhancedCapMax: countSchema,
        enhancedCapMultiplier: z.number().positive().max(100)
      })
      .strict()
      .superRefine((value, context) => {
        if (!(
          value.slotMin <= value.slotTarget && value.slotTarget <= value.slotMax
        ))
          context.addIssue({
            code: 'custom',
            path: ['slotTarget'],
            message: 'Loot slots must remain ordered min, target, max.'
          })
        if (value.enhancedCapMin > value.enhancedCapMax)
          context.addIssue({
            code: 'custom',
            path: ['enhancedCapMin'],
            message: 'Enhanced cap minimum must not exceed its maximum.'
          })
      }),
    mix: z
      .object({
        roles: weightedSharesSchema({
          compactValue: shareSchema,
          complexValue: shareSchema,
          useful: shareSchema,
          flavor: shareSchema
        }),
        compactForms: weightedSharesSchema({
          Coinage: shareSchema,
          Gemstone: shareSchema,
          Ingot: shareSchema
        }),
        complexForms: weightedSharesSchema({
          Bulk_Good: shareSchema,
          Compact_Good: shareSchema,
          Art_Object: shareSchema,
          Adorned: shareSchema,
          Livestock: shareSchema,
          Clothing: shareSchema
        })
      })
      .strict(),
    selection: z
      .object({
        coinage: selectionPolicySchema,
        carrier: selectionPolicySchema,
        adornedBase: selectionPolicySchema,
        adornedModifier: selectionPolicySchema,
        adornedComponent: selectionPolicySchema,
        useful: selectionPolicySchema,
        flavor: selectionPolicySchema
      })
      .strict(),
    quantityLimits: z
      .object({
        carrier: z
          .object({
            quantityGood: positiveCountSchema,
            artObject: positiveCountSchema,
            gemstone: positiveCountSchema,
            ingot: positiveCountSchema,
            tradeGood: positiveCountSchema,
            fallback: positiveCountSchema
          })
          .strict(),
        useful: z
          .object({
            quantityGood: positiveCountSchema,
            ammunition: positiveCountSchema,
            potion: positiveCountSchema,
            poison: positiveCountSchema,
            hazardItem: positiveCountSchema,
            fallback: positiveCountSchema
          })
          .strict(),
        flavor: z
          .object({
            quantityGood: positiveCountSchema,
            fallback: positiveCountSchema
          })
          .strict()
      })
      .strict(),
    coins: z
      .object({
        denominations: z
          .object({
            pp: denominationSchema,
            gp: denominationSchema,
            ep: denominationSchema,
            sp: denominationSchema,
            cp: denominationSchema
          })
          .strict()
          .refine(
            (value) => value.cp.valueCp === 1,
            'Copper pieces remain the base accounting unit.'
          ),
        profiles: z
          .object({
            ppGp: coinProfileSchema,
            gpEp: coinProfileSchema,
            gpSp: coinProfileSchema,
            epSp: coinProfileSchema,
            spCp: coinProfileSchema,
            ppGpEp: coinProfileSchema,
            ppGpSp: coinProfileSchema,
            gpEpSp: coinProfileSchema,
            epSpCp: coinProfileSchema
          })
          .strict()
      })
      .strict(),
    packing: z
      .object({
        coinsPerCapacityUnit: z.number().positive(),
        contextBulkMinLb: z.number().nonnegative(),
        loosePlacementMaxQty: countSchema,
        looseNonAmountMinCapacity: z.number().nonnegative().default(2),
        pileMinQty: positiveCountSchema,
        containerMaxCountFactor: z.number().positive(),
        minimumFillRatio: shareSchema
      })
      .strict(),
    magic: z
      .object({ curseChance: shareSchema, overstockShare: shareSchema })
      .strict(),
    balance: z
      .object({
        categoryStrength: weightSchema,
        roleStrength: weightSchema,
        minimumRoleWeight: z.number().positive().max(1)
      })
      .strict(),
    audit: z.object({ normalBudgetTolerance: shareSchema }).strict()
  })
  .strict()

export type GeneratorLootRules = z.infer<typeof generatorLootRulesSchema>
export type GeneratorLootProgressionRow =
  GeneratorLootRules['progression'][number]
export type GeneratorLootRarity =
  keyof GeneratorLootProgressionRow['magicPerXp']
