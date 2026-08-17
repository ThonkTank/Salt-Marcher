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

export type LootCategoryId = `category:${string}`
export type LootProfileId = `profile:${string}`
export type LootAdornmentTypeId = `adornment:${string}`
export type LootTypeId =
  | 'loot-type:livestock'
  | 'loot-type:material'
  | 'loot-type:object'
  | 'loot-type:vehicle'
export type MagicTypeId = `magic-type:${string}`
export type LootValueForm = 'quantity_good' | null

export type LootCatalogItem = Readonly<{
  id: string
  name: string
  categoryId: LootCategoryId
  baseCp: Rational
  baseLb: number
  active: boolean
  formOverride: string | null
  capacity: number
  allowedContainerIds: readonly string[]
  utilityScore: number
  lootClass: 'carrier' | 'useful' | 'flavor'
  lootTypeId: LootTypeId
  modularProfileIds: readonly LootProfileId[]
  canAdorn: boolean
  adornmentTypeId: LootAdornmentTypeId | null
  unitLabel: string
  unitKind: LootUnitKind
  placement: LootPlacement
  valueForm: LootValueForm
}>

export type LootUnitKind =
  'count' | 'weight' | 'area_weight' | 'liquid_pint' | 'liquid_fl_oz'
export type LootPlacement = 'worn' | 'handheld' | null

export type LootModifier = Readonly<{
  id: string
  kind: 'modular' | 'variant'
  lootTypeId: LootTypeId | 'all'
  name: string
  textTemplate: string | null
  details: string | null
  componentTypeId: LootAdornmentTypeId | null
  minQuantity: number
  maxQuantity: number
  allowedProfileIds: readonly LootProfileId[]
  allowedCategoryIds: readonly LootCategoryId[]
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
  outputSingular: string
  outputPlural: string
  outputRelation: string
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
  baseItemIds: readonly string[]
  active: boolean
  maxBaseCapacity: number
}>

export type MagicCurse = Readonly<{
  id: string
  name: string
  effect: string
  weight: number
  appliesToId: 'all' | LootCategoryId | MagicTypeId
  minRarity: LootRarity
  maxRarity: LootRarity
  active: boolean
}>

export type LootRelation = Readonly<{
  type: LootRelationType
  sourceId: string
  targetId: string
  active: boolean
  sortOrder: number
}>

