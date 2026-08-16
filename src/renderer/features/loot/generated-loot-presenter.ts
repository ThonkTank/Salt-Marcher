import type {
  GeneratedRun,
  GeneratedLootItem,
  GeneratedTreasure
} from '../../../shared/contracts/session-generation.js'
import { formatCopper } from '../../presenters/money.js'

export function generatedItemText(
  run: GeneratedRun,
  item: GeneratedLootItem
): string {
  const definition = generatedItemDefinition(run, item)
  if (definition.magic)
    return `${definition.name}${definition.rarity ? ` [${definition.rarity}]` : ''}${
      definition.curse ? ' · verflucht' : ''
    }`
  if (item.role === 'compact_value' && definition.unitValueCp === 1)
    return `${item.quantity} KM`
  const value = formatCopper(definition.unitValueCp)
  return item.quantity > 1
    ? `${item.quantity}× ${definition.name} [je ${value}]`
    : `${definition.name} [${value}]`
}

export function generatedTreasureSummary(
  run: GeneratedRun,
  treasure: GeneratedTreasure
): string {
  return `${generatedTreasureLabel(treasure, 1)}: ${treasure.items
    .map((item) => generatedItemText(run, item))
    .join(', ')}`
}

export function generatedItemDefinition(
  run: GeneratedRun,
  item: GeneratedLootItem
) {
  return generatedItemDefinitionFromList(run.id, run.itemDefinitions, item)
}

export function generatedItemDefinitionFromList(
  runId: string,
  definitions: GeneratedRun['itemDefinitions'],
  item: GeneratedLootItem
) {
  const reference = item.itemReference
  if (reference.kind !== 'generated' || reference.runId !== runId)
    throw new Error('Generated item reference is not owned by the run')
  const definition = definitions.find(
    (candidate) =>
      candidate.reference.kind === 'generated' &&
      candidate.reference.definitionId === reference.definitionId
  )
  if (!definition) throw new Error('Generated item definition is missing')
  return definition
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
