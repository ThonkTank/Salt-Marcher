export type EncounterEntropy = Readonly<{
  modulo(stream: string, modulus: number): number
  unit(stream: string): number
}>

export function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
