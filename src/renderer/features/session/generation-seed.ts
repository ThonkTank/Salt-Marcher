const e2eSeeds = [9_003, 41_337, 73_001, 91_117] as const
let e2eSeedIndex = 0

/** Keeps production entropy private while making visual E2E runs repeatable. */
export function generationSeed(deterministicE2e = false): number {
  if (deterministicE2e) {
    const base = e2eSeeds[e2eSeedIndex % e2eSeeds.length]!
    const cycle = Math.floor(e2eSeedIndex / e2eSeeds.length)
    e2eSeedIndex += 1
    return base + cycle
  }
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0]!
}
