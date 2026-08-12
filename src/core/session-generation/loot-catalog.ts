import { compareText } from './deterministic-order.js'
import type { EncounterCatalog } from './catalog.js'
import { decimal, type Rational } from './rational.js'
import {
  goldPerXp,
  magicPerXp,
  type GoldPerXp,
  type MagicPerXp
} from './reward-units.js'

type Row = Readonly<Record<string, string>>

export type LootRarity =
  'Common' | 'Uncommon' | 'Rare' | 'Very Rare' | 'Legendary'

export type LootProgression = Readonly<{
  id: string
  level: number
  goldPerXp: GoldPerXp
  magicPerXp: Readonly<Record<LootRarity, MagicPerXp>>
}>

export type LootCatalogItem = Readonly<{
  id: string
  name: string
  category: string
  baseCp: Rational
  baseLb: number
  active: boolean
  formOverride: string | null
  capacity: number
  allowedContainerNames: readonly string[]
  utilityScore: number
  lootClass: 'carrier' | 'useful' | 'flavor'
  lootType: string
  modularProfiles: readonly string[]
  canAdorn: boolean
  unitLabel: string
  valueForm: string | null
}>

export type LootModifier = Readonly<{
  id: string
  name: string
  textTemplate: string | null
  details: string | null
  allowedProfiles: readonly string[]
  allowedCategories: readonly string[]
  flatValueCp: Rational
  active: boolean
}>

export type LootTheme = Readonly<{
  id: string
  name: string
  magicType: string
  spellColors: readonly string[]
  active: boolean
}>

export type MagicItem = Readonly<{
  id: string
  type: string
  rarity: LootRarity
  item: string
  decisionType:
    | 'none'
    | 'spell_level'
    | 'variant_group'
    | 'fixed_variant'
    | 'enspelled_item'
  info1: string | null
  info2: string | null
  active: boolean
}>

export type MagicVariant = Readonly<{
  id: string
  groupKey: string
  option: string
  sortOrder: number
  active: boolean
}>

export type Spell = Readonly<{
  id: string
  name: string
  level: number
  elements: readonly string[]
}>

export type LootContainer = Readonly<{
  id: string
  name: string
  capacity: number
  relation: string
  hidden: boolean
  priority: number
  mixable: boolean
}>

export type EnspelledRule = Readonly<{
  id: string
  chassis: string
  spellLevel: number
  rarity: LootRarity
  baseItemRegex: string
  active: boolean
  maxBaseCapacity: number
}>

export type MagicCurse = Readonly<{
  id: string
  name: string
  effect: string
  weight: number
  appliesTo: string
  minRarity: LootRarity
  maxRarity: LootRarity
  active: boolean
}>

export type LootRelation = Readonly<{
  type: string
  sourceId: string
  targetId: string
  active: boolean
  sortOrder: number
}>

export type FullSessionGenerationCatalog = Readonly<{
  encounter: EncounterCatalog
  progression: readonly LootProgression[]
  items: readonly LootCatalogItem[]
  modifiers: readonly LootModifier[]
  relations: readonly LootRelation[]
  themes: readonly LootTheme[]
  magicItems: readonly MagicItem[]
  magicVariants: readonly MagicVariant[]
  spells: readonly Spell[]
  containers: readonly LootContainer[]
  enspelledRules: readonly EnspelledRule[]
  curses: readonly MagicCurse[]
  decisionTypes: readonly string[]
  sourceIds: readonly string[]
}>

export type FullCatalogTableTexts = Readonly<Record<string, string>>

export const lootRarities: readonly LootRarity[] = [
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary'
]

