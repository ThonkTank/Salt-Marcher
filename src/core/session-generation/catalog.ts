import { z } from 'zod'
import { compareText } from './deterministic-order.js'

export type EncounterRole = 'Minion' | 'Support' | 'Standard' | 'Elite' | 'Boss'

export type EncounterCatalog = Readonly<{
  catalogVersion: string
  catalogContentHash: string
  progression: readonly ProgressionRow[]
  challengeRatings: readonly ChallengeRating[]
  roleBands: readonly RoleBand[]
  patterns: readonly EncounterPattern[]
}>

export type ProgressionRow = Readonly<{
  level: number
  dayXpPerCharacter: number
  dayXpParty4: number
  mediumXpPerCharacter: number
  hardXpPerCharacter: number
  deadlyXpPerCharacter: number
}>

export type ChallengeRating = Readonly<{
  id: string
  code: number
  label: string
  xp: number
  active: boolean
}>

export type RoleBand = Readonly<{
  partyLevel: number
  crId: string
  role: EncounterRole
  active: boolean
  sourceRow: number
}>

export type EncounterPattern = Readonly<{
  id: string
  roles: readonly EncounterRole[]
  active: boolean
  sortOrder: number
}>

export const catalogManifestSchema = z
  .object({
    catalogVersion: z.string().min(1),
    catalogContentHash: z.string().regex(/^[0-9a-f]{64}$/),
    tables: z
      .array(
        z
          .object({
            columns: z.number().int().positive(),
            file: z.string().regex(/^[A-Za-z0-9_.-]+$/),
            name: z.string().min(1),
            rows: z.number().int().positive(),
            sha256: z.string().regex(/^[0-9a-f]{64}$/)
          })
          .strict()
      )
      .min(1)
  })
  .passthrough()

export type EncounterCatalogManifest = z.infer<typeof catalogManifestSchema>

const roleSchema = z.enum(['Minion', 'Support', 'Standard', 'Elite', 'Boss'])

type Row = Readonly<Record<string, string>>

export type EncounterCatalogTableTexts = Readonly<{
  progression: string
  challengeRatings: string
  roleBands: string
  patterns: string
}>

export const expectedCatalogHeaders: Readonly<
  Record<string, readonly string[]>
