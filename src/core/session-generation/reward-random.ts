import { REWARD_ENGINE_VERSION } from '../../shared/contracts/session-generation.js'
import type { EncounterEntropy } from './deterministic-order.js'
import type { EntropyStream } from './entropy-streams.js'

/** The complete injected random boundary for reward generation. */
export type RewardRandom = Readonly<{
  unit(label: string, ordinal?: string | number): number
  modulo(label: string, ordinal: string | number, modulus: number): number
}>

export function createRewardRandom(
  seed: number,
  entropy: EncounterEntropy
): RewardRandom {
  const stream = (label: string, ordinal?: string | number): EntropyStream => {
    const suffix = ordinal === undefined ? '' : `|${ordinal}`
    return `${REWARD_ENGINE_VERSION}|${seed}|${label}${suffix}` as EntropyStream
  }
  return Object.freeze({
    unit: (label: string, ordinal?: string | number) =>
      entropy.unit(stream(label, ordinal)),
    modulo: (label: string, ordinal: string | number, modulus: number) =>
      entropy.modulo(stream(label, ordinal), modulus)
  })
}
