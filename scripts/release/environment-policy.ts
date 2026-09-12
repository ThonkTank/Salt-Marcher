import { z } from 'zod'
import { releaseRepository } from '../../src/shared/contracts/release.js'
import { releaseGithubApi, type ReleaseGithubApi } from './github-api.js'

export const releaseEnvironmentPolicy = Object.freeze({
  environment: 'release',
  reviewer: Object.freeze({ id: 129946818, login: 'ThonkTank' }),
  branch: 'main'
})
const endpoint = `repos/${releaseRepository}/environments/release`
const environmentSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.literal('release'),
    protection_rules: z.array(z.object({ type: z.string() }).passthrough()),
    deployment_branch_policy: z
      .object({
        protected_branches: z.boolean(),
        custom_branch_policies: z.boolean()
      })
      .nullable()
  })
  .passthrough()
const reviewerRuleSchema = z
  .object({
    type: z.literal('required_reviewers'),
    prevent_self_review: z.boolean(),
    reviewers: z.array(
      z
        .object({
          type: z.string(),
          reviewer: z
            .object({ id: z.number().int(), login: z.string().optional() })
            .passthrough()
        })
        .passthrough()
    )
  })
  .passthrough()
const branchesSchema = z
  .object({
    total_count: z.number().int().nonnegative(),
    branch_policies: z.array(
      z
        .object({
          id: z.number().int().positive(),
          name: z.string(),
          type: z.string()
        })
        .passthrough()
    )
  })
  .passthrough()

export function readReleaseEnvironment(
  api: ReleaseGithubApi = releaseGithubApi
) {
  const response = api('GET', endpoint)
  if (response.status === 404) return null
  if (response.status !== 200)
    throw new Error(
      `Could not read release environment: HTTP ${response.status}.`
    )
  const environment = environmentSchema.parse(response.body)
  const policies = api(
    'GET',
    `${endpoint}/deployment-branch-policies?per_page=100`
  )
  if (policies.status !== 200)
    throw new Error(
      `Could not read release branch policy: HTTP ${policies.status}.`
    )
  return { environment, branches: branchesSchema.parse(policies.body) }
}

type EnvironmentState = ReturnType<typeof readReleaseEnvironment>
export function releaseEnvironmentDifferences(
  state: EnvironmentState
): string[] {
  if (!state) return ['Release environment is missing.']
  const differences: string[] = []
  const required = state.environment.protection_rules.filter(
    (rule) => rule.type === 'required_reviewers'
  )
  const parsed =
    required.length === 1 ? reviewerRuleSchema.safeParse(required[0]) : null
  if (
    !parsed?.success ||
    parsed.data.prevent_self_review ||
    parsed.data.reviewers.length !== 1 ||
    parsed.data.reviewers[0]!.type !== 'User' ||
    parsed.data.reviewers[0]!.reviewer.id !==
      releaseEnvironmentPolicy.reviewer.id
  )
    differences.push(
      'Release requires the configured human reviewer, including owner-initiated runs.'
    )
  const branchPolicy = state.environment.deployment_branch_policy
  if (!branchPolicy?.custom_branch_policies || branchPolicy.protected_branches)
    differences.push('Release must use an explicit deployment branch policy.')
  if (
    state.branches.total_count !== 1 ||
    state.branches.branch_policies.length !== 1 ||
    state.branches.branch_policies[0]!.name !==
      releaseEnvironmentPolicy.branch ||
    state.branches.branch_policies[0]!.type !== 'branch'
  )
    differences.push('Only the main branch may deploy a release.')
  return differences
}

export function verifyReleaseEnvironment(
  api: ReleaseGithubApi = releaseGithubApi
) {
  const state = readReleaseEnvironment(api)
  const differences = releaseEnvironmentDifferences(state)
  if (!state || differences.length) throw new Error(differences.join(' '))
  return { environmentId: state.environment.id, ...releaseEnvironmentPolicy }
}

export function configureReleaseEnvironment(
  apply: boolean,
  api: ReleaseGithubApi = releaseGithubApi
) {
  const before = readReleaseEnvironment(api)
  const differences = releaseEnvironmentDifferences(before)
  if (!apply || differences.length === 0)
    return { applied: false, differences, policy: releaseEnvironmentPolicy }
  if (
    before?.branches.branch_policies.some(
      (branch) => branch.name !== 'main' || branch.type !== 'branch'
    )
  )
    throw new Error(
      'Unexpected release branch policies must be reviewed before replacing the environment policy.'
    )
  const changed = api('PUT', endpoint, {
    wait_timer: 0,
    prevent_self_review: false,
    reviewers: [{ type: 'User', id: releaseEnvironmentPolicy.reviewer.id }],
    deployment_branch_policy: {
      protected_branches: false,
      custom_branch_policies: true
    }
  })
  if (changed.status !== 200)
    throw new Error(
      `Could not configure release reviewers: HTTP ${changed.status}.`
    )
  if (
    !before?.branches.branch_policies.some(
      (branch) => branch.name === 'main' && branch.type === 'branch'
    )
  ) {
    const created = api('POST', `${endpoint}/deployment-branch-policies`, {
      name: 'main',
      type: 'branch'
    })
    if (![200, 201].includes(created.status))
      throw new Error(
        `Could not restrict release deployment: HTTP ${created.status}.`
      )
  }
  const verified = verifyReleaseEnvironment(api)
  return { applied: true, differences: [], policy: verified }
}
