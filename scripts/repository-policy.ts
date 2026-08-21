import { execFileSync } from 'node:child_process'
import { z } from 'zod'

import { exactShaAggregateJobName } from './exact-sha-aggregate-contract.js'
import { shaSchema } from './delivery-contract.js'

export const managedRepositoryRulesetName = 'SaltMarcher exact-SHA main gate'
export const githubActionsAppId = 15_368
export const repositoryPolicyProbeRef = 'refs/heads/ruleset-probe/**'

const githubRepositorySchema = z
  .string()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)

const rulesetSummarySchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    source_type: z.string()
  })
  .passthrough()

const rulesetDetailSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    target: z.string(),
    enforcement: z.string(),
    bypass_actors: z.array(z.unknown()),
    conditions: z
      .object({
        ref_name: z
          .object({
            include: z.array(z.string()),
            exclude: z.array(z.string())
          })
          .passthrough()
      })
      .passthrough(),
    rules: z.array(
      z
        .object({
          type: z.string(),
          parameters: z.unknown().optional()
        })
        .passthrough()
    )
  })
  .passthrough()

const checkRunsSchema = z
  .object({
    check_runs: z.array(
      z
        .object({
          name: z.string(),
          head_sha: shaSchema,
          status: z.string(),
          conclusion: z.string().nullable(),
          app: z
            .object({
              id: z.number().int().positive(),
              slug: z.string()
            })
            .nullable()
        })
        .passthrough()
    )
  })
  .passthrough()

export type RepositoryPolicyDiff = Readonly<{
  path: string
  expected: unknown
  actual: unknown
}>

export type RepositoryPolicyEvidence = Readonly<{
  repository: string
  rulesetId: number
  rulesetName: string
  aggregateContext: string
  integrationId: number
}>

export type ApplyRepositoryPolicyOptions = Readonly<{
  apply: boolean
  includeProbe: boolean
  checkedSha?: string
}>

export function expectedRepositoryRulesetRequest(
  includeProbe = false
): Record<string, unknown> {
  return {
    name: managedRepositoryRulesetName,
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    conditions: {
      ref_name: {
        include: [
          'refs/heads/main',
          ...(includeProbe ? [repositoryPolicyProbeRef] : [])
        ],
        exclude: []
      }
    },
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      { type: 'required_linear_history' },
      {
        type: 'required_status_checks',
        parameters: {
          do_not_enforce_on_create: false,
          required_status_checks: [
            {
              context: exactShaAggregateJobName,
              integration_id: githubActionsAppId
            }
          ],
          strict_required_status_checks_policy: false
        }
      }
    ]
  }
}

export function repositoryPolicyDiff(
  raw: unknown,
  includeProbe = false
): readonly RepositoryPolicyDiff[] {
  const actual = normalizeRuleset(raw)
  const expected = normalizeRuleset({
    id: actual['id'],
    ...expectedRepositoryRulesetRequest(includeProbe)
  })
  const differences: RepositoryPolicyDiff[] = []
  collectDifferences(expected, actual, '$', differences)
  return differences
}

export function assertRepositoryPolicy(
  raw: unknown,
  includeProbe = false
): RepositoryPolicyEvidence {
  const ruleset = rulesetDetailSchema.parse(raw)
  const differences = repositoryPolicyDiff(ruleset, includeProbe)
  if (differences.length > 0)
    throw new Error(
      `Managed repository ruleset differs from policy: ${JSON.stringify(differences)}`
    )
  return {
    repository: '',
    rulesetId: ruleset.id,
    rulesetName: managedRepositoryRulesetName,
    aggregateContext: exactShaAggregateJobName,
    integrationId: githubActionsAppId
  }
}

export function verifyLiveRepositoryPolicy(): RepositoryPolicyEvidence {
  const repository = resolveRepository()
  const ruleset = readManagedRuleset(repository)
  if (!ruleset)
    throw new Error(
      `Managed repository ruleset is missing: ${managedRepositoryRulesetName}`
    )
  return { ...assertRepositoryPolicy(ruleset), repository }
}

export function applyLiveRepositoryPolicy(
  options: ApplyRepositoryPolicyOptions
): Readonly<{
  repository: string
  action: 'create' | 'update' | 'unchanged'
  applied: boolean
  differences: readonly RepositoryPolicyDiff[]
  evidence: RepositoryPolicyEvidence | null
}> {
  const repository = resolveRepository()
  const checkedSha = shaSchema.parse(
    options.checkedSha ?? git(['rev-parse', 'HEAD'])
  )
  assertAggregateCheckSource(repository, checkedSha)
  const current = readManagedRuleset(repository)
  const expected = expectedRepositoryRulesetRequest(options.includeProbe)
  const differences = current
    ? repositoryPolicyDiff(current, options.includeProbe)
    : [{ path: '$', expected, actual: null }]
  const action = current
    ? differences.length === 0
      ? 'unchanged'
      : 'update'
    : 'create'

  if (!options.apply || action === 'unchanged')
    return {
      repository,
      action,
      applied: false,
      differences,
      evidence:
        current && differences.length === 0
          ? {
              ...assertRepositoryPolicy(current, options.includeProbe),
              repository
            }
          : null
    }

  const endpoint = current
    ? `repos/${repository}/rulesets/${rulesetDetailSchema.parse(current).id}`
    : `repos/${repository}/rulesets`
  githubApi(current ? 'PUT' : 'POST', endpoint, expected)
  const updated = readManagedRuleset(repository)
  if (!updated)
    throw new Error('Managed repository ruleset is missing after apply.')
  return {
    repository,
    action,
    applied: true,
    differences,
    evidence: {
      ...assertRepositoryPolicy(updated, options.includeProbe),
      repository
    }
  }
}

