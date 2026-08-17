export function shuffledSuiteOrder<Value>(
  values: readonly Value[],
  seed: number
): Value[] {
  if (!Number.isSafeInteger(seed) || seed < 0)
    throw new Error('E2E shuffle seed must be a non-negative safe integer.')
  const result = [...values]
  let state = seed || 1
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target]!, result[index]!]
  }
  return result
}
