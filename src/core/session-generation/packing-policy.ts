import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import type { LootPlacement, LootUnitKind } from './loot-catalog.js'

export type PackingViolationCode =
  | 'container_not_allowed'
  | 'loose_placement_not_allowed'
  | 'unnecessary_container'

export type PackingPolicyInput = Readonly<{
  capacity: number
  quantity: number
  allowedContainerIds: readonly string[]
  placement: LootPlacement
  unitKind: LootUnitKind
}>

export type PackingEvaluation = Readonly<{
  valid: boolean
  placement: 'loose' | 'container' | 'pile'
  violationCode: PackingViolationCode | null
}>

export function packingAllowedContainerIds(
  input: PackingPolicyInput,
  rules: GeneratorLootRules
): ReadonlySet<string> {
  const ids = new Set(input.allowedContainerIds)
  if (
    input.quantity >= rules.packing.pileMinQty &&
    input.unitKind !== 'liquid_pint' &&
    input.unitKind !== 'liquid_fl_oz'
  )
    ids.add('container:pile')
  return ids
}

export function evaluatePacking(
  input: PackingPolicyInput,
  catalogContainerId: string | null,
  rules: GeneratorLootRules
): PackingEvaluation {
  if (input.capacity <= 0)
    return catalogContainerId === null
      ? { valid: true, placement: 'loose', violationCode: null }
      : {
          valid: false,
          placement: 'container',
          violationCode: 'unnecessary_container'
        }
  const allowed = packingAllowedContainerIds(input, rules)
  if (catalogContainerId !== null) {
    const valid = allowed.has(catalogContainerId)
    return {
      valid,
      placement: catalogContainerId === 'container:pile' ? 'pile' : 'container',
      violationCode: valid ? null : 'container_not_allowed'
    }
  }
  const amountUnit = input.unitKind !== 'count'
  const valid =
    input.allowedContainerIds.length === 0 ||
    (input.quantity <= rules.packing.loosePlacementMaxQty &&
      (input.placement === 'worn' ||
        input.placement === 'handheld' ||
        (!amountUnit &&
          input.capacity >= rules.packing.looseNonAmountMinCapacity)))
  return {
    valid,
    placement: 'loose',
    violationCode: valid ? null : 'loose_placement_not_allowed'
  }
}
