export type LootRuleEditorKind =
  'number' | 'percentage' | 'text' | 'select' | 'readonly'

export type LootRuleFieldMetadata = Readonly<{
  label: string
  help: string
  editor: LootRuleEditorKind
  unit: string | null
  min?: number
  max?: number
  step?: number
  options?: readonly string[]
  dependencies: readonly string[]
  effect: LootRuleEffect
}>

export type LootRuleEffect = Readonly<{
  kind: 'generation'
  owners: readonly string[]
}>

const effectOwners = {
  progression: ['reward-budget-stage.ts'],
  treasure: ['treasure-planning-stage.ts', 'slot-role-stage.ts'],
  mix: ['slot-role-stage.ts', 'non-magic-selection-stage.ts'],
  selection: ['non-magic-selection-stage.ts'],
  quantityLimits: ['non-magic-selection-stage.ts'],
  coins: [
    'non-magic-selection-stage.ts',
    'packing-stage.ts',
    'reward-aggregation-stage.ts'
  ],
  packing: [
    'packing-policy.ts',
    'packing-stage.ts',
    'non-magic-selection-stage.ts'
  ],
  magic: ['magic-selection-stage.ts'],
  balance: ['slot-role-stage.ts', 'non-magic-selection-stage.ts'],
  audit: ['reward-aggregation-stage.ts']
} as const

export function lootRuleEffect(
  path: readonly (string | number)[]
): LootRuleEffect | null {
  const root = String(path[0]) as keyof typeof effectOwners
  const owners = effectOwners[root]
  return owners
    ? Object.freeze({ kind: 'generation', owners: Object.freeze([...owners]) })
    : null
}

export type LootRuleDraftIssue = Readonly<{
  code:
    | 'not_finite'
    | 'below_minimum'
    | 'above_maximum'
    | 'not_integer'
    | 'empty_value'
    | 'duplicate_value'
    | 'share_sum'
    | 'invalid_order'
    | 'invalid_progression'
  path: readonly (string | number)[]
  message: string
}>

const fieldLabels: Readonly<Record<string, string>> = {
  Adorned: 'Verziert',
  Art_Object: 'Kunstobjekt',
  Bulk_Good: 'Sperriges Gut',
  Clothing: 'Kleidung',
  Coinage: 'Münzen',
  Common: 'Gewöhnlich',
  Compact_Good: 'Kompaktes Gut',
  Gemstone: 'Edelstein',
  Ingot: 'Barren',
  Legendary: 'Legendär',
  Livestock: 'Nutztier',
  Rare: 'Selten',
  Uncommon: 'Ungewöhnlich',
  'Very Rare': 'Sehr selten',
  ammunition: 'Munition',
  artObject: 'Kunstobjekt',
  categoryStrength: 'Kategorien-Wiederholungsabzug',
  coinsPerCapacityUnit: 'Münzen je Kapazitätseinheit',
  compactValue: 'Kompakter Wert',
  complexValue: 'Komplexer Wert',
  containerMaxCountFactor: 'Maximale Containeranzahl je Gegenstand',
  contextBulkMinLb: 'Schwelle für sperrige Güter',
  curseChance: 'Fluchchance',
  duplicatePenalty: 'Duplikatabzug',
  encounter: 'Encounter',
  encounterTreasureRatio: 'Encounter-Schatzanteil',
  enhancedCapMax: 'Maximal verzierte Slots',
  enhancedCapMin: 'Minimal verzierte Slots',
  enhancedCapMultiplier: 'Teiler für verzierte Slots',
  environment: 'Umgebung',
  fallback: 'Standardgrenze',
  fitWeight: 'Budgettreue-Gewicht',
  flavor: 'Atmosphäre',
  gemstone: 'Edelsteine',
  goldAtLevelCp: 'Zielwert',
  hazardItem: 'Gefahrengegenstände',
  ingot: 'Barren',
  jitterWeight: 'Zufallsgewicht',
  level: 'Stufe',
  looseNonAmountMinCapacity: 'Mindestkapazität für lose Einzelstücke',
  loosePlacementMaxQty: 'Maximal lose platzierte Menge',
  maxBudgetCp: 'Maximales Budget',
  maxLowCount: 'Maximale kleine Münzen',
  maxMiddleCount: 'Maximale mittlere Münzen',
  maxOverfit: 'Maximale Budgetüberschreitung',
  minBaseExtraCp: 'Minimaler Basisaufschlag',
  minFit: 'Minimale Budgetdeckung',
  minLowCount: 'Minimale kleine Münzen',
  minimumFillRatio: 'Minimale Containerfüllung',
  minimumRoleWeight: 'Minimales Rollengewicht',
  nearBestGap: 'Abstand zur besten Auswahl',
  normalBudgetTolerance: 'Budgettoleranz',
  overstockShare: 'Überbestandsanteil',
  pileMinQty: 'Mindestmenge für einen Stapel',
  pluralLabel: 'Mehrzahl',
  poison: 'Gifte',
  potion: 'Tränke',
  preferredBaseExtraCp: 'Bevorzugter Basisaufschlag',
  quantityGood: 'Mengengüter',
  quest: 'Quest',
  roleStrength: 'Rollen-Wiederholungsabzug',
  shortlistSize: 'Auswahllistengröße',
  singularLabel: 'Einzahl',
  slotMax: 'Maximale Slots',
  slotMin: 'Minimale Slots',
  slotTarget: 'Ziel-Slots',
  themeWeight: 'Themengewicht',
  tradeGood: 'Handelsgüter',
  treasureCountVariance: 'Schatzanzahl-Varianz',
  treasuresPerAdventureDay: 'Schätze je Abenteuertag',
  useful: 'Nützlich',
  valueCp: 'Wert',
  variantShortlistSize: 'Variantenlistengröße',
  xpAtLevel: 'XP-Schwelle'
}

