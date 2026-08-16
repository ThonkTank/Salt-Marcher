declare const entropyStreamBrand: unique symbol

export type EntropyStream = string & {
  readonly [entropyStreamBrand]: true
}

export type RewardBudgetStreamKind = 'magic-target' | 'group-magic-target'

export type TreasurePlanningStreamKind =
  | 'treasure-count'
  | 'loot-slots'
  | 'treasure-channel'
  | 'encounter-anchor'
  | 'theme'
  | 'group-theme'
  | 'group-loot-slots'

export type ItemSelectionStreamKind =
  'loot-item' | 'loot-form' | 'coin-profile' | 'modifier-chance' | 'modifier'

export type MagicSelectionStreamKind =
  | 'magic-item'
  | 'magic-variant'
  | 'magic-spell'
  | 'enspelled-rule'
  | 'enspelled-base'
  | 'enspelled-spell'
  | 'curse-chance'
  | 'curse'

export function encounterCandidateStream(
  seed: number,
  encounterNumber: number,
  candidateId: string
): EntropyStream {
  return encode(seed, `encounter:${encounterNumber}:${candidateId}`)
}

export function rewardBudgetStream(
  seed: number,
  kind: RewardBudgetStreamKind,
  ordinal: number
): EntropyStream {
  return encode(seed, kind, ordinal)
}

export function treasurePlanningStream(
  seed: number,
  kind: TreasurePlanningStreamKind,
  ordinal: string | number
): EntropyStream {
  return encode(seed, kind, ordinal)
}

export function slotRoleStream(
  seed: number,
  treasureId: string,
  slot: number
): EntropyStream {
  return encode(seed, `loot-role:${treasureId}`, slot)
}

export function itemSelectionStream(
  seed: number,
  kind: ItemSelectionStreamKind,
  treasureId: string,
  slot: number,
  candidateId?: string
): EntropyStream {
  const label = `${kind}:${treasureId}${kind === 'loot-item' ? `:${slot}` : ''}`
  return encode(seed, label, candidateId ?? slot)
}

export function magicSelectionStream(
  seed: number,
  kind: MagicSelectionStreamKind,
  subject: string,
  ordinal: number
): EntropyStream {
  return encode(seed, `${kind}:${subject}`, ordinal)
}

export function packingStream(
  seed: number,
  compatibilityKey: string,
  containerId: string
): EntropyStream {
  return encode(seed, `container:${compatibilityKey}`, containerId)
}

function encode(
  seed: number,
  label: string,
  ordinal?: string | number
): EntropyStream {
  const suffix = ordinal === undefined ? '' : `|${ordinal}`
  return `${seed}|${label}${suffix}` as EntropyStream
}