export function parseFullSessionGenerationCatalog(
  encounter: EncounterCatalog,
  tables: FullCatalogTableTexts
): FullSessionGenerationCatalog {
  const progression = rows(tables, 'DB_Progression.tsv').map((row) => ({
    id: required(row, 'Level_ID'),
    level: integer(row, 'Level'),
    goldPerXp: goldPerXp(exactDecimalOrZero(row, 'Gold_Per_XP')),
    magicPerXp: {
      Common: magicPerXp(exactDecimalOrZero(row, 'Common_Per_XP')),
      Uncommon: magicPerXp(exactDecimalOrZero(row, 'Uncommon_Per_XP')),
      Rare: magicPerXp(exactDecimalOrZero(row, 'Rare_Per_XP')),
      'Very Rare': magicPerXp(exactDecimalOrZero(row, 'Very_Rare_Per_XP')),
      Legendary: magicPerXp(exactDecimalOrZero(row, 'Legendary_Per_XP'))
    }
  }))
  const items = rows(tables, 'DB_LootItems.tsv').map((row) => ({
    id: required(row, 'Item_ID'),
    name: required(row, 'Name'),
    category: required(row, 'Category'),
    baseCp: exactDecimal(row, 'Base_CP'),
    baseLb: finite(row, 'Base_LB'),
    active: boolean(row, 'Active'),
    formOverride: optional(row, 'Loot_Form_Override'),
    capacity: finite(row, 'Capacity_Units'),
    allowedContainerNames: list(row, 'Allowed_Containers_Cache'),
    utilityScore: finite(row, 'Utility_Score'),
    lootClass: lootClass(required(row, 'Loot_Class')),
    lootType: required(row, 'Loot_Type'),
    modularProfiles: list(row, 'Modular_Profile_Cache'),
    canAdorn: boolean(row, 'Can_Adorn'),
    unitLabel: optional(row, 'Unit_Label') ?? 'item',
    valueForm: optional(row, 'Value_Form')
  }))
  const modifiers = rows(tables, 'DB_LootModifiers.tsv').map((row) => ({
    id: required(row, 'Modifier_ID'),
    name: required(row, 'Name'),
    textTemplate: optional(row, 'Text_Template'),
    details: optional(row, 'Details'),
    allowedProfiles: list(row, 'Allowed_Profiles_Cache'),
    allowedCategories: list(row, 'Allowed_Categories_Cache'),
    flatValueCp: exactDecimal(row, 'Flat_Value_CP'),
    active: boolean(row, 'Active')
  }))
  const relations = rows(tables, 'DB_LootRelations.tsv').map((row) => ({
    type: required(row, 'Relation_Type'),
    sourceId: required(row, 'Source_ID'),
    targetId: required(row, 'Target_ID'),
    active: boolean(row, 'Active'),
    sortOrder: finite(row, 'Sort_Order')
  }))
  const themes = rows(tables, 'DB_Themes.tsv').map((row) => ({
    id: required(row, 'Theme_ID'),
    name: required(row, 'Theme'),
    magicType: required(row, 'Magic_Type'),
    spellColors: list(row, 'Spell_Colors'),
    active: boolean(row, 'Active')
  }))
  const magicItems = rows(tables, 'DB_MagicItems.tsv').map((row) => ({
    id: required(row, 'Magic_Item_ID'),
    type: required(row, 'Type'),
    rarity: rarity(row, 'Rarity'),
    item: required(row, 'Item'),
    decisionType: decision(required(row, 'Decision_Type')),
    info1: optional(row, 'Info_1'),
    info2: optional(row, 'Info_2'),
    active: boolean(row, 'Active')
  }))
  const magicVariants = rows(tables, 'DB_MagicVariants.tsv').map((row) => ({
    id: required(row, 'Magic_Variant_ID'),
    groupKey: required(row, 'Group_Key'),
    option: required(row, 'Option'),
    sortOrder: finite(row, 'Sort_Order'),
    active: boolean(row, 'Active')
  }))
  const spells = rows(tables, 'DB_Spells.tsv').map((row) => ({
    id: required(row, 'Spell_ID'),
    name: required(row, 'Spell'),
    level: integer(row, 'Level'),
    elements: list(row, 'Elements')
  }))
  const containers = rows(tables, 'DB_Containers.tsv').map((row) => ({
    id: required(row, 'Container_ID'),
    name: required(row, 'Container'),
    capacity: finite(row, 'Capacity_Units'),
    relation: required(row, 'Relation'),
    hidden: boolean(row, 'Hide_In_Output'),
    priority: finite(row, 'Packing_Priority'),
    mixable: boolean(row, 'Mixable')
  }))
  const enspelledRules = rows(tables, 'DB_EnspelledRules.tsv').map((row) => ({
    id: required(row, 'Rule_ID'),
    chassis: required(row, 'Chassis'),
    spellLevel: integer(row, 'Spell_Level'),
    rarity: rarity(row, 'Rarity'),
    baseItemRegex: required(row, 'Base_Item_Regex').replace(/^\(\?i\)/, ''),
    active: boolean(row, 'Active'),
    maxBaseCapacity: finite(row, 'Max_Base_Capacity')
  }))
  const curses = rows(tables, 'DB_MagicCurses.tsv').map((row) => ({
    id: required(row, 'Curse_ID'),
    name: required(row, 'Name'),
    effect: required(row, 'Effect'),
    weight: finite(row, 'Weight'),
    appliesTo: required(row, 'Applies_To'),
    minRarity: rarity(row, 'Min_Rarity'),
    maxRarity: rarity(row, 'Max_Rarity'),
    active: boolean(row, 'Active')
  }))
  const decisionTypeRows = rows(tables, 'DB_MagicDecisionTypes.tsv')
  const decisionTypes = decisionTypeRows
    .filter((row) => boolean(row, 'Active'))
    .map((row) => required(row, 'Decision_Type'))
  const sourceIds = rows(tables, 'DB_LootSources.tsv').map((row) =>
    required(row, 'Source_ID')
  )

  assertUnique(
    progression.map((entry) => entry.id),
    'loot_progression_id'
  )
  assertUnique(
    progression.map((entry) => String(entry.level)),
    'loot_progression_level'
  )
  assertUnique(
    items.map((item) => item.id),
    'loot_item'
  )
  assertUnique(
    modifiers.map((modifier) => modifier.id),
    'loot_modifier'
  )
  assertUnique(
    themes.map((theme) => theme.id),
    'loot_theme'
  )
  assertUnique(
    magicItems.map((item) => item.id),
    'magic_item'
  )
  assertUnique(
    magicVariants.map((variant) => variant.id),
    'magic_variant'
  )
  assertUnique(
    spells.map((spell) => spell.id),
    'spell'
  )
  assertUnique(
    containers.map((container) => container.id),
    'container'
  )
  assertUnique(
    curses.map((curse) => curse.id),
    'curse'
  )
  assertUnique(
    enspelledRules.map((rule) => rule.id),
    'enspelled_rule'
  )
  assertUnique(
    decisionTypeRows.map((row) => required(row, 'Decision_Type_ID')),
    'magic_decision_type_id'
  )
  assertUnique(
    decisionTypeRows.map((row) => required(row, 'Decision_Type')),
    'magic_decision_type'
  )
  assertUnique(sourceIds, 'loot_source')
  assertUnique(
    relations.map(
      (relation) =>
        `${relation.type}\u0000${relation.sourceId}\u0000${relation.targetId}`
    ),
    'loot_relation'
  )
  if (progression.length !== 20)
    throw new Error('catalog_schema_invalid:loot_progression')
  if (items.length === 0 || themes.length === 0 || containers.length === 0)
    throw new Error('catalog_schema_invalid:loot_catalog_empty')
  const itemIds = new Set(items.map((item) => item.id))
  const containerIds = new Set(containers.map((container) => container.id))
  const modifierIds = new Set(modifiers.map((modifier) => modifier.id))
  const themeIds = new Set(themes.map((theme) => theme.id))
  const categories = new Set(
    items.flatMap((item) => [
      item.category,
      catalogEntityKey('category', item.category)
    ])
  )
  const profiles = new Set(
    items.flatMap((item) =>
      item.modularProfiles.flatMap((profile) => [
        profile,
        catalogEntityKey('profile', profile)
      ])
    )
  )
  const relationValidators: Readonly<
    Record<string, (relation: LootRelation) => boolean>
  > = {
    ITEM_CONTAINER: (relation) =>
      itemIds.has(relation.sourceId) && containerIds.has(relation.targetId),
    MODIFIER_CATEGORY: (relation) =>
      modifierIds.has(relation.sourceId) && categories.has(relation.targetId),
    MODIFIER_PROFILE: (relation) =>
      modifierIds.has(relation.sourceId) && profiles.has(relation.targetId),
    THEME_CATEGORY: (relation) =>
      themeIds.has(relation.sourceId) && categories.has(relation.targetId)
  }
  for (const relation of relations.filter((relation) => relation.active)) {
    const validate = relationValidators[relation.type]
    if (!validate)
      throw new Error(`catalog_schema_invalid:relation_${relation.type}`)
    if (!validate(relation))
      throw new Error(
        `catalog_reference_missing:${relation.type.toLowerCase()}`
      )
  }
  if (magicItems.some((item) => !decisionTypes.includes(item.decisionType)))
    throw new Error('catalog_reference_missing:magic_decision')
  const variantGroups = new Set(
    magicVariants
      .filter((variant) => variant.active)
      .map((item) => item.groupKey)
  )
  if (
    magicItems.some(
      (item) =>
        item.active &&
        item.decisionType === 'variant_group' &&
        (!item.info1 || !variantGroups.has(item.info1))
    )
  )
    throw new Error('catalog_reference_missing:magic_variant_group')
  for (const rule of enspelledRules.filter((entry) => entry.active)) {
    try {
      new RegExp(rule.baseItemRegex, 'i')
    } catch {
      throw new Error('catalog_schema_invalid:enspelled_rule_regex')
    }
  }

  return deepFreeze({
    encounter,
    progression: progression.toSorted((a, b) => a.level - b.level),
    items: items.toSorted((a, b) => compareText(a.id, b.id)),
    modifiers: modifiers.toSorted((a, b) => compareText(a.id, b.id)),
    relations: relations.toSorted(
      (a, b) =>
        compareText(a.type, b.type) ||
        compareText(a.sourceId, b.sourceId) ||
        a.sortOrder - b.sortOrder
    ),
    themes: themes.toSorted((a, b) => compareText(a.id, b.id)),
    magicItems: magicItems.toSorted((a, b) => compareText(a.id, b.id)),
    magicVariants: magicVariants.toSorted(
      (a, b) =>
        compareText(a.groupKey, b.groupKey) ||
        a.sortOrder - b.sortOrder ||
        compareText(a.id, b.id)
    ),
    spells: spells.toSorted(
      (a, b) => a.level - b.level || compareText(a.id, b.id)
    ),
    containers: containers.toSorted(
      (a, b) => a.priority - b.priority || compareText(a.id, b.id)
    ),
    enspelledRules: enspelledRules.toSorted((a, b) => compareText(a.id, b.id)),
    curses: curses.toSorted((a, b) => compareText(a.id, b.id)),
    decisionTypes: decisionTypes.toSorted(compareText),
    sourceIds: sourceIds.toSorted(compareText)
  })
}