export type LootRelationType =
  'ITEM_CONTAINER' | 'MODIFIER_CATEGORY' | 'MODIFIER_PROFILE' | 'THEME_CATEGORY'

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
  const relations = rows(tables, 'DB_LootRelations.tsv').map((row) => {
    const type = lootRelationType(required(row, 'Relation_Type'))
    return {
      type,
      sourceId: required(row, 'Source_ID'),
      targetId: relationTargetId(type, required(row, 'Target_ID')),
      active: boolean(row, 'Active'),
      sortOrder: finite(row, 'Sort_Order')
    }
  })
  const containers = rows(tables, 'DB_Containers.tsv').map((row) => ({
    id: required(row, 'Container_ID'),
    name: required(row, 'Container'),
    capacity: finite(row, 'Capacity_Units'),
    relation: required(row, 'Relation'),
    outputSingular:
      optional(row, 'Output_Singular') ?? required(row, 'Container'),
    outputPlural:
      optional(row, 'Output_Plural') ?? `${required(row, 'Container')}s`,
    outputRelation:
      optional(row, 'Output_Relation') ?? required(row, 'Relation'),
    hidden: boolean(row, 'Hide_In_Output'),
    priority: finite(row, 'Packing_Priority'),
    mixable: boolean(row, 'Mixable')
  }))
  const items = rows(tables, 'DB_LootItems.tsv').map((row) => ({
    id: required(row, 'Item_ID'),
    name: required(row, 'Name'),
    categoryId: categoryId(required(row, 'Category')),
    baseCp: exactDecimal(row, 'Base_CP'),
    baseLb: finite(row, 'Base_LB'),
    active: boolean(row, 'Active'),
    formOverride: optional(row, 'Loot_Form_Override'),
    capacity: finite(row, 'Capacity_Units'),
    allowedContainerIds: relations
      .filter(
        (relation) =>
          relation.active &&
          relation.type === 'ITEM_CONTAINER' &&
          relation.sourceId === required(row, 'Item_ID')
      )
      .map((relation) => relation.targetId),
    utilityScore: finite(row, 'Utility_Score'),
    lootClass: lootClass(required(row, 'Loot_Class')),
    lootTypeId: lootTypeId(required(row, 'Loot_Type')),
    modularProfileIds:
      list(row, 'Modular_Profile').length > 0
        ? list(row, 'Modular_Profile').map(profileId)
        : list(row, 'Modular_Profile_Cache').map(profileId),
    canAdorn: boolean(row, 'Can_Adorn'),
    adornmentTypeId: optional(row, 'Adornment_Type')
      ? adornmentTypeId(required(row, 'Adornment_Type'))
      : null,
    unitLabel: optional(row, 'Unit_Label') ?? 'item',
    unitKind: lootUnitKind(optional(row, 'Unit_Label') ?? 'item'),
    placement: lootPlacement(optional(row, 'Loot_Form_Override')),
    valueForm: lootValueForm(optional(row, 'Value_Form'))
  }))
  const modifiers = rows(tables, 'DB_LootModifiers.tsv').map((row) => ({
    id: required(row, 'Modifier_ID'),
    kind: modifierKind(required(row, 'Modifier_Kind')),
    lootTypeId: modifierLootTypeId(required(row, 'Loot_Type')),
    name: required(row, 'Name'),
    textTemplate: optional(row, 'Text_Template'),
    details: optional(row, 'Details'),
    componentTypeId:
      optional(row, 'Component_Type') === null ||
      optional(row, 'Component_Type') === 'none'
        ? null
        : adornmentTypeId(required(row, 'Component_Type')),
    minQuantity: finite(row, 'Min_Qty'),
    maxQuantity: finite(row, 'Max_Qty'),
    allowedProfileIds: relations
      .filter(
        (relation) =>
          relation.active &&
          relation.type === 'MODIFIER_PROFILE' &&
          relation.sourceId === required(row, 'Modifier_ID')
      )
      .map((relation) => profileIdFromRelation(relation.targetId)),
    allowedCategoryIds: relations
      .filter(
        (relation) =>
          relation.active &&
          relation.type === 'MODIFIER_CATEGORY' &&
          relation.sourceId === required(row, 'Modifier_ID')
      )
      .map((relation) => categoryIdFromRelation(relation.targetId)),
    flatValueCp: exactDecimal(row, 'Flat_Value_CP'),
    active: boolean(row, 'Active')
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
  const enspelledRules = rows(tables, 'DB_EnspelledRules.tsv').map((row) => ({
    id: required(row, 'Rule_ID'),
    chassis: required(row, 'Chassis'),
    spellLevel: integer(row, 'Spell_Level'),
    rarity: rarity(row, 'Rarity'),
    baseItemRegex: required(row, 'Base_Item_Regex').replace(/^\(\?i\)/, ''),
    baseItemIds: items
      .filter((item) => {
        const matcher = new RegExp(
          required(row, 'Base_Item_Regex').replace(/^\(\?i\)/, ''),
          'i'
        )
        return matcher.test(item.categoryId) || matcher.test(item.name)
      })
      .map((item) => item.id),
    active: boolean(row, 'Active'),
    maxBaseCapacity: finite(row, 'Max_Base_Capacity')
  }))
  const curses = rows(tables, 'DB_MagicCurses.tsv').map((row) => ({
    id: required(row, 'Curse_ID'),
    name: required(row, 'Name'),
    effect: required(row, 'Effect'),
    weight: finite(row, 'Weight'),
    appliesToId: curseAppliesToId(required(row, 'Applies_To')),
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
  const categories = new Set(items.map((item) => item.categoryId))
  const profiles = new Set(items.flatMap((item) => item.modularProfileIds))
  const relationValidators: Readonly<
    Record<string, (relation: LootRelation) => boolean>
  > = {
    ITEM_CONTAINER: (relation) =>
      itemIds.has(relation.sourceId) && containerIds.has(relation.targetId),
    MODIFIER_CATEGORY: (relation) =>
      modifierIds.has(relation.sourceId) &&
      isCategoryId(relation.targetId) &&
      categories.has(relation.targetId),
    MODIFIER_PROFILE: (relation) =>
      modifierIds.has(relation.sourceId) &&
      isProfileId(relation.targetId) &&
      profiles.has(relation.targetId),
    THEME_CATEGORY: (relation) =>
      themeIds.has(relation.sourceId) &&
      isCategoryId(relation.targetId) &&
      categories.has(relation.targetId)
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
  if (value !== 'true' && value !== 'false' && value !== '1' && value !== '0')
    throw new Error(`catalog_schema_invalid:boolean_${key}`)
  return value === 'true' || value === '1'
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

function modifierKind(value: string): LootModifier['kind'] {
  if (value !== 'modular' && value !== 'variant')
    throw new Error('catalog_schema_invalid:modifier_kind')
  return value
}

function lootRelationType(value: string): LootRelationType {
  if (
    value !== 'ITEM_CONTAINER' &&
    value !== 'MODIFIER_CATEGORY' &&
    value !== 'MODIFIER_PROFILE' &&
    value !== 'THEME_CATEGORY'
  )
    throw new Error('catalog_schema_invalid:loot_relation_type')
  return value
}

function relationTargetId(type: LootRelationType, value: string): string {
  if (type === 'THEME_CATEGORY') return categoryId(value)
  return value
}

function lootUnitKind(value: string): LootUnitKind {
  if (value === 'lb') return 'weight'
  if (value === 'lb/sq yd') return 'area_weight'
  if (value === 'pint') return 'liquid_pint'
  if (value === 'fl oz') return 'liquid_fl_oz'
  return 'count'
}

function lootPlacement(value: string | null): LootPlacement {
  return value === 'worn' || value === 'handheld' ? value : null
}

function lootValueForm(value: string | null): LootValueForm {
  if (value === null) return null
  if (value === 'Quantity_Good') return 'quantity_good'
  throw new Error('catalog_schema_invalid:value_form')
}

function categoryId(value: string): LootCategoryId {
  if (value.startsWith('category:')) return categoryIdFromRelation(value)
  const id = categoryIdsBySourceValue[value]
  if (!id) throw new Error('catalog_schema_invalid:category')
  return id
}

function categoryIdFromRelation(value: string): LootCategoryId {
  if (!isCategoryId(value))
    throw new Error('catalog_schema_invalid:category_id')
  return value
}

function isCategoryId(value: string): value is LootCategoryId {
  return /^category:[a-z0-9-]+$/.test(value)
}

function profileId(value: string): LootProfileId {
  const id = profileIdsBySourceValue[value]
  if (!id) throw new Error('catalog_schema_invalid:profile')
  return id
}

function profileIdFromRelation(value: string): LootProfileId {
  if (!isProfileId(value)) throw new Error('catalog_schema_invalid:profile_id')
  return value
}

function isProfileId(value: string): value is LootProfileId {
  return /^profile:[a-z0-9-]+$/.test(value)
}

function adornmentTypeId(value: string): LootAdornmentTypeId {
  const id = adornmentTypeIdsBySourceValue[value]
  if (!id) throw new Error('catalog_schema_invalid:adornment_type')
  return id
}

function lootTypeId(value: string): LootTypeId {
  const id = lootTypeIdsBySourceValue[value]
  if (!id) throw new Error('catalog_schema_invalid:loot_type')
  return id
}

function modifierLootTypeId(value: string): LootTypeId | 'all' {
  return value === 'all' ? 'all' : lootTypeId(value)
}

function curseAppliesToId(value: string): 'all' | LootCategoryId | MagicTypeId {
  if (value === 'all') return 'all'
  if (value.startsWith('category:')) return categoryIdFromRelation(value)
  const id = magicTypeIdsBySourceValue[value.replace(/^magic-type:/, '')]
  if (!id) throw new Error('catalog_schema_invalid:curse_applies_to')
  return id
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

const categoryIdsBySourceValue: Readonly<Record<string, LootCategoryId>> = {
  Ammunition: 'category:ammunition',
  Arcane_Focus: 'category:arcane-focus',
  Art_Object: 'category:art-object',
  Book_Document: 'category:book-document',
  Camp_Gear: 'category:camp-gear',
  Clothing: 'category:clothing',
  Component_Material: 'category:component-material',
  Druidic_Focus: 'category:druidic-focus',
  Equipment_Pack: 'category:equipment-pack',
  Exploration_Gear: 'category:exploration-gear',
  Firearm: 'category:firearm',
  Gemstone: 'category:gemstone',
  Hazard_Item: 'category:hazard-item',
  Heavy_Armor: 'category:heavy-armor',
  Holy_Symbol: 'category:holy-symbol',
  Ingot: 'category:ingot',
  Instrument: 'category:instrument',
  Light_Armor: 'category:light-armor',
  Light_Fire_Gear: 'category:light-fire-gear',
  Livestock: 'category:livestock',
  Martial_Melee_Weapon: 'category:martial-melee-weapon',
  Martial_Ranged_Weapon: 'category:martial-ranged-weapon',
  Medium_Armor: 'category:medium-armor',
  Mount: 'category:mount',
  Mount_Gear: 'category:mount-gear',
  Poison: 'category:poison',
  Potion: 'category:potion',
  Restraint_Trap_Gear: 'category:restraint-trap-gear',
  Ritual_Item: 'category:ritual-item',
  Shield: 'category:shield',
  Siege_Gear: 'category:siege-gear',
  Simple_Melee_Weapon: 'category:simple-melee-weapon',
  Simple_Ranged_Weapon: 'category:simple-ranged-weapon',
  Survival_Supply: 'category:survival-supply',
  Tool: 'category:tool',
  Trade_Good: 'category:trade-good',
  Utility_Gear: 'category:utility-gear',
  Vehicle_Air_Space: 'category:vehicle-air-space',
  Vehicle_Land: 'category:vehicle-land',
  Vehicle_Water: 'category:vehicle-water'
}

const profileIdsBySourceValue: Readonly<Record<string, LootProfileId>> = {
  ammunition: 'profile:ammunition',
  arcane_focus: 'profile:arcane-focus',
  armor: 'profile:armor',
  art_object: 'profile:art-object',
  blade_weapon: 'profile:blade-weapon',
  book: 'profile:book',
  druidic_focus: 'profile:druidic-focus',
  firearm: 'profile:firearm',
  gear: 'profile:gear',
  holy_symbol: 'profile:holy-symbol',
  instrument: 'profile:instrument',
  mount_gear: 'profile:mount-gear',
  pack_or_case: 'profile:pack-or-case',
  ranged_weapon: 'profile:ranged-weapon',
  relic: 'profile:relic',
  shield: 'profile:shield',
  textile: 'profile:textile',
  tool: 'profile:tool',
  utility_object: 'profile:utility-object'
}

const adornmentTypeIdsBySourceValue: Readonly<
  Record<string, LootAdornmentTypeId>
> = {
  gem: 'adornment:gem',
  inlay: 'adornment:inlay',
  metal: 'adornment:metal',
  textile: 'adornment:textile'
}

const lootTypeIdsBySourceValue: Readonly<Record<string, LootTypeId>> = {
  livestock: 'loot-type:livestock',
  material: 'loot-type:material',
  object: 'loot-type:object',
  vehicle: 'loot-type:vehicle'
}

const magicTypeIdsBySourceValue: Readonly<Record<string, MagicTypeId>> = {
  Arcana: 'magic-type:arcana',
  Armaments: 'magic-type:armaments',
  Implements: 'magic-type:implements',
  Relics: 'magic-type:relics'
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
