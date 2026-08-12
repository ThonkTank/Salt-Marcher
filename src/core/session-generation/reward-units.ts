import {
  divide,
  multiply,
  rational,
  roundHalfUp,
  type Rational
} from './rational.js'

declare const unitBrand: unique symbol

type Unit<Name extends string, Value> = Readonly<{
  value: Value
  readonly [unitBrand]: Name
}>

export type PartyXp = Unit<'PartyXp', number>
export type BaseXp = Unit<'BaseXp', number>
export type AdjustedXp = Unit<'AdjustedXp', number>
export type RewardXp = Unit<'RewardXp', number>
export type CopperPieces = Unit<'CopperPieces', number>
export type PerCharacterXp = Unit<'PerCharacterXp', Rational>
export type GoldPerXp = Unit<'GoldPerXp', Rational>
export type MagicPerXp = Unit<'MagicPerXp', Rational>

export function partyXp(value: number): PartyXp {
  return integerUnit<'PartyXp'>(value, 'party_xp')
}

export function baseXp(value: number): BaseXp {
  return integerUnit<'BaseXp'>(value, 'base_xp')
}

export function adjustedXp(value: number): AdjustedXp {
  return integerUnit<'AdjustedXp'>(value, 'adjusted_xp')
}

export function rewardXp(value: number): RewardXp {
  return integerUnit<'RewardXp'>(value, 'reward_xp')
}

export function copperPieces(value: number): CopperPieces {
  return integerUnit<'CopperPieces'>(value, 'copper_pieces')
}

export function goldPerXp(value: Rational): GoldPerXp {
  return rationalUnit<'GoldPerXp'>(value)
}

export function magicPerXp(value: Rational): MagicPerXp {
  return rationalUnit<'MagicPerXp'>(value)
}

export function rewardXpFromPartyXp(value: PartyXp): RewardXp {
  return rewardXp(value.value)
}

export function rewardXpFromBaseXp(value: BaseXp): RewardXp {
  return rewardXp(value.value)
}

export function rewardXpFromAdjustedXp(value: AdjustedXp): RewardXp {
  return rewardXp(value.value)
}

export function perCharacterRewardXp(
  total: RewardXp,
  partyCount: number
): PerCharacterXp {
  if (!Number.isInteger(partyCount) || partyCount < 1)
    throw new Error('invalid_party_count')
  return rationalUnit<'PerCharacterXp'>(
    divide(rational(BigInt(total.value)), rational(BigInt(partyCount)))
  )
}

export function rewardGoldBudget(
  perCharacter: PerCharacterXp,
  rate: GoldPerXp
): CopperPieces {
  return copperPieces(
    Math.max(
      1,
      roundHalfUp(
        multiply(multiply(perCharacter.value, rate.value), rational(100n))
      )
    )
  )
}

export function rawMagicTarget(
  perCharacter: PerCharacterXp,
  rate: MagicPerXp
): Rational {
  return multiply(perCharacter.value, rate.value)
}

export function unitValue(value: PartyXp): number
export function unitValue(value: BaseXp): number
export function unitValue(value: AdjustedXp): number
export function unitValue(value: RewardXp): number
export function unitValue(value: CopperPieces): number
export function unitValue(
  value: PartyXp | BaseXp | AdjustedXp | RewardXp | CopperPieces
): number {
  return value.value
}

function integerUnit<Name extends string>(
  value: number,
  code: string
): Unit<Name, number> {
  if (!Number.isInteger(value) || value < 0) throw new Error(`invalid_${code}`)
  return Object.freeze({ value }) as Unit<Name, number>
}

function rationalUnit<Name extends string>(
  value: Rational
): Unit<Name, Rational> {
  return Object.freeze({
    value: Object.freeze({ ...value })
  }) as Unit<Name, Rational>
}