const groupLabels: Readonly<Record<string, string>> = {
  adornedBase: 'Verzierte Basisgegenstände',
  adornedComponent: 'Verzierungskomponenten',
  adornedModifier: 'Verzierungsmodifikatoren',
  allowedContainerIds: 'Zulässige Container',
  audit: 'Prüfgrenzen',
  balance: 'Wiederholungsbalance',
  carrier: 'Wertträger',
  channels: 'Belohnungskanäle',
  coinage: 'Münzauswahl',
  coins: 'Münzen',
  compactForms: 'Kompakte Wertformen',
  complexForms: 'Komplexe Wertformen',
  cp: 'Kupfermünzen',
  denominations: 'Münzarten',
  ep: 'Elektrum',
  epSp: 'Elektrum/Silber',
  epSpCp: 'Elektrum/Silber/Kupfer',
  flavor: 'Atmosphärische Gegenstände',
  gp: 'Gold',
  gpEp: 'Gold/Elektrum',
  gpEpSp: 'Gold/Elektrum/Silber',
  gpSp: 'Gold/Silber',
  magic: 'Magische Gegenstände',
  magicPerXp: 'Magische Gegenstände je XP',
  mix: 'Zusammensetzung',
  packing: 'Verpackung',
  pp: 'Platin',
  ppGp: 'Platin/Gold',
  ppGpEp: 'Platin/Gold/Elektrum',
  ppGpSp: 'Platin/Gold/Silber',
  profiles: 'Münzprofile',
  progression: 'Stufenprogression',
  quantityLimits: 'Mengengrenzen',
  roles: 'Slotrollen',
  selection: 'Auswahlregeln',
  sp: 'Silber',
  spCp: 'Silber/Kupfer',
  treasure: 'Schatzplanung',
  useful: 'Nützliche Gegenstände'
}

const percentageFields = new Set([
  'curseChance',
  'encounterTreasureRatio',
  'maxOverfit',
  'minFit',
  'minimumFillRatio',
  'nearBestGap',
  'normalBudgetTolerance',
  'overstockShare'
])
const weightedShareParents = new Set([
  'channels',
  'compactForms',
  'complexForms',
  'roles'
])
const integerFields = new Set([
  'ammunition',
  'artObject',
  'enhancedCapMax',
  'enhancedCapMin',
  'fallback',
  'gemstone',
  'goldAtLevelCp',
  'hazardItem',
  'ingot',
  'level',
  'loosePlacementMaxQty',
  'maxBudgetCp',
  'maxLowCount',
  'maxMiddleCount',
  'minBaseExtraCp',
  'minLowCount',
  'pileMinQty',
  'poison',
  'potion',
  'preferredBaseExtraCp',
  'quantityGood',
  'shortlistSize',
  'slotMax',
  'slotMin',
  'slotTarget',
  'tradeGood',
  'treasureCountVariance',
  'treasuresPerAdventureDay',
  'valueCp',
  'variantShortlistSize',
  'xpAtLevel'
])
const positiveIntegerFields = new Set([
  'ammunition',
  'artObject',
  'fallback',
  'gemstone',
  'hazardItem',
  'ingot',
  'maxBudgetCp',
  'pileMinQty',
  'poison',
  'potion',
  'quantityGood',
  'shortlistSize',
  'slotMax',
  'slotMin',
  'slotTarget',
  'tradeGood',
  'treasuresPerAdventureDay',
  'valueCp'
])
const weightFields = new Set([
  'categoryStrength',
  'duplicatePenalty',
  'fitWeight',
  'jitterWeight',
  'roleStrength',
  'themeWeight'
])

