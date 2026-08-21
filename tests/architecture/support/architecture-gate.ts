import { readFileSync } from 'node:fs'
import { expect, it, type TestOptions } from 'vitest'

export const architectureGateClassifications = [
  'import-dependency-boundary',
  'typed-contract',
  'behavior-integration',
  'legitimate-literal',
  'fragile-source-regex'
] as const

export type ArchitectureGateClassification =
  (typeof architectureGateClassifications)[number]

export function architectureGate(
  classification: Exclude<
    ArchitectureGateClassification,
    'legitimate-literal' | 'fragile-source-regex'
  >,
  name: string,
  run: () => void | Promise<void>,
  options?: TestOptions
): void {
  it(`[${classification}] ${name}`, options ?? {}, run)
}

export type LegitimateLiteralGateInput = Readonly<{
  name: string
  path: string
  owner: string
  rationale: string
  inspect: (content: string) => void | Promise<void>
  options?: TestOptions
}>

export function legitimateLiteralGate(input: LegitimateLiteralGateInput): void {
  it(`[legitimate-literal] ${input.name}`, input.options ?? {}, async () => {
    expect(legitimateLiteralMetadataViolations(input)).toEqual([])
    await input.inspect(readFileSync(input.path, 'utf8'))
  })
}

export function legitimateLiteralMetadataViolations(
  input: Pick<LegitimateLiteralGateInput, 'owner' | 'rationale'>
): readonly string[] {
  return [
    ...(input.owner.trim().length > 2 ? [] : ['owner']),
    ...(input.rationale.trim().length > 20 ? [] : ['rationale'])
  ]
}
