export type VisualGoldenEntry = Readonly<{
  name: string
  suite: string
  selector: string
  viewport: Readonly<{ width: number; height: number }>
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

export function parseVisualGoldenUpdateArguments(
  arguments_: readonly string[],
  entries: readonly VisualGoldenEntry[]
): ReadonlySet<string> {
  const normalizedArguments =
    arguments_[0] === '--' ? arguments_.slice(1) : arguments_
  const names: string[] = []
  for (let index = 0; index < normalizedArguments.length; index += 1) {
    if (normalizedArguments[index] !== '--golden')
      throw new Error(
        `Unexpected visual-update argument: ${normalizedArguments[index]}`
      )
    const name = normalizedArguments[index + 1]
    if (!name || name.startsWith('--'))
      throw new Error('--golden requires an explicit name')
    names.push(name)
    index += 1
  }
  if (names.length === 0)
    throw new Error('At least one --golden <name> argument is required')
  return selectedVisualGoldens(names.join(','), entries)
}