export function rarityIndex(rarity: LootRarity): number {
  return lootRarities.indexOf(rarity)
}

function rows(tables: FullCatalogTableTexts, file: string): readonly Row[] {
  const source = tables[file]
  if (!source) throw new Error(`catalog_unavailable:${file}`)
  const lines = source.replace(/\r/g, '').replace(/\n+$/, '').split('\n')
  const header = lines[0]?.split('\t') ?? []
  if (header.length === 0) throw new Error(`catalog_schema_invalid:${file}`)
  return lines.slice(1).map((line) => {
    const values = line.split('\t')
    if (values.length > header.length)
      throw new Error(`catalog_schema_invalid:row_width:${file}`)
    return Object.freeze(
      Object.fromEntries(header.map((key, index) => [key, values[index] ?? '']))
    )
  })
}

function required(row: Row, key: string): string {
  const value = row[key]?.trim() ?? ''
  if (!value) throw new Error(`catalog_schema_invalid:missing_${key}`)
  return value
}

function optional(row: Row, key: string): string | null {
  const value = row[key]?.trim() ?? ''
  return value || null
}

function finite(row: Row, key: string): number {
  const value = Number(row[key] ?? '')
  if (!Number.isFinite(value))
    throw new Error(`catalog_schema_invalid:number_${key}`)
  return value
}