> = {
  'DB_CR.tsv': ['CR_ID', 'CR_Code', 'CR_Label', 'XP', 'Active', 'Sort_Order'],
  'DB_Containers.tsv': [
    'Container',
    'Capacity_Units',
    'Relation',
    'Hide_In_Output',
    'Notes',
    'Packing_Priority',
    'Mixable',
    'Container_ID',
    'Output_Singular',
    'Output_Plural',
    'Output_Relation'
  ],
  'DB_EncounterPatterns.tsv': [
    'Pattern_ID',
    'Role_1',
    'Role_2',
    'Role_3',
    'Role_Count',
    'Active',
    'Sort_Order'
  ],
  'DB_EncounterRoleBands.tsv': [
    'Role_Band_ID',
    'Party_Level',
    'CR_ID',
    'Role',
    'Active',
    'Source_Row'
  ],
  'DB_EnspelledRules.tsv': [
    'Rule_ID',
    'Chassis',
    'Spell_Level',
    'Rarity',
    'Save_DC',
    'Attack_Bonus',
    'Max_Charges',
    'Recharge',
    'Charge_Cost',
    'Requires_Attunement',
    'Base_Item_Regex',
    'Active',
    'Source',
    'Max_Base_Capacity'
  ],
  'DB_LootItems.tsv': [
    'Item_ID',
    'Name',
    'Category',
    'Base_CP',
    'Base_LB',
    'Active',
    'Notes',
    'Loot_Form_Override',
    'Size_Class',
    'Capacity_Units',
    'Utility_Score',
    'Value_Density_CP',
    'Value_Tier',
    'Loot_Class',
    'Loot_Type',
    'Modular_Profile',
    'Can_Adorn',
    'Adornment_Type',
    'Unit_Label',
    'Source',
    'Source_Row',
    'Value_Form'
  ],
  'DB_LootModifiers.tsv': [
    'Modifier_ID',
    'Modifier_Kind',
    'Name',
    'Loot_Type',
    'Text_Template',
    'Details',
    'Component_Type',
    'Min_Qty',
    'Max_Qty',
    'Flat_Value_CP',
    'Active',
    'Source_Row'
  ],
  'DB_LootRelations.tsv': [
    'Relation_Type',
    'Source_ID',
    'Target_ID',
    'Active',
    'Sort_Order',
    'Notes'
  ],
  'DB_LootMix.tsv': [
    'Mix_Level',
    'Parent_ID',
    'Option_ID',
    'Share',
    'Selection_Path',
    'Active',
    'Sort_Order',
    'Notes'
  ],
  'DB_LootSelectionPolicy.tsv': [
    'Path_ID',
    'Fit_Weight',
    'Theme_Weight',
    'Jitter_Weight',
    'Duplicate_Penalty',
    'Near_Best_Gap_Pct',
    'Shortlist_Size',
    'Min_Fit_Pct',
    'Max_Overfit_Pct',
    'Variant_Shortlist_Size',
    'Min_Base_Extra_CP',
    'Preferred_Base_Extra_CP',
    'Active',
    'Notes'
  ],
  'DB_LootQuantityRules.tsv': [
    'Rule_ID',
    'Selection_Path',
    'Match_Field',
    'Match_Value',
    'Max_Qty',
    'Priority',
    'Active',
    'Notes'
  ],
  'DB_CoinProfiles.tsv': [
    'Profile_ID',
    'Unit_1_CP',
    'Unit_2_CP',
    'Unit_3_CP',
    'Min_Low_Count',
    'Max_Low_Count',
    'Max_Middle_Count',
    'Max_Budget_CP',
    'Allowed_Containers',
    'Active',
    'Sort_Order',
    'Notes'
  ],
  'DB_CoinDenominations.tsv': [
    'Denomination_ID',
    'Unit_CP',
    'Singular_Label',
    'Plural_Label',
    'Active',
    'Sort_Order',
    'Notes'
  ],
  'DB_LootSources.tsv': ['Source_ID', 'Title', 'URL', 'Use', 'Accessed'],
  'DB_MagicCurses.tsv': [
    'Curse_ID',
    'Name',
    'Effect',
    'Severity',
    'Weight',
    'Trigger',
    'Applies_To',
    'Requires_Attunement',
    'Min_Rarity',
    'Max_Rarity',
    'Active',
    'Source_Adaptation'
  ],
  'DB_MagicDecisionTypes.tsv': [
    'Decision_Type_ID',
    'Decision_Type',
    'Meaning',
    'Info_1',
    'Info_2',
    'Active',
    'Source'
  ],
  'DB_MagicItems.tsv': [
    'Magic_Item_ID',
    'Type',
    'Rarity',
    'Roll_Min',
    'Roll_Max',
    'Item',
    'Decision_Type',
    'Info_1',
    'Info_2',
    'Active'
  ],
  'DB_MagicVariants.tsv': [
    'Magic_Variant_ID',
    'Group_Key',
    'Option',
    'Sort_Order',
    'Active',
    'Source'
  ],
  'DB_Progression.tsv': [
    'Level_ID',
    'Level',
    'XP_At_Level',
    'XP_To_Next',
    'Day_XP_Per_Character',
    'Day_XP_Party_4',
    'Gold_At_Level_GP',
    'Gold_To_Next_GP',
    'Gold_Per_XP',
    'Easy_XP_Per_Character',
    'Medium_XP_Per_Character',
    'Hard_XP_Per_Character',
    'Deadly_XP_Per_Character',
    'Common_Per_XP',
    'Uncommon_Per_XP',
    'Rare_Per_XP',
    'Very_Rare_Per_XP',
    'Legendary_Per_XP'
  ],
  'DB_Spells.tsv': ['Spell', 'Level', 'Elements', 'Spell_ID'],
  'DB_Themes.tsv': [
    'Theme_ID',
    'Theme',
    'Magic_Type',
    'Notes',
    'Active',
    'Source_Rows',
    'Spell_Colors'
  ]
}

const legacyCatalogVersion = 'catalog-2026-07-16'
const {
  'DB_LootMix.tsv': _legacyMix,
  'DB_LootSelectionPolicy.tsv': _legacySelection,
  'DB_LootQuantityRules.tsv': _legacyQuantity,
  'DB_CoinProfiles.tsv': _legacyCoinProfiles,
  'DB_CoinDenominations.tsv': _legacyCoinDenominations,
  ...legacySharedHeaders
} = expectedCatalogHeaders
void _legacyMix
void _legacySelection
void _legacyQuantity
void _legacyCoinProfiles
void _legacyCoinDenominations

