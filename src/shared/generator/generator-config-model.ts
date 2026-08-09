export const maximumGeneratorCandidateCount = 250_000

export const generatorRoles = [
  'minion',
  'support',
  'standard',
  'elite',
  'boss'
] as const
export type GeneratorRole = (typeof generatorRoles)[number]
export type GeneratorRoleCell = 'none' | GeneratorRole

export const generatorChallengeRatings = [
  '0',
  '1/8',
  '1/4',
  '1/2',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30'
] as const

export type GeneratorRoleMatrix = GeneratorRoleCell[][]

export function canonicalGeneratorConfigJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(canonicalGeneratorConfigJson).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalGeneratorConfigJson((value as Record<string, unknown>)[key])}`
      )
      .join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

type CompositionComplexityInput = Readonly<{
  roleMatrix: GeneratorRoleMatrix
  roleQuantities: Readonly<
    Record<GeneratorRole, Readonly<{ min: number; max: number }>>
  >
  roleCombinations: readonly (readonly GeneratorRole[])[]
  crBlocks: Readonly<{ min: number; max: number }>
}>

export function roleAt(
  matrix: GeneratorRoleMatrix,
  partyLevel: number,
  challengeRatingIndex: number
): GeneratorRoleCell {
  return matrix[partyLevel - 1]?.[challengeRatingIndex] ?? 'none'
}

export function updateRoleCell(
  matrix: GeneratorRoleMatrix,
  partyLevel: number,
  challengeRatingIndex: number,
  role: GeneratorRoleCell
): GeneratorRoleMatrix {
  return matrix.map((row, level) =>
    level === partyLevel - 1
      ? row.map((cell, cr) => (cr === challengeRatingIndex ? role : cell))
      : row
  )
}

export function maximumCompositionComplexity(
  config: CompositionComplexityInput
): { partyLevel: number; count: number } {
  let maximum = { partyLevel: 1, count: 0 }
  for (const [level, row] of config.roleMatrix.entries()) {
    const variants = Object.fromEntries(
      generatorRoles.map((role) => [
        role,
        row.filter((cell) => cell === role).length *
          (config.roleQuantities[role].max -
            config.roleQuantities[role].min +
            1)
      ])
    ) as Record<GeneratorRole, number>
    const count = config.roleCombinations
      .filter(
        (roles) =>
          roles.length >= config.crBlocks.min &&
          roles.length <= config.crBlocks.max
      )
      .reduce(
        (sum, roles) =>
          sum + roles.reduce((product, role) => product * variants[role], 1),
        0
      )
    if (count > maximum.count) maximum = { partyLevel: level + 1, count }
  }
  return maximum
}