function exactDecimal(row: Row, key: string): Rational {
  const value = row[key]?.trim() ?? ''
  if (!/^-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(value))
    throw new Error(`catalog_schema_invalid:decimal_${key}`)
  return decimal(value)
}

function exactDecimalOrZero(row: Row, key: string): Rational {
  return row[key]?.trim() ? exactDecimal(row, key) : rationalZero
}

const rationalZero = decimal('0')

function integer(row: Row, key: string): number {
  const value = finite(row, key)
  if (!Number.isSafeInteger(value))
    throw new Error(`catalog_schema_invalid:integer_${key}`)
  return value
}

function boolean(row: Row, key: string): boolean {
  const value = row[key]
  if (value !== 'true' && value !== 'false')
    throw new Error(`catalog_schema_invalid:boolean_${key}`)
  return value === 'true'
}

function list(row: Row, key: string): readonly string[] {
  return (row[key] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function rarity(row: Row, key: string): LootRarity {
  const value = required(row, key)
  if (!lootRarities.includes(value as LootRarity))
    throw new Error(`catalog_schema_invalid:rarity_${key}`)
  return value as LootRarity
}

function lootClass(value: string): 'carrier' | 'useful' | 'flavor' {
  if (value !== 'carrier' && value !== 'useful' && value !== 'flavor')
    throw new Error('catalog_schema_invalid:loot_class')
  return value
}

function decision(value: string): MagicItem['decisionType'] {
  if (
    value !== 'none' &&
    value !== 'spell_level' &&
    value !== 'variant_group' &&
    value !== 'fixed_variant' &&
    value !== 'enspelled_item'
  )
    throw new Error('catalog_schema_invalid:magic_decision')
  return value
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length)
    throw new Error(`catalog_schema_invalid:duplicate_${label}`)
}

function catalogEntityKey(prefix: string, value: string): string {
  return `${prefix}:${value.toLowerCase().replaceAll('_', '-')}`
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
