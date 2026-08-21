import { z } from 'zod'

import { shaSchema } from './delivery-contract.js'

export const exactShaAggregateJobName = 'Candidate · exact-SHA aggregate'

export const exactShaAggregateNeeds = [
  'portable',
  'native',
  'linux-build',
  'linux-package',
  'linux-qualification',
  'e2e',
  'visual',
  'passive-e2e'
] as const

const needSchema = z
  .object({
    result: z.string().min(1),
    outputs: z.record(z.string(), z.string()).optional()
  })
  .passthrough()

const needsSchema = z.record(z.string(), needSchema)

export type ExactShaAggregateInput = Readonly<{
  checkedOutSha: string
  checkedSha: string
  pullRequestHeadSha: string
  needs: unknown
}>

export function verifyExactShaAggregate(input: ExactShaAggregateInput): void {
  const checkedOutSha = shaSchema.parse(input.checkedOutSha)
  const checkedSha = shaSchema.parse(input.checkedSha)
  const pullRequestHeadSha = shaSchema.parse(input.pullRequestHeadSha)
  if (checkedOutSha !== pullRequestHeadSha)
    throw new Error(
      'Aggregate checkout differs from the pull request head SHA.'
    )
  if (checkedSha !== pullRequestHeadSha)
    throw new Error(
      'SALT_MARCHER_CHECKED_SHA differs from the pull request head SHA.'
    )

  const needs = needsSchema.parse(input.needs)
  const actualNames = Object.keys(needs).toSorted()
  const expectedNames = [...exactShaAggregateNeeds].toSorted()
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames))
    throw new Error(
      `Aggregate dependency set differs: expected ${expectedNames.join(', ')}, received ${actualNames.join(', ')}.`
    )

  const unsuccessful = exactShaAggregateNeeds.filter(
    (name) => needs[name]?.result !== 'success'
  )
  if (unsuccessful.length > 0)
    throw new Error(
      `Aggregate dependencies are not successful: ${unsuccessful
        .map((name) => `${name}=${needs[name]?.result ?? 'missing'}`)
        .join(', ')}.`
    )
}
