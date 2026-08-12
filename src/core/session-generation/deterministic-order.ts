import type { EntropyStream } from './entropy-streams.js'

export type EncounterEntropy = Readonly<{
  modulo(stream: EntropyStream, modulus: number): number
  unit(stream: EntropyStream): number
}>

export function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