export function lootRuleGroupLabel(key: string): string | null {
  return groupLabels[key] ?? null
}

export function lootRuleFieldMetadata(
  path: readonly (string | number)[],
  value: unknown
): LootRuleFieldMetadata | null {
  const last = path.at(-1)
  const key = String(last)
  const parent = String(path.at(-2) ?? '')
  const baseLabel = fieldLabels[key] ?? groupLabels[parent]
  const label =
    baseLabel && typeof last === 'number'
      ? `${baseLabel} ${String(last + 1)}`
      : baseLabel
  if (!label) return null
  const effect = lootRuleEffect(path)
  if (!effect) return null
  const percentage =
    percentageFields.has(key) || weightedShareParents.has(parent)
  const stringValue = typeof value === 'string'
  const denomination = stringValue && parent === 'denominations'
  const readonly = key === 'level' && path[0] === 'progression'
  const integer = integerFields.has(key)
  const bounds = numericBounds(key, percentage, integer)
  return Object.freeze({
    label,
    help: `Legt „${label}“ für dieses Generator-Preset fest.`,
    editor: readonly
      ? 'readonly'
      : denomination
        ? 'select'
        : stringValue
          ? 'text'
          : percentage
            ? 'percentage'
            : 'number',
    unit: percentage
      ? '%'
      : key.endsWith('Cp') || key === 'valueCp'
        ? 'KM'
        : key.includes('Lb')
          ? 'lb'
          : null,
    ...(typeof value === 'number' ? bounds : {}),
    ...(denomination
      ? { options: ['pp', 'gp', 'ep', 'sp', 'cp'] as const }
      : {}),
    dependencies:
      key === 'slotTarget'
        ? ['slotMin', 'slotMax']
        : key === 'maxLowCount'
          ? ['minLowCount']
          : key === 'preferredBaseExtraCp'
            ? ['minBaseExtraCp']
            : [],
    effect
  })
}

function numericBounds(
  key: string,
  percentage: boolean,
  integer: boolean
): Readonly<{ min: number; max?: number; step: number }> {
  if (percentage) return { min: 0, max: 1, step: 0.01 }
  if (key === 'level') return { min: 1, max: 20, step: 1 }
  if (integer)
    return {
      min: positiveIntegerFields.has(key) ? 1 : 0,
      max:
        key === 'xpAtLevel' || key === 'goldAtLevelCp'
          ? Number.MAX_SAFE_INTEGER
          : 1_000_000_000,
      step: 1
    }
  if (weightFields.has(key)) return { min: 0, max: 100, step: 0.01 }
  if (key === 'minimumRoleWeight')
    return { min: 0.000001, max: 1, step: 0.000001 }
  if (key === 'enhancedCapMultiplier')
    return { min: 0.01, max: 100, step: 0.01 }
  if (key === 'coinsPerCapacityUnit' || key === 'containerMaxCountFactor')
    return { min: 0.01, step: 0.01 }
  return { min: 0, step: 0.01 }
}

export function validateLootRuleDraft(
  value: unknown
): readonly LootRuleDraftIssue[] {
  const issues: LootRuleDraftIssue[] = []
  visit(value, [], issues)
  if (isRecord(value)) validateRelationships(value, issues)
  return Object.freeze(issues)
}

