import type {
  ItemDefinition,
  ItemReference
} from '../../shared/contracts/loot.js'
import type { LootTheme } from './loot-catalog.js'

export const lootRoles = [
  'compact_value',
  'complex_value',
  'useful',
  'flavor'
] as const

export type LootRole = (typeof lootRoles)[number]

export type RewardTreasurePlan = Readonly<{
  id: string
  stockClass: 'normal' | 'overstock'
  rewardChannel: 'encounter' | 'quest' | 'environment'
  anchorEncounterNumber: number | null
  theme: LootTheme
  targetValueCp: number
}>

export type RolePlannedTreasure = RewardTreasurePlan &
  Readonly<{
    roles: readonly LootRole[]
  }>

export type RewardItemDraft = Readonly<{
  id: string
  treasureId: string
  itemReference: ItemReference
  definition: ItemDefinition
  role: 'compact_value' | 'complex_value' | 'useful' | 'flavor' | 'magic'
  quantity: number
}>

export type SelectedTreasureDraft = RewardTreasurePlan &
  Readonly<{
    items: readonly RewardItemDraft[]
  }>

export function freezeStage<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      freezeStage(child)
  }
  return value
}