const legacyExpectedCatalogHeaders: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  ...legacySharedHeaders,
  'DB_Containers.tsv': expectedCatalogHeaders['DB_Containers.tsv']!.slice(0, 8),
  'DB_LootItems.tsv': [
    'Item_ID',
    'Name',
    'Category',
    'Base_CP',
    'Base_LB',
    'Active',
    'Notes',
    'Loot_Form_Override',
    'Size_Class',
    'Capacity_Units',
    'Allowed_Containers_Cache',
    'Utility_Score',
    'Value_Density_CP',
    'Value_Tier',
    'Loot_Class',
    'Loot_Type',
    'Modular_Profile_Cache',
    'Can_Adorn',
    'Adornment_Type',
    'Unit_Label',
    'Source',
    'Source_Row',
    'Value_Form'
  ],
  'DB_LootModifiers.tsv': [
    'Modifier_ID',
    'Modifier_Kind',
    'Name',
    'Loot_Type',
    'Allowed_Profiles_Cache',
    'Allowed_Categories_Cache',
    'Text_Template',
    'Details',
    'Component_Type',
    'Min_Qty',
    'Max_Qty',
    'Flat_Value_CP',
    'Active',
    'Source_Row'
  ]
})

export function catalogHeadersForVersion(
  catalogVersion: string,
  tableFiles?: readonly string[]
): Readonly<Record<string, readonly string[]>> {
  return catalogVersion === legacyCatalogVersion ||
    (tableFiles !== undefined && !tableFiles.includes('DB_LootMix.tsv'))
    ? legacyExpectedCatalogHeaders
    : expectedCatalogHeaders
}

export type EncounterCatalogSnapshot = Readonly<{
  manifest: unknown
  tables: EncounterCatalogTableTexts
}>