function normalizeRuleset(raw: unknown): Record<string, unknown> {
  const parsed = rulesetDetailSchema.parse(raw)
  return {
    id: parsed.id,
    name: parsed.name,
    target: parsed.target,
    enforcement: parsed.enforcement,
    bypass_actors: parsed.bypass_actors,
    conditions: {
      ref_name: {
        include: parsed.conditions.ref_name.include.toSorted(),
        exclude: parsed.conditions.ref_name.exclude.toSorted()
      }
    },
    rules: parsed.rules
      .map((rule) =>
        rule.parameters === undefined
          ? { type: rule.type }
          : { type: rule.type, parameters: canonicalize(rule.parameters) }
      )
      .toSorted((left, right) => left.type.localeCompare(right.type))
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value))
    return value
      .map(canonicalize)
      .toSorted((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right))
      )
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)])
    )
  return value
}

function collectDifferences(
  expected: unknown,
  actual: unknown,
  path: string,
  differences: RepositoryPolicyDiff[]
): void {
  if (JSON.stringify(expected) === JSON.stringify(actual)) return
  if (
    expected === null ||
    actual === null ||
    typeof expected !== 'object' ||
    typeof actual !== 'object' ||
    Array.isArray(expected) ||
    Array.isArray(actual)
  ) {
    differences.push({ path, expected, actual })
    return
  }
  const expectedRecord = expected as Record<string, unknown>
  const actualRecord = actual as Record<string, unknown>
  const keys = new Set([
    ...Object.keys(expectedRecord),
    ...Object.keys(actualRecord)
  ])
  for (const key of [...keys].toSorted())
    collectDifferences(
      expectedRecord[key],
      actualRecord[key],
      `${path}.${key}`,
      differences
    )
}

function resolveRepository(): string {
  const environmentRepository = process.env['GITHUB_REPOSITORY']
  if (environmentRepository)
    return githubRepositorySchema.parse(environmentRepository)
  return githubRepositorySchema.parse(
    gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'])
  )
}

function readManagedRuleset(repository: string): unknown {
  const summaries = z
    .array(rulesetSummarySchema)
    .parse(
      JSON.parse(
        githubApi('GET', `repos/${repository}/rulesets?includes_parents=false`)
      )
    )
    .filter(
      ({ name, source_type: sourceType }) =>
        name === managedRepositoryRulesetName && sourceType === 'Repository'
    )
  if (summaries.length > 1)
    throw new Error(
      `Managed repository ruleset is duplicated: ${managedRepositoryRulesetName}`
    )
  const summary = summaries[0]
  if (!summary) return null
  return JSON.parse(
    githubApi('GET', `repos/${repository}/rulesets/${summary.id}`)
  ) as unknown
}

function assertAggregateCheckSource(repository: string, sha: string): void {
  const response = checkRunsSchema.parse(
    JSON.parse(
      githubApi(
        'GET',
        `repos/${repository}/commits/${sha}/check-runs?check_name=${encodeURIComponent(exactShaAggregateJobName)}&per_page=100`
      )
    )
  )
  const matching = response.check_runs.filter(
    (run) =>
      run.name === exactShaAggregateJobName &&
      run.head_sha === sha &&
      run.status === 'completed' &&
      run.conclusion === 'success' &&
      run.app?.id === githubActionsAppId &&
      run.app.slug === 'github-actions'
  )
  if (matching.length === 0)
    throw new Error(
      `No successful ${exactShaAggregateJobName} check from GitHub Actions proves ${sha}.`
    )
}

function githubApi(
  method: 'GET' | 'POST' | 'PUT',
  endpoint: string,
  input?: unknown
): string {
  return gh(
    [
      'api',
      '--method',
      method,
      '-H',
      'Accept: application/vnd.github+json',
      '-H',
      'X-GitHub-Api-Version: 2026-03-10',
      endpoint,
      ...(input === undefined ? [] : ['--input', '-'])
    ],
    input === undefined ? undefined : JSON.stringify(input)
  )
}

function git(arguments_: readonly string[]): string {
  return execFileSync('git', arguments_, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function gh(arguments_: readonly string[], input?: string): string {
  return execFileSync('gh', arguments_, {
    cwd: process.cwd(),
    encoding: 'utf8',
    input,
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}