function visit(
  value: unknown,
  path: readonly (string | number)[],
  issues: LootRuleDraftIssue[]
): void {
  if (Array.isArray(value)) {
    if (value.length === 0) issue(issues, 'empty_value', path)
    if (
      (path.at(-1) === 'denominations' ||
        path.at(-1) === 'allowedContainerIds') &&
      new Set(value).size !== value.length
    )
      issue(issues, 'duplicate_value', path)
    value.forEach((entry, index) => visit(entry, [...path, index], issues))
    return
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value))
      visit(entry, [...path, key], issues)
    return
  }
  const metadata = lootRuleFieldMetadata(path, value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return issue(issues, 'not_finite', path)
    if (metadata?.min !== undefined && value < metadata.min)
      issue(issues, 'below_minimum', path)
    if (metadata?.max !== undefined && value > metadata.max)
      issue(issues, 'above_maximum', path)
    if (metadata?.step === 1 && !Number.isInteger(value))
      issue(issues, 'not_integer', path)
  } else if (typeof value === 'string' && value.trim().length === 0)
    issue(issues, 'empty_value', path)
}

function validateRelationships(
  value: Record<string, unknown>,
  issues: LootRuleDraftIssue[]
): void {
  for (const path of [
    ['treasure', 'channels'],
    ['mix', 'roles'],
    ['mix', 'compactForms'],
    ['mix', 'complexForms']
  ] as const) {
    const shares = at(value, path)
    if (
      isRecord(shares) &&
      Math.abs(
        Object.values(shares).reduce<number>(
          (sum, part) => sum + (typeof part === 'number' ? part : 0),
          0
        ) - 1
      ) > 1e-9
    )
      issue(issues, 'share_sum', path)
  }
  ordered(value, ['treasure'], 'slotMin', 'slotTarget', issues)
  ordered(value, ['treasure'], 'slotTarget', 'slotMax', issues)
  ordered(value, ['treasure'], 'enhancedCapMin', 'enhancedCapMax', issues)
  const progression = value['progression']
  if (
    !Array.isArray(progression) ||
    progression.length !== 20 ||
    progression.some((row, index) => {
      if (!isRecord(row) || row['level'] !== index + 1) return true
      if (index === 0) return false
      const previous: unknown = progression[index - 1]
      return (
        isRecord(previous) &&
        (Number(row['xpAtLevel']) <= Number(previous['xpAtLevel']) ||
          Number(row['goldAtLevelCp']) < Number(previous['goldAtLevelCp']))
      )
    })
  )
    issue(issues, 'invalid_progression', ['progression'])
  const profiles = at(value, ['coins', 'profiles'])
  if (isRecord(profiles))
    for (const [profileId, profile] of Object.entries(profiles))
      if (isRecord(profile))
        ordered(profile, [], 'minLowCount', 'maxLowCount', issues, [
          'coins',
          'profiles',
          profileId
        ])
  const selection = value['selection']
  if (isRecord(selection))
    for (const [policyId, policy] of Object.entries(selection))
      if (isRecord(policy))
        ordered(policy, [], 'minBaseExtraCp', 'preferredBaseExtraCp', issues, [
          'selection',
          policyId
        ])
}

function ordered(
  root: Record<string, unknown>,
  parentPath: readonly string[],
  lowerKey: string,
  upperKey: string,
  issues: LootRuleDraftIssue[],
  issuePrefix: readonly string[] = parentPath
): void {
  const parent = at(root, parentPath)
  if (
    isRecord(parent) &&
    typeof parent[lowerKey] === 'number' &&
    typeof parent[upperKey] === 'number' &&
    parent[lowerKey] > parent[upperKey]
  )
    issue(issues, 'invalid_order', [...issuePrefix, upperKey])
}

function at(root: Record<string, unknown>, path: readonly string[]): unknown {
  let cursor: unknown = root
  for (const key of path) cursor = isRecord(cursor) ? cursor[key] : undefined
  return cursor
}

function issue(
  issues: LootRuleDraftIssue[],
  code: LootRuleDraftIssue['code'],
  path: readonly (string | number)[]
): void {
  issues.push({ code, path, message: issueMessages[code] })
}

const issueMessages: Readonly<Record<LootRuleDraftIssue['code'], string>> = {
  not_finite: 'Bitte eine gültige Zahl eingeben.',
  below_minimum: 'Der Wert liegt unter dem zulässigen Minimum.',
  above_maximum: 'Der Wert liegt über dem zulässigen Maximum.',
  not_integer: 'Bitte eine ganze Zahl eingeben.',
  empty_value: 'Dieser Wert darf nicht leer sein.',
  duplicate_value: 'Einträge müssen eindeutig sein.',
  share_sum: 'Die Anteile müssen zusammen 100 % ergeben.',
  invalid_order: 'Minimum, Ziel und Maximum müssen aufsteigend sein.',
  invalid_progression: 'Die Progression muss 20 aufsteigende Stufen enthalten.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
