export const iterationAreas = [
  'characters',
  'encounter',
  'combat',
  'loot'
] as const

export type IterationArea = (typeof iterationAreas)[number]

export type IterationOptions = Readonly<{
  area: IterationArea
  checkOnly: boolean
}>

export function parseIterationArguments(
  arguments_: readonly string[]
): IterationOptions {
  const checkOnly = arguments_.includes('--check-only')
  const positional = arguments_.filter(
    (argument) => argument !== '--check-only'
  )
  const area = positional[0]
  if (
    positional.length !== 1 ||
    area === undefined ||
    !iterationAreas.includes(area as IterationArea)
  )
    throw new Error(
      `Usage: pnpm iterate <${iterationAreas.join('|')}> [--check-only]`
    )
  return { area: area as IterationArea, checkOnly }
}

export function iterationIdentity(
  area: IterationArea,
  commit: string,
  dirty: boolean
): string {
  if (!/^[0-9a-f]{40}$/.test(commit))
    throw new Error('Iteration identity requires a full lowercase Git commit')
  return `${area}@${commit.slice(0, 12)}${dirty ? '+dirty' : ''}`
}
