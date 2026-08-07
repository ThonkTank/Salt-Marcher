export type BundleBaselineUpdateReason = Readonly<{
  reason: string
  dependencyRationale: string
  chunkRationale: string
}>

export function parseBundleBaselineUpdateArguments(
  arguments_: readonly string[]
): BundleBaselineUpdateReason {
  const normalizedArguments =
    arguments_[0] === '--' ? arguments_.slice(1) : arguments_
  const values = new Map<string, string>()
  for (let index = 0; index < normalizedArguments.length; index += 1) {
    const key = normalizedArguments[index]
    if (!key?.startsWith('--'))
      throw new Error(`Unexpected bundle-baseline argument: ${key ?? ''}`)
    const value = normalizedArguments[index + 1]
    if (!value || value.startsWith('--'))
      throw new Error(`Missing value for ${key}`)
    if (values.has(key)) throw new Error(`Duplicate argument: ${key}`)
    values.set(key, value.trim())
    index += 1
  }
  const required = [
    ['--reason', 'reason'],
    ['--dependency', 'dependency rationale'],
    ['--chunk', 'chunk rationale']
  ] as const
  for (const [key, label] of required)
    if (!values.get(key))
      throw new Error(`Missing ${label}: ${key} is required`)
  for (const key of values.keys())
    if (!required.some(([allowed]) => allowed === key))
      throw new Error(`Unknown bundle-baseline argument: ${key}`)
  return {
    reason: values.get('--reason')!,
    dependencyRationale: values.get('--dependency')!,
    chunkRationale: values.get('--chunk')!
  }
}
