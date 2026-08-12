import type {
  GeneratedLootItem,
  GeneratedTreasure
} from '../../../shared/contracts/session-generation.js'
import { formatCopper } from '../../presenters/money.js'

export function generatedItemText(item: GeneratedLootItem): string {
  if (item.magic)
    return `${item.name}${item.rarity ? ` [${item.rarity}]` : ''}${
      item.curseName ? ' · verflucht' : ''
    }`
  if (item.role === 'compact_value' && item.unitValueCp === 1)
    return `${item.quantity} KM`
  const value = formatCopper(item.unitValueCp)
  return item.quantity > 1
    ? `${item.quantity}× ${item.name} [je ${value}]`
    : `${item.name} [${value}]`
}

export function generatedTreasureSummary(treasure: GeneratedTreasure): string {
  return `${generatedTreasureLabel(treasure, 1)}: ${treasure.items
    .map(generatedItemText)
    .join(', ')}`
}

export function generatedTreasureLabel(
  treasure: GeneratedTreasure,
  ordinal: number
): string {
  return generatedRewardLabel(
    treasure.rewardChannel,
    treasure.anchorEncounterNumber,
    ordinal
  )
}

export function generatedRewardLabel(
  rewardChannel: GeneratedTreasure['rewardChannel'],
  anchorEncounterNumber: number | null,
  ordinal: number
): string {
  const channel =
    rewardChannel === 'encounter'
      ? `Encounter ${String(anchorEncounterNumber ?? ordinal)}`
      : rewardChannel === 'quest'
        ? 'Quest'
        : 'Umgebung'
  return `Fund ${String(ordinal)} · ${channel}`
}