export function parseEncounterCatalog(
  snapshot: EncounterCatalogSnapshot
): EncounterCatalog {
  const manifest = catalogManifestSchema.parse(snapshot.manifest)
  const progressionRows = parseRows(snapshot.tables.progression, [
    'Level_ID',
    'Level',
    'XP_At_Level',
    'XP_To_Next',
    'Day_XP_Per_Character',
    'Day_XP_Party_4',
    'Gold_At_Level_GP',
    'Gold_To_Next_GP',
    'Gold_Per_XP',
    'Easy_XP_Per_Character',
    'Medium_XP_Per_Character',
    'Hard_XP_Per_Character',
    'Deadly_XP_Per_Character',
    'Common_Per_XP',
    'Uncommon_Per_XP',
    'Rare_Per_XP',
    'Very_Rare_Per_XP',
    'Legendary_Per_XP'
  ])
  const crRows = parseRows(snapshot.tables.challengeRatings, [
    'CR_ID',
    'CR_Code',
    'CR_Label',
    'XP',
    'Active',
    'Sort_Order'
  ])
  const bandRows = parseRows(snapshot.tables.roleBands, [
    'Role_Band_ID',
    'Party_Level',
    'CR_ID',
    'Role',
    'Active',
    'Source_Row'
  ])
  const patternRows = parseRows(snapshot.tables.patterns, [
    'Pattern_ID',
    'Role_1',
    'Role_2',
    'Role_3',
    'Role_Count',
    'Active',
    'Sort_Order'
  ])

  const progression = progressionRows
    .map((row) => ({
      level: integer(row, 'Level'),
      dayXpPerCharacter: nonnegative(row, 'Day_XP_Per_Character'),
      dayXpParty4: nonnegative(row, 'Day_XP_Party_4'),
      mediumXpPerCharacter: nonnegative(row, 'Medium_XP_Per_Character'),
      hardXpPerCharacter: nonnegative(row, 'Hard_XP_Per_Character'),
      deadlyXpPerCharacter: nonnegative(row, 'Deadly_XP_Per_Character')
    }))
    .sort((left, right) => left.level - right.level)

  const challengeRatings = crRows
    .map((row) => ({
      id: text(row, 'CR_ID'),
      code: integer(row, 'CR_Code'),
      label: text(row, 'CR_Label'),
      xp: nonnegative(row, 'XP'),
      active: bool(row, 'Active')
    }))
    .sort(
      (left, right) => left.code - right.code || compareText(left.id, right.id)
    )

  const roleBands = bandRows
    .map((row) => ({
      partyLevel: integer(row, 'Party_Level'),
      crId: text(row, 'CR_ID'),
      role: roleSchema.parse(text(row, 'Role')),
      active: bool(row, 'Active'),
      sourceRow: integer(row, 'Source_Row')
    }))
    .sort(
      (left, right) =>
        left.partyLevel - right.partyLevel || left.sourceRow - right.sourceRow
    )

  const patterns = patternRows
    .map((row) => {
      const roles = [row['Role_1'], row['Role_2'], row['Role_3']]
        .filter((role): role is string => Boolean(role))
        .map((role) => roleSchema.parse(role))
      if (integer(row, 'Role_Count') !== roles.length)
        throw new Error('catalog_schema_invalid:pattern_role_count')
      return {
        id: text(row, 'Pattern_ID'),
        roles,
        active: bool(row, 'Active'),
        sortOrder: integer(row, 'Sort_Order')
      }
    })
    .filter((pattern) => pattern.roles.length > 0)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || compareText(left.id, right.id)
    )

  assertUnique(
    progression.map((row) => row.level),
    'duplicate progression level'
  )
  assertUnique(
    challengeRatings.map((row) => row.id),
    'duplicate challenge rating id'
  )
  assertUnique(
    roleBands.map((row) => `${row.partyLevel}:${row.role}:${row.crId}`),
    'duplicate role band'
  )
  assertUnique(
    patterns.map((row) => row.id),
    'duplicate encounter pattern id'
  )

  if (
    progression.length !== 20 ||
    progression.some((row, index) => row.level !== index + 1)
  )
    throw new Error('catalog_schema_invalid:progression_levels')
  if (challengeRatings.length === 0)
    throw new Error('catalog_schema_invalid:challenge_ratings')
  if (
    roleBands.some(
      (band) => !challengeRatings.some((cr) => cr.id === band.crId)
    )
  )
    throw new Error('catalog_reference_missing:role_band_cr')
  if (patterns.length === 0) throw new Error('catalog_schema_invalid:patterns')

  return deepFreeze({
    catalogVersion: manifest.catalogVersion,
    catalogContentHash: manifest.catalogContentHash,
    progression,
    challengeRatings,
    roleBands,
    patterns
  })
}

function parseRows(
  text: string,
  expectedHeader: readonly string[]
): readonly Row[] {
  const lines = text.replace(/\r/g, '').trimEnd().split('\n')
  const header = lines[0]?.split('\t') ?? []
  if (
    header.length !== expectedHeader.length ||
    header.some((value, index) => value !== expectedHeader[index])
  )
    throw new Error('catalog_schema_invalid:header')
  return lines.slice(1).map((line) => {
    const values = line.split('\t')
    if (values.length !== header.length)
      throw new Error('catalog_schema_invalid:row_width')
    return Object.freeze(
      Object.fromEntries(header.map((key, index) => [key, values[index] ?? '']))
    )
  })
}

function text(row: Row, key: string): string {
  const value = row[key] ?? ''
  if (!value) throw new Error(`catalog_schema_invalid:missing_${key}`)
  return value
}

function numberValue(row: Row, key: string): number {
  const value = Number(row[key] ?? '')
  if (!Number.isFinite(value) || !Number.isSafeInteger(value))
    throw new Error(`catalog_schema_invalid:number_${key}`)
  return value
}

function integer(row: Row, key: string): number {
  return numberValue(row, key)
}

function nonnegative(row: Row, key: string): number {
  const value = numberValue(row, key)
  if (value < 0) throw new Error(`catalog_schema_invalid:negative_${key}`)
  return value
}

function bool(row: Row, key: string): boolean {
  const value = row[key]
  if (value !== 'true' && value !== 'false' && value !== '1' && value !== '0')
    throw new Error(`catalog_schema_invalid:boolean_${key}`)
  return value === 'true' || value === '1'
}

function assertUnique(
  values: readonly (number | string)[],
  message: string
): void {
  if (new Set(values).size !== values.length)
    throw new Error(`catalog_schema_invalid:${message}`)
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
