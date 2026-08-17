declare const entropyStreamBrand: unique symbol

export type EntropyStream = string & {
  readonly [entropyStreamBrand]: true
}

export function encounterCandidateStream(
  seed: number,
  encounterNumber: number,
  candidateId: string
): EntropyStream {
  return encode(seed, `encounter:${encounterNumber}:${candidateId}`)
}

function encode(
  seed: number,
  label: string,
  ordinal?: string | number
): EntropyStream {
  const suffix = ordinal === undefined ? '' : `|${ordinal}`
  return `${seed}|${label}${suffix}` as EntropyStream
}
