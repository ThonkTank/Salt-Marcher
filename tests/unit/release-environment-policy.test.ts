import { expect, it } from 'vitest'
import {
  configureReleaseEnvironment,
  verifyReleaseEnvironment,
  releaseEnvironmentPolicy
} from '../../scripts/release/environment-policy.js'
import {
  parseReleaseGithubResponse,
  type ReleaseGithubApi
} from '../../scripts/release/github-api.js'

function server() {
  let exists = false
  const environment = {
    id: 123,
    name: 'release',
    protection_rules: [] as unknown[],
    deployment_branch_policy: null as null | {
      protected_branches: boolean
      custom_branch_policies: boolean
    }
  }
  const branches: Array<{ id: number; name: string; type: string }> = []
  const writes: Array<{ method: string; endpoint: string; body: unknown }> = []
  const api: ReleaseGithubApi = (method, endpoint, body) => {
    if (method === 'GET') {
      if (!exists) return { status: 404, body: { message: 'Not Found' } }
      if (endpoint.includes('deployment-branch-policies'))
        return {
          status: 200,
          body: { total_count: branches.length, branch_policies: branches }
        }
      return { status: 200, body: environment }
    }
    writes.push({ method, endpoint, body })
    if (method === 'PUT') {
      exists = true
      environment.protection_rules = [
        {
          type: 'required_reviewers',
          prevent_self_review: false,
          reviewers: [
            { type: 'User', reviewer: releaseEnvironmentPolicy.reviewer }
          ]
        }
      ]
      environment.deployment_branch_policy = {
        protected_branches: false,
        custom_branch_policies: true
      }
      return { status: 200, body: environment }
    }
    branches.push({ id: 456, name: 'main', type: 'branch' })
    return { status: 201, body: branches[0] }
  }
  return { api, writes, environment, branches }
}

it('previews missing configuration without writing or approving a deployment', () => {
  const state = server()
  expect(
    configureReleaseEnvironment(false, state.api).differences
  ).not.toHaveLength(0)
  expect(state.writes).toEqual([])
  expect(() => verifyReleaseEnvironment(state.api)).toThrow(/missing/)
})

it('configures the actual reviewer and main-only policy, reads it back, and is idempotent', () => {
  const state = server()
  expect(configureReleaseEnvironment(true, state.api).applied).toBe(true)
  expect(state.writes.map((write) => write.method)).toEqual(['PUT', 'POST'])
  expect(state.writes[0]!.body).toEqual({
    wait_timer: 0,
    prevent_self_review: false,
    reviewers: [{ type: 'User', id: 129946818 }],
    deployment_branch_policy: {
      protected_branches: false,
      custom_branch_policies: true
    }
  })
  expect(state.writes[1]!.body).toEqual({ name: 'main', type: 'branch' })
  expect(verifyReleaseEnvironment(state.api).environmentId).toBe(123)
  expect(configureReleaseEnvironment(true, state.api).applied).toBe(false)
  expect(state.writes).toHaveLength(2)
  expect(
    state.writes.some((write) => write.endpoint.includes('pending_deployments'))
  ).toBe(false)
})

it('fails closed for missing reviewers, other reviewers, tags and extra branches', () => {
  const state = server()
  configureReleaseEnvironment(true, state.api)
  state.environment.protection_rules = []
  expect(() => verifyReleaseEnvironment(state.api)).toThrow(/human reviewer/)
  state.environment.protection_rules = [
    {
      type: 'required_reviewers',
      prevent_self_review: false,
      reviewers: [{ type: 'User', reviewer: { id: 999 } }]
    }
  ]
  expect(() => verifyReleaseEnvironment(state.api)).toThrow()
  state.branches.push({ id: 789, name: '*', type: 'branch' })
  expect(() => configureReleaseEnvironment(true, state.api)).toThrow(
    /Unexpected/
  )
  state.branches.splice(1)
  state.branches[0]!.type = 'tag'
  expect(() => verifyReleaseEnvironment(state.api)).toThrow(/main branch/)
})

it('does not treat authentication errors as a missing environment', () => {
  const api: ReleaseGithubApi = () => ({
    status: 403,
    body: { message: 'Forbidden' }
  })
  expect(() => configureReleaseEnvironment(true, api)).toThrow(/HTTP 403/)
})

it('requires a complete HTTP response and preserves its actual status', () => {
  expect(
    parseReleaseGithubResponse(
      'HTTP/2.0 404 Not Found\nContent-Type: application/json\r\n\r\n{"message":"Not Found"}'
    )
  ).toEqual({ status: 404, body: { message: 'Not Found' } })
  expect(() => parseReleaseGithubResponse('{"status":200}')).toThrow(
    /complete HTTP/
  )
  expect(() =>
    parseReleaseGithubResponse('HTTP/2.0 200 OK\n\nnot JSON')
  ).toThrow()
})

it('does not claim success when GitHub has not retained the required reviewer', () => {
  const state = server()
  const api: ReleaseGithubApi = (method, endpoint, body) => {
    const response = state.api(method, endpoint, body)
    if (method === 'PUT') state.environment.protection_rules = []
    return response
  }
  expect(() => configureReleaseEnvironment(true, api)).toThrow(/human reviewer/)
})
