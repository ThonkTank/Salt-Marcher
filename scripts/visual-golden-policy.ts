export type VisualGoldenEntry = Readonly<{
  name: string
  suite: string
  selector: string
  viewport: Readonly<{ width: number; height: number }>
}>

export type VisualGoldenUpdateSelection = Readonly<{
  names: ReadonlySet<string>
  suite: string
  reuseBuild: boolean
}>

export function validateVisualGoldenSuites(
  entries: readonly VisualGoldenEntry[],
  suiteNames: ReadonlySet<string>
): void {
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.name))
      throw new Error(`Duplicate visual golden name: ${entry.name}`)
    seen.add(entry.name)
    if (!suiteNames.has(entry.suite))
      throw new Error(
        `Visual golden ${entry.name} references unknown E2E suite ${entry.suite}.`
      )
  }
}

export function selectedVisualGoldens(
  value: string | undefined,
  entries: readonly VisualGoldenEntry[]
): ReadonlySet<string> {
  if (value === undefined || value.trim() === '') return new Set()
  if (value.trim() === '1')
    throw new Error(
      'Unrestricted UPDATE_VISUAL_GOLDENS=1 is forbidden; name each golden explicitly.'
    )
  const names = new Set(
    value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
  )
  const known = new Set(entries.map((entry) => entry.name))
  for (const name of names)
    if (!known.has(name)) throw new Error(`Unknown visual golden: ${name}`)
  return names
}

export function visualGoldenBaselineDirectoryNames(
  variant: string | undefined
): readonly string[] {
  const normalized = variant?.trim()
  if (!normalized) return ['linux']
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(normalized))
    throw new Error(`Invalid visual golden variant: ${variant}`)
  return [`linux-${normalized}`, 'linux']
}

export function parseVisualGoldenUpdateArguments(
  arguments_: readonly string[],
  entries: readonly VisualGoldenEntry[]
): VisualGoldenUpdateSelection {
  const normalizedArguments =
    arguments_[0] === '--' ? arguments_.slice(1) : arguments_
  const names: string[] = []
  let suite: string | undefined
  let reuseBuild = false
  for (let index = 0; index < normalizedArguments.length; index += 1) {
    const argument = normalizedArguments[index]
    if (argument === '--reuse-build') {
      if (reuseBuild) throw new Error('--reuse-build may be specified once')
      reuseBuild = true
      continue
    }
    if (argument !== '--golden' && argument !== '--suite')
      throw new Error(`Unexpected visual-update argument: ${argument}`)
    const value = normalizedArguments[index + 1]
    if (!value || value.startsWith('--'))
      throw new Error(`${argument} requires an explicit value`)
    if (argument === '--golden') names.push(value)
    else {
      if (suite !== undefined) throw new Error('--suite may be specified once')
      suite = value
    }
    index += 1
  }
  if (names.length !== 1)
    throw new Error('Exactly one --golden <name> argument is required')
  if (!suite) throw new Error('Exactly one --suite <name> is required')
  const selected = selectedVisualGoldens(names.join(','), entries)
  const golden = entries.find((entry) => entry.name === names[0])!
  if (golden.suite !== suite)
    throw new Error(
      `Visual golden ${golden.name} belongs to suite ${golden.suite}, not ${suite}.`
    )
  return { names: selected, suite, reuseBuild }
}
