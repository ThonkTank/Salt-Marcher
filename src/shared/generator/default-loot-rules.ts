import {
  generatorLootRulesSchema,
  type GeneratorLootRules
} from '../contracts/generator-loot-rules.js'

const progressionSource: ReadonlyArray<
  readonly [number, number, number, number, number, number, number, number]
> = [
  [1, 0, 94, 0.0008333333333333334, 0, 0, 0, 0],
  [2, 300, 188, 0.0004166666666666667, 0, 0, 0, 0],
  [3, 900, 376, 0.0001388888888888889, 0, 0, 0, 0],
  [4, 2700, 658, 0.00006578947368421052, 0.00006578947368421052, 0, 0, 0],
  [5, 6500, 2930, 0.00006666666666666667, 0.000033333333333333335, 0, 0, 0],
  [6, 14000, 5404, 0.00008333333333333333, 0.00002777777777777778, 0, 0, 0],
  [7, 23000, 8610, 0.00006818181818181818, 0.000022727272727272726, 0, 0, 0],
  [8, 34000, 12019, 0.00005357142857142857, 0.00001785714285714286, 0, 0, 0],
  [9, 48000, 16563, 0.000046875, 0.000015625, 0, 0, 0],
  [
    10, 64000, 21108, 0.00003571428571428572, 0.000011904761904761905,
    0.000011904761904761905, 0, 0
  ],
  [
    11, 85000, 30161, 0.000033333333333333335, 0.000016666666666666667,
    0.000016666666666666667, 0, 0
  ],
  [12, 100000, 39214, 0.0000125, 0.000025, 0.0000125, 0, 0],
  [13, 120000, 57320, 0.0000125, 0.000025, 0.0000125, 0, 0],
  [14, 140000, 75427, 0.00001, 0.00002, 0.00001, 0, 0],
  [
    15, 165000, 102586, 0.000008333333333333334, 0.000016666666666666667,
    0.000008333333333333334, 0.000008333333333333334, 0
  ],
  [
    16, 195000, 129745, 0.000008333333333333334, 0.000016666666666666667,
    0.000016666666666666667, 0.000008333333333333334, 0
  ],
  [17, 225000, 214204, 0, 0.0000125, 0.00003125, 0.0000125, 0],
  [18, 265000, 383123, 0, 0.00000625, 0.00003125, 0.0000125, 0],
  [19, 305000, 552042, 0, 0.000005, 0.000025, 0.00001, 0],
  [20, 355000, 805420, 0, 0, 0, 0, 0]
]

const progression: GeneratorLootRules['progression'] = progressionSource.map(
  ([
    level,
    xpAtLevel,
    goldAtLevelGp,
    Common,
    Uncommon,
    Rare,
    veryRare,
    Legendary
  ]) => ({
    level,
    xpAtLevel,
    goldAtLevelCp: goldAtLevelGp * 100,
    magicPerXp: {
      Common,
      Uncommon,
      Rare,
      'Very Rare': veryRare,
      Legendary
    }
  })
) as GeneratorLootRules['progression']

const policy = (
  fitWeight: number,
  themeWeight: number,
  jitterWeight: number,
  duplicatePenalty: number,
  nearBestGap: number,
  shortlistSize: number,
  minFit: number,
  maxOverfit: number,
  variantShortlistSize = 0,
  minBaseExtraCp = 0,
  preferredBaseExtraCp = 0
) => ({
  fitWeight,
  themeWeight,
  jitterWeight,
  duplicatePenalty,
  nearBestGap,
  shortlistSize,
  minFit,
  maxOverfit,
  variantShortlistSize,
  minBaseExtraCp,
  preferredBaseExtraCp
})

const profile = (
  denominations: Array<'pp' | 'gp' | 'ep' | 'sp' | 'cp'>,
  maxBudgetCp: number,
  maxMiddleCount = 0
) => ({
  denominations,
  minLowCount: 5,
  maxLowCount: 30,
  maxMiddleCount,
  maxBudgetCp,
  allowedContainers: ['Pouch', 'Chest']
})

