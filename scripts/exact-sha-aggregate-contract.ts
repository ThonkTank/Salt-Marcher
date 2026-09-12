import { z } from 'zod'

import { shaSchema } from './delivery-contract.js'
import { verifyCiRiskSelection } from './ci-risk-selection.js'
import { assertSelectionMainBase } from './ci-selection-artifact.js'

export const exactShaAggregateJobName = 'Candidate · exact-SHA aggregate'

export const exactShaAggregateNeeds = [
  'candidate-preflight',
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
  selection?: unknown
  selectionContext?: Readonly<{
    workspaceRoot: string
    baseSha: string
    mainSha: string
    forceFull: boolean
  }>
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

  if (
    (input.selection === undefined) !==
    (input.selectionContext === undefined)
  )
    throw new Error(
      'Aggregate requires both selection and immutable verification context.'
    )
  const selection = input.selectionContext
    ? verifyCiRiskSelection(input.selection, {
        ...input.selectionContext,
        headSha: checkedSha
      })
    : null
  if (selection && input.selectionContext)
    assertSelectionMainBase(
      selection,
      input.selectionContext.mainSha,
      input.selectionContext.workspaceRoot
    )
  const required = new Set<string>(
    selection
      ? ['candidate-preflight', ...selection.requiredGroups]
      : exactShaAggregateNeeds
  )
  const unsuccessful = exactShaAggregateNeeds.filter((name) =>
    required.has(name)
      ? needs[name]?.result !== 'success'
      : !['success', 'skipped'].includes(needs[name]?.result ?? 'missing')
  )
  if (unsuccessful.length > 0)
    throw new Error(
      `Aggregate dependencies are not successful: ${unsuccessful
        .map((name) => `${name}=${needs[name]?.result ?? 'missing'}`)
        .join(', ')}.`
    )
}