/** Defaults transcribed from the live owner Sheet on 2026-08-16. */
export const defaultGeneratorLootRules: GeneratorLootRules =
  generatorLootRulesSchema.parse({
    progression,
    treasure: {
      slotMin: 6,
      slotTarget: 8,
      slotMax: 10,
      encounterTreasureRatio: 0.75,
      treasuresPerAdventureDay: 3,
      treasureCountVariance: 1,
      overstockShare: 0.2,
      channels: { quest: 0.4, encounter: 0.4, environment: 0.2 },
      enhancedCapMin: 1,
      enhancedCapMax: 2,
      enhancedCapMultiplier: 2
    },
    mix: {
      roles: {
        compactValue: 0.25,
        complexValue: 0.25,
        useful: 0.3,
        flavor: 0.2
      },
      compactForms: { Coinage: 1 / 3, Gemstone: 1 / 3, Ingot: 1 / 3 },
      complexForms: {
        Bulk_Good: 0.5,
        Compact_Good: 0.1,
        Art_Object: 0.1,
        Adorned: 0.1,
        Livestock: 0.1,
        Clothing: 0.1
      }
    },
    selection: {
      coinage: policy(0, 0, 0, 0, 0, 9, 0, 0.05),
      carrier: policy(0.8, 0.1, 0.1, 0.35, 0.05, 10, 0, 0.05),
      adornedBase: policy(0.8, 0.1, 0.1, 0.35, 0, 5, 0, 0.05, 0, 1000, 1500),
      adornedModifier: policy(0.8, 0, 0.2, 0, 0, 5, 0, 0.05),
      adornedComponent: policy(0.9, 0, 0.1, 0, 0, 5, 0, 0.05),
      useful: policy(0.8, 0.1, 0.1, 0, 0.05, 10, 0.5, 0.05, 5),
      flavor: policy(0.8, 0.1, 0.1, 0, 0.05, 10, 0.5, 0.05)
    },
    quantityLimits: {
      carrier: {
        quantityGood: 10000,
        artObject: 3,
        gemstone: 10,
        ingot: 20,
        tradeGood: 250,
        fallback: 50
      },
      useful: {
        quantityGood: 10000,
        ammunition: 20,
        potion: 3,
        poison: 3,
        hazardItem: 3,
        fallback: 1
      },
      flavor: { quantityGood: 10000, fallback: 50 }
    },
    coins: {
      denominations: {
        pp: {
          valueCp: 1000,
          singularLabel: 'Platinum Coin',
          pluralLabel: 'Platinum Coins'
        },
        gp: {
          valueCp: 100,
          singularLabel: 'Gold Coin',
          pluralLabel: 'Gold Coins'
        },
        ep: {
          valueCp: 50,
          singularLabel: 'Electrum Coin',
          pluralLabel: 'Electrum Coins'
        },
        sp: {
          valueCp: 10,
          singularLabel: 'Silver Coin',
          pluralLabel: 'Silver Coins'
        },
        cp: {
          valueCp: 1,
          singularLabel: 'Copper Coin',
          pluralLabel: 'Copper Coins'
        }
      },
      profiles: {
        ppGp: profile(['pp', 'gp'], 999999999),
        gpEp: profile(['gp', 'ep'], 999999999),
        gpSp: profile(['gp', 'sp'], 999999999),
        epSp: profile(['ep', 'sp'], 5000),
        spCp: profile(['sp', 'cp'], 2000),
        ppGpEp: profile(['pp', 'gp', 'ep'], 999999999, 300),
        ppGpSp: profile(['pp', 'gp', 'sp'], 999999999, 300),
        gpEpSp: profile(['gp', 'ep', 'sp'], 20000, 300),
        epSpCp: profile(['ep', 'sp', 'cp'], 5000, 300)
      }
    },
    packing: {
      coinsPerCapacityUnit: 50,
      contextBulkMinLb: 20,
      loosePlacementMaxQty: 1,
      pileMinQty: 5,
      containerMaxCountFactor: 4,
      minimumFillRatio: 0.25
    },
    magic: { curseChance: 0.2, overstockShare: 0.2 },
    balance: {
      categoryStrength: 0.5,
      roleStrength: 1.5,
      minimumRoleWeight: 0.01
    },
    audit: { normalBudgetTolerance: 0.15 }
  })
